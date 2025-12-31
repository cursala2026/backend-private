import { EventEmitter } from 'events';
import { logger } from '@/utils';
import NotificationRepository, {
  GetNotificationsParams,
  NotificationsPaginated,
} from '@/repositories/notification.repository';
import { INotification, NotificationType } from '@/models/mongo/notification.model';

export interface SendNotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, any>;
}

/**
 * Servicio de notificaciones con soporte para SSE (Server-Sent Events)
 * Permite enviar notificaciones persistentes y en tiempo real
 */
class NotificationService extends EventEmitter {
  // Map de clientes SSE conectados: userId -> Set<EventEmitter>
  private sseClients: Map<string, Set<EventEmitter>> = new Map();

  constructor(private readonly notificationRepository: NotificationRepository) {
    super();
  }

  /**
   * Enviar notificación a un usuario (persiste en BD y emite evento SSE)
   */
  async sendNotification(
    userId: string,
    payload: SendNotificationPayload
  ): Promise<INotification> {
    try {
      // 1. Persistir en base de datos
      const notification = await this.notificationRepository.create({
        userId: userId as any, // Se convertirá a ObjectId en el repository
        title: payload.title,
        message: payload.message,
        type: payload.type,
        metadata: payload.metadata || {},
        isRead: false,
      });

      logger.info(`Notificación creada para usuario ${userId}: ${payload.title}`);

      // 2. Emitir evento SSE a clientes conectados
      const clients = this.sseClients.get(userId);
      if (clients && clients.size > 0) {
        const eventData = {
          id: notification._id?.toString(),
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
          isRead: notification.isRead,
        };

        clients.forEach((client) => {
          if (client instanceof EventEmitter) {
            client.emit('notification', eventData);
          }
        });

        logger.info(
          `Notificación SSE enviada a ${clients.size} cliente(s) del usuario ${userId}`
        );
      }

      return notification;
    } catch (error) {
      logger.error(
        `Error enviando notificación a usuario ${userId}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Obtener notificaciones paginadas de un usuario
   */
  async getNotifications(
    userId: string,
    params: GetNotificationsParams
  ): Promise<NotificationsPaginated> {
    return this.notificationRepository.findByUserId(userId, params);
  }

  /**
   * Contar notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnreadByUserId(userId);
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification | null> {
    const notification = await this.notificationRepository.markAsRead(notificationId, userId);

    if (notification) {
      // Emitir evento de actualización a clientes SSE
      const clients = this.sseClients.get(userId);
      if (clients) {
        clients.forEach((client) => {
          client.emit('notification-read', { notificationId });
        });
      }
    }

    return notification;
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.notificationRepository.markAllAsRead(userId);

    if (count > 0) {
      // Emitir evento de actualización masiva
      const clients = this.sseClients.get(userId);
      if (clients) {
        clients.forEach((client) => {
          client.emit('all-read', { count });
        });
      }
    }

    return count;
  }

  /**
   * Eliminar notificación
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    return this.notificationRepository.delete(notificationId, userId);
  }

  /**
   * Registrar un cliente SSE para recibir notificaciones en tiempo real
   */
  registerSSEClient(userId: string, client: EventEmitter): void {
    if (!this.sseClients.has(userId)) {
      this.sseClients.set(userId, new Set());
    }
    this.sseClients.get(userId)!.add(client);

    logger.info(
      `Cliente SSE registrado para usuario ${userId}. Total: ${this.sseClients.get(userId)!.size}`
    );
  }

  /**
   * Desregistrar un cliente SSE
   */
  unregisterSSEClient(userId: string, client: EventEmitter): void {
    const clients = this.sseClients.get(userId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.sseClients.delete(userId);
      }
      logger.info(`Cliente SSE desregistrado para usuario ${userId}`);
    }
  }

  /**
   * Obtener número de clientes SSE conectados para un usuario
   */
  getConnectedClientsCount(userId: string): number {
    return this.sseClients.get(userId)?.size || 0;
  }
}

export default NotificationService;
