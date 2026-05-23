import questionMediaUploadProgressService from '../question-media-upload-progress.service';
import { EventEmitter } from 'events';
import { logger } from '@/utils';

jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('QuestionMediaUploadProgressService', () => {
  const uploadId = 'test-upload-id';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('should start tracking progress at 0', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    expect(questionMediaUploadProgressService.isTracking(uploadId)).toBe(true);
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith('QuestionMediaUploadProgress: Started tracking', { uploadId });
  });

  it('should update progress and clamp values', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    
    questionMediaUploadProgressService.updateProgress(uploadId, 50);
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(50);
    
    questionMediaUploadProgressService.updateProgress(uploadId, 150);
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(100);
    
    questionMediaUploadProgressService.updateProgress(uploadId, -10);
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(0);
  });

  it('should emit progress to registered SSE clients', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    const mockClient = new EventEmitter();
    const emitSpy = jest.spyOn(mockClient, 'emit');

    questionMediaUploadProgressService.registerSSEClient(uploadId, mockClient);
    
    jest.advanceTimersByTime(100);
    expect(emitSpy).toHaveBeenCalledWith('progress', { percent: 0 });

    questionMediaUploadProgressService.updateProgress(uploadId, 25);
    expect(emitSpy).toHaveBeenCalledWith('progress', { percent: 25 });
  });

  it('should unregister SSE client', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    const mockClient = new EventEmitter();
    const emitSpy = jest.spyOn(mockClient, 'emit');

    questionMediaUploadProgressService.registerSSEClient(uploadId, mockClient);
    jest.advanceTimersByTime(100);
    
    questionMediaUploadProgressService.unregisterSSEClient(uploadId, mockClient);
    
    questionMediaUploadProgressService.updateProgress(uploadId, 50);
    
    expect(emitSpy).not.toHaveBeenCalledWith('progress', { percent: 50 });
  });

  it('should set error state and emit to clients', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    const mockClient = new EventEmitter();
    const emitSpy = jest.spyOn(mockClient, 'emit');

    questionMediaUploadProgressService.registerSSEClient(uploadId, mockClient);
    jest.advanceTimersByTime(100);

    questionMediaUploadProgressService.setError(uploadId, 'Custom Error');
    
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(-1);
    expect(emitSpy).toHaveBeenCalledWith('error', { message: 'Custom Error' });
    expect(logger.error).toHaveBeenCalledWith('QuestionMediaUploadProgress: Error tracking', { uploadId, errorMessage: 'Custom Error' });
    
    jest.advanceTimersByTime(60000);
    expect(questionMediaUploadProgressService.isTracking(uploadId)).toBe(false);
  });

  it('should finish tracking and cleanup resources later', () => {
    questionMediaUploadProgressService.startTracking(uploadId);
    const mockClient = new EventEmitter();
    const emitSpy = jest.spyOn(mockClient, 'emit');

    questionMediaUploadProgressService.registerSSEClient(uploadId, mockClient);
    jest.advanceTimersByTime(100);

    questionMediaUploadProgressService.finishTracking(uploadId);
    
    expect(questionMediaUploadProgressService.getProgress(uploadId)).toBe(100);
    
    jest.advanceTimersByTime(2000);
    expect(emitSpy).toHaveBeenCalledWith('complete', { percent: 100 });
    
    expect(questionMediaUploadProgressService.isTracking(uploadId)).toBe(true);
    jest.advanceTimersByTime(300000);
    expect(questionMediaUploadProgressService.isTracking(uploadId)).toBe(false);
  });
});
