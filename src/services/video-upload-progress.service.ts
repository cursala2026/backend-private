import { EventEmitter } from 'events';
import { logger } from '@/utils';

/**
 * Servicio para trackear el progreso de subida de videos
 * Mantiene un mapa en memoria del progreso por classId
 */
class VideoUploadProgressService extends EventEmitter {
  private progressMap: Map<string, number> = new Map();
  private sseClients: Map<string, Set<EventEmitter>> = new Map();

  /**
   * Inicia el tracking de progreso para una clase
   */
  startTracking(classId: string): void {
    this.progressMap.set(classId, 0);
  }

  /**
   * Actualiza el progreso de una clase
   */
  updateProgress(classId: string, percent: number): void {
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
    this.progressMap.set(classId, clampedPercent);
    
    // Emitir evento a todos los clientes SSE conectados
    const clients = this.sseClients.get(classId);
    if (clients) {
      clients.forEach((client) => {
        if (client instanceof EventEmitter) {
          client.emit('progress', { percent: clampedPercent });
        }
      });
    }
  }

  /**
   * Obtiene el progreso actual de una clase
   */
  getProgress(classId: string): number {
    return this.progressMap.get(classId) || 0;
  }

  /**
   * Finaliza el tracking y limpia los recursos
   */
  finishTracking(classId: string): void {
    this.updateProgress(classId, 100);
    // Mantener el progreso por más tiempo para permitir reconexión
    // Pero marcar como completado para evitar reconexiones infinitas
    setTimeout(() => {
      // No eliminar inmediatamente, mantener por más tiempo
      // pero notificar a los clientes que ya terminó
      const clients = this.sseClients.get(classId);
      if (clients) {
        clients.forEach((client) => {
          if (client instanceof EventEmitter) {
            client.emit('complete', { percent: 100 });
          }
        });
      }
    }, 2000);
    
    // Limpiar después de 5 minutos (tiempo suficiente para reconexión)
    setTimeout(() => {
      this.progressMap.delete(classId);
      this.sseClients.delete(classId);
    }, 300000); // 5 minutos después de completar
  }

  /**
   * Marca un error en el tracking
   */
  setError(classId: string): void {
    this.progressMap.set(classId, -1); // -1 indica error
    const clients = this.sseClients.get(classId);
    if (clients) {
      clients.forEach((client) => {
        if (client instanceof EventEmitter) {
          client.emit('error', { message: 'Error al subir video' });
        }
      });
    }
    // Limpiar después de un tiempo
    setTimeout(() => {
      this.progressMap.delete(classId);
      this.sseClients.delete(classId);
    }, 60000);
  }

  /**
   * Registra un cliente SSE para recibir actualizaciones de progreso
   */
  registerSSEClient(classId: string, client: EventEmitter): void {
    if (!this.sseClients.has(classId)) {
      this.sseClients.set(classId, new Set());
    }
    this.sseClients.get(classId)!.add(client);
    
    // Enviar progreso actual inmediatamente (incluso si es 0)
    const currentProgress = this.getProgress(classId);
    // Emitir siempre, incluso si es 0, para que el frontend sepa que está conectado
    // Usar setTimeout para asegurar que el cliente esté listo
    setTimeout(() => {
      client.emit('progress', { percent: currentProgress });
    }, 100);
  }

  /**
   * Desregistra un cliente SSE
   */
  unregisterSSEClient(classId: string, client: EventEmitter): void {
    const clients = this.sseClients.get(classId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.sseClients.delete(classId);
      }
    }
  }

  /**
   * Verifica si hay tracking activo para una clase
   */
  isTracking(classId: string): boolean {
    return this.progressMap.has(classId);
  }
}

export const videoUploadProgressService = new VideoUploadProgressService();

