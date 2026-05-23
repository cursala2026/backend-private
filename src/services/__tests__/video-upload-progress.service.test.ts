import { videoUploadProgressService } from '../video-upload-progress.service';
import { EventEmitter } from 'events';

describe('VideoUploadProgressService', () => {
  const classId = 'test-class-id';

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Reset service state manually or wait for timers if possible
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('should start tracking progress at 0', () => {
    videoUploadProgressService.startTracking(classId);
    expect(videoUploadProgressService.isTracking(classId)).toBe(true);
    expect(videoUploadProgressService.getProgress(classId)).toBe(0);
  });

  it('should update progress and clamp values', () => {
    videoUploadProgressService.startTracking(classId);
    
    videoUploadProgressService.updateProgress(classId, 50);
    expect(videoUploadProgressService.getProgress(classId)).toBe(50);
    
    videoUploadProgressService.updateProgress(classId, 150);
    expect(videoUploadProgressService.getProgress(classId)).toBe(100);
    
    videoUploadProgressService.updateProgress(classId, -10);
    expect(videoUploadProgressService.getProgress(classId)).toBe(0);
  });

  it('should emit progress to registered SSE clients', () => {
    videoUploadProgressService.startTracking(classId);
    const mockClient = new EventEmitter();
    mockClient.on('error', () => {});
    const emitSpy = jest.spyOn(mockClient, 'emit');

    videoUploadProgressService.registerSSEClient(classId, mockClient);
    
    // registration emits current progress after 100ms
    jest.advanceTimersByTime(100);
    expect(emitSpy).toHaveBeenCalledWith('progress', { percent: 0 });

    videoUploadProgressService.updateProgress(classId, 25);
    expect(emitSpy).toHaveBeenCalledWith('progress', { percent: 25 });
  });

  it('should unregister SSE client', () => {
    videoUploadProgressService.startTracking(classId);
    const mockClient = new EventEmitter();
    mockClient.on('error', () => {});
    const emitSpy = jest.spyOn(mockClient, 'emit');

    videoUploadProgressService.registerSSEClient(classId, mockClient);
    jest.advanceTimersByTime(100); // clear the initial timeout
    
    videoUploadProgressService.unregisterSSEClient(classId, mockClient);
    
    videoUploadProgressService.updateProgress(classId, 50);
    
    // should not have been called with 50 because it was unregistered
    expect(emitSpy).not.toHaveBeenCalledWith('progress', { percent: 50 });
  });

  it('should set error state and emit to clients', () => {
    videoUploadProgressService.startTracking(classId);
    const mockClient = new EventEmitter();
    mockClient.on('error', () => {});
    const emitSpy = jest.spyOn(mockClient, 'emit');

    videoUploadProgressService.registerSSEClient(classId, mockClient);
    jest.advanceTimersByTime(100);

    videoUploadProgressService.setError(classId);
    
    expect(videoUploadProgressService.getProgress(classId)).toBe(-1);
    expect(emitSpy).toHaveBeenCalledWith('error', { message: 'Error al subir video' });
    
    // Should clear after 60s
    jest.advanceTimersByTime(60000);
    expect(videoUploadProgressService.isTracking(classId)).toBe(false);
  });

  it('should finish tracking and cleanup resources later', () => {
    videoUploadProgressService.startTracking(classId);
    const mockClient = new EventEmitter();
    mockClient.on('error', () => {});
    const emitSpy = jest.spyOn(mockClient, 'emit');

    videoUploadProgressService.registerSSEClient(classId, mockClient);
    jest.advanceTimersByTime(100);

    videoUploadProgressService.finishTracking(classId);
    
    expect(videoUploadProgressService.getProgress(classId)).toBe(100);
    
    // After 2s, should emit complete
    jest.advanceTimersByTime(2000);
    expect(emitSpy).toHaveBeenCalledWith('complete', { percent: 100 });
    
    // After 5m, should be deleted
    expect(videoUploadProgressService.isTracking(classId)).toBe(true);
    jest.advanceTimersByTime(300000);
    expect(videoUploadProgressService.isTracking(classId)).toBe(false);
  });
});
