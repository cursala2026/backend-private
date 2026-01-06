import { logger } from '@/utils';

class VideoUploadQueueService {
  private queues: Map<string, Array<() => Promise<void>>> = new Map();
  private processing: Set<string> = new Set();

  enqueue(classId: string, job: () => Promise<void>): void {
    if (!this.queues.has(classId)) this.queues.set(classId, []);
    this.queues.get(classId)!.push(job);
    this.processNext(classId);
  }

  /**
   * Si ya hay un job en proceso o pendientes para la misma clase, devuelve false.
   * Si no, encola y devuelve true.
   */
  tryEnqueueOrReject(classId: string, job: () => Promise<void>): boolean {
    const hasActive = this.processing.has(classId);
    const pending = (this.queues.get(classId)?.length ?? 0) > 0;
    if (hasActive || pending) return false;
    this.enqueue(classId, job);
    return true;
  }

  isProcessing(classId: string): boolean {
    return this.processing.has(classId);
  }

  hasPending(classId: string): boolean {
    return (this.queues.get(classId)?.length ?? 0) > 0;
  }

  private async processNext(classId: string): Promise<void> {
    if (this.processing.has(classId)) return;
    const q = this.queues.get(classId);
    if (!q || q.length === 0) {
      this.queues.delete(classId);
      return;
    }

    const job = q.shift()!;
    this.processing.add(classId);
    try {
      await job();
    } catch (e) {
      logger.error(`Error ejecutando job de subida para clase ${classId}: ${(e as Error).message}`);
    } finally {
      this.processing.delete(classId);
      // Continuar con siguiente job si existe
      setImmediate(() => this.processNext(classId));
    }
  }
}

export const videoUploadQueueService = new VideoUploadQueueService();
