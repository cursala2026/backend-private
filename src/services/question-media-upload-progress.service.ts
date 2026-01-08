import { EventEmitter } from 'events';
import { logger } from '@/utils';

/**
 * Servicio para rastrear y reportar el progreso de subidas de medios de preguntas.
 * Utiliza EventEmitter para notificar a clientes SSE conectados.
 * Diseñado de forma similar a video-upload-progress.service.ts
 */
class QuestionMediaUploadProgressService extends EventEmitter {
  private progressMap: Map<string, number> = new Map();
  private sseClients: Map<string, Set<EventEmitter>> = new Map();

  /**
   * Iniciar tracking de progreso para una subida.
   * @param uploadId Identificador único de la subida (e.g., `${questionnaireId}_${questionId}`)
   */
  startTracking(uploadId: string): void {
    this.progressMap.set(uploadId, 0);
    logger.info('QuestionMediaUploadProgress: Started tracking', { uploadId });
  }

  /**
   * Actualizar el progreso de una subida (0-100).
   * @param uploadId Identificador de la subida
   * @param percent Porcentaje de progreso (0-100)
   */
  updateProgress(uploadId: string, percent: number): void {
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
    this.progressMap.set(uploadId, clampedPercent);

    // Emitir evento a todos los clientes SSE conectados para este uploadId
    const clients = this.sseClients.get(uploadId);
    if (clients) {
      clients.forEach((client) => {
        try {
          client.emit('progress', { percent: clampedPercent });
        } catch (err) {
          logger.warn('QuestionMediaUploadProgress: Error emitting progress to client', {
            uploadId,
            error: (err as Error).message,
          });
        }
      });
    }

    logger.debug('QuestionMediaUploadProgress: Progress updated', { uploadId, percent: clampedPercent });
  }

  /**
   * Obtener el progreso actual de una subida.
   * @param uploadId Identificador de la subida
   * @returns Porcentaje actual (0-100), o 0 si no existe
   */
  getProgress(uploadId: string): number {
    return this.progressMap.get(uploadId) || 0;
  }

  /**
   * Marcar una subida como completada (100%).
   * @param uploadId Identificador de la subida
   */
  finishTracking(uploadId: string): void {
    this.updateProgress(uploadId, 100);

    // Dar tiempo para que el cliente reciba el 100% antes de emitir evento 'complete'
    setTimeout(() => {
      const clients = this.sseClients.get(uploadId);
      if (clients) {
        clients.forEach((client) => {
          try {
            client.emit('complete', { percent: 100 });
          } catch (err) {
            logger.warn('QuestionMediaUploadProgress: Error emitting complete to client', {
              uploadId,
              error: (err as Error).message,
            });
          }
        });
      }
    }, 2000);

    // Limpiar progreso después de 5 minutos (permite reconexión temporal)
    setTimeout(() => {
      this.progressMap.delete(uploadId);
      this.sseClients.delete(uploadId);
      logger.info('QuestionMediaUploadProgress: Cleaned up after completion', { uploadId });
    }, 300000); // 5 minutos

    logger.info('QuestionMediaUploadProgress: Finished tracking', { uploadId });
  }

  /**
   * Marcar una subida como fallida.
   * @param uploadId Identificador de la subida
   * @param errorMessage Mensaje de error (opcional)
   */
  setError(uploadId: string, errorMessage?: string): void {
    this.progressMap.set(uploadId, -1); // -1 indica error

    const clients = this.sseClients.get(uploadId);
    if (clients) {
      clients.forEach((client) => {
        try {
          client.emit('error', { message: errorMessage || 'Error al subir archivo multimedia' });
        } catch (err) {
          logger.warn('QuestionMediaUploadProgress: Error emitting error to client', {
            uploadId,
            error: (err as Error).message,
          });
        }
      });
    }

    // Limpiar progreso después de 1 minuto
    setTimeout(() => {
      this.progressMap.delete(uploadId);
      this.sseClients.delete(uploadId);
      logger.info('QuestionMediaUploadProgress: Cleaned up after error', { uploadId });
    }, 60000); // 1 minuto

    logger.error('QuestionMediaUploadProgress: Error tracking', { uploadId, errorMessage });
  }

  /**
   * Registrar un cliente SSE para recibir actualizaciones de progreso.
   * @param uploadId Identificador de la subida
   * @param client EventEmitter del cliente
   */
  registerSSEClient(uploadId: string, client: EventEmitter): void {
    if (!this.sseClients.has(uploadId)) {
      this.sseClients.set(uploadId, new Set());
    }
    this.sseClients.get(uploadId)!.add(client);

    // Enviar progreso actual inmediatamente al nuevo cliente
    setTimeout(() => {
      const currentProgress = this.getProgress(uploadId);
      try {
        client.emit('progress', { percent: currentProgress });
      } catch (err) {
        logger.warn('QuestionMediaUploadProgress: Error sending initial progress to client', {
          uploadId,
          error: (err as Error).message,
        });
      }
    }, 100);

    logger.debug('QuestionMediaUploadProgress: Registered SSE client', { uploadId });
  }

  /**
   * Desregistrar un cliente SSE.
   * @param uploadId Identificador de la subida
   * @param client EventEmitter del cliente
   */
  unregisterSSEClient(uploadId: string, client: EventEmitter): void {
    const clients = this.sseClients.get(uploadId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.sseClients.delete(uploadId);
      }
    }
    logger.debug('QuestionMediaUploadProgress: Unregistered SSE client', { uploadId });
  }

  /**
   * Verificar si una subida está siendo rastreada actualmente.
   * @param uploadId Identificador de la subida
   * @returns true si está siendo rastreada, false en caso contrario
   */
  isTracking(uploadId: string): boolean {
    return this.progressMap.has(uploadId);
  }
}

// Singleton instance
const questionMediaUploadProgressService = new QuestionMediaUploadProgressService();
export default questionMediaUploadProgressService;
