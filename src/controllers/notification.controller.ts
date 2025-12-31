import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import NotificationService from '@/services/notification.service';
import { logger, prepareResponse } from '@/utils';
import { IUser } from '@/models/user.model';

class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Obtener notificaciones del usuario actual con paginación
   */
  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();

      // Parámetros de paginación
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const includeRead = req.query.includeRead !== 'false'; // Por defecto true

      const result = await this.notificationService.getNotifications(userId, {
        page,
        limit,
        includeRead,
      });

      res.json(
        prepareResponse(
          200,
          'Notificaciones obtenidas exitosamente',
          result.data,
          result.pagination
        )
      );
    } catch (error) {
      logger.error(`Error obteniendo notificaciones: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /notifications/unread-count
   * Obtener contador de notificaciones no leídas
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();

      const count = await this.notificationService.getUnreadCount(userId);

      res.json(prepareResponse(200, 'Contador obtenido exitosamente', { unreadCount: count }));
    } catch (error) {
      logger.error(`Error obteniendo contador de no leídas: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * PATCH /notifications/:id/read
   * Marcar notificación como leída
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();
      const { id } = req.params;

      const notification = await this.notificationService.markAsRead(id, userId);

      if (!notification) {
        res
          .status(404)
          .json(
            prepareResponse(404, 'Notificación no encontrada o no tienes permiso para modificarla')
          );
        return;
      }

      res.json(prepareResponse(200, 'Notificación marcada como leída', notification));
    } catch (error) {
      logger.error(`Error marcando notificación como leída: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * PATCH /notifications/read-all
   * Marcar todas las notificaciones como leídas
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();

      const count = await this.notificationService.markAllAsRead(userId);

      res.json(prepareResponse(200, `${count} notificaciones marcadas como leídas`, { count }));
    } catch (error) {
      logger.error(`Error marcando todas como leídas: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * DELETE /notifications/:id
   * Eliminar notificación
   */
  deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();
      const { id } = req.params;

      const deleted = await this.notificationService.deleteNotification(id, userId);

      if (!deleted) {
        res
          .status(404)
          .json(
            prepareResponse(404, 'Notificación no encontrada o no tienes permiso para eliminarla')
          );
        return;
      }

      res.json(prepareResponse(200, 'Notificación eliminada exitosamente'));
    } catch (error) {
      logger.error(`Error eliminando notificación: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /notifications/stream
   * Endpoint SSE para recibir notificaciones en tiempo real
   */
  streamNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();

      // Configurar headers SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en nginx

      // Crear EventEmitter para este cliente
      const clientEmitter = new EventEmitter();

      // Registrar cliente en el servicio
      this.notificationService.registerSSEClient(userId, clientEmitter);

      // Enviar mensaje inicial de conexión
      res.write(`:connected\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Escuchar eventos de notificación
      const notificationHandler = (data: any) => {
        if (!res.writableEnded) {
          const eventData = JSON.stringify(data);
          res.write(`event: notification\ndata: ${eventData}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      const readHandler = (data: any) => {
        if (!res.writableEnded) {
          const eventData = JSON.stringify(data);
          res.write(`event: read\ndata: ${eventData}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      const allReadHandler = (data: any) => {
        if (!res.writableEnded) {
          const eventData = JSON.stringify(data);
          res.write(`event: all-read\ndata: ${eventData}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      clientEmitter.on('notification', notificationHandler);
      clientEmitter.on('notification-read', readHandler);
      clientEmitter.on('all-read', allReadHandler);

      // Cleanup al desconectar
      const cleanup = () => {
        clientEmitter.removeListener('notification', notificationHandler);
        clientEmitter.removeListener('notification-read', readHandler);
        clientEmitter.removeListener('all-read', allReadHandler);
        this.notificationService.unregisterSSEClient(userId, clientEmitter);
        res.end();
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);

      // Heartbeat cada 30 segundos para mantener conexión
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`:heartbeat\n\n`);
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeatInterval);
      });
    } catch (error) {
      logger.error(`Error en stream de notificaciones: ${(error as Error).message}`);
      next(error);
    }
  };
}

export default NotificationController;
