import { videoUploadQueueService } from '../video-upload-queue.service';
import { logger } from '@/utils';

jest.mock('@/utils', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('VideoUploadQueueService', () => {
  const classId = 'test-class-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to wait for setImmediate loop to finish
  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  it('should enqueue and process a job', async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    
    videoUploadQueueService.enqueue(classId, job);
    
    expect(videoUploadQueueService.isProcessing(classId)).toBe(true);
    
    await flushPromises();
    
    expect(job).toHaveBeenCalledTimes(1);
    expect(videoUploadQueueService.isProcessing(classId)).toBe(false);
    expect(videoUploadQueueService.hasPending(classId)).toBe(false);
  });

  it('should process multiple jobs sequentially', async () => {
    const executionOrder: number[] = [];
    
    const job1 = jest.fn().mockImplementation(async () => {
      executionOrder.push(1);
    });
    const job2 = jest.fn().mockImplementation(async () => {
      executionOrder.push(2);
    });

    videoUploadQueueService.enqueue('class2', job1);
    videoUploadQueueService.enqueue('class2', job2);

    expect(videoUploadQueueService.isProcessing('class2')).toBe(true);
    expect(videoUploadQueueService.hasPending('class2')).toBe(true); // Job 2 is pending
    
    // Process job 1 and trigger job 2 start
    await flushPromises();
    // Process job 2
    await flushPromises();

    expect(executionOrder).toEqual([1, 2]);
    expect(videoUploadQueueService.isProcessing('class2')).toBe(false);
  });

  it('tryEnqueueOrReject should return true if no active job, and false if active', async () => {
    let resolveJob1: any;
    const job1Promise = new Promise<void>((resolve) => { resolveJob1 = resolve; });
    const job1 = jest.fn().mockReturnValue(job1Promise);
    const job2 = jest.fn().mockResolvedValue(undefined);

    const enqueued1 = videoUploadQueueService.tryEnqueueOrReject('class3', job1);
    expect(enqueued1).toBe(true);
    
    // While job1 is pending, job2 should be rejected
    const enqueued2 = videoUploadQueueService.tryEnqueueOrReject('class3', job2);
    expect(enqueued2).toBe(false);

    // Resolve job1 so it finishes
    resolveJob1();
    await flushPromises();
    await flushPromises();

    // Now it should accept again
    const enqueued3 = videoUploadQueueService.tryEnqueueOrReject('class3', job2);
    expect(enqueued3).toBe(true);
    
    await flushPromises();
  });

  it('should log error if job fails and continue with next job', async () => {
    const errorJob = jest.fn().mockRejectedValue(new Error('Test error'));
    const successJob = jest.fn().mockResolvedValue(undefined);

    videoUploadQueueService.enqueue('class4', errorJob);
    videoUploadQueueService.enqueue('class4', successJob);

    await flushPromises(); // Run errorJob
    await flushPromises(); // Run successJob

    expect(errorJob).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Error ejecutando job de subida para clase class4: Test error');
    expect(successJob).toHaveBeenCalled(); // Should have continued to next job
  });
});
