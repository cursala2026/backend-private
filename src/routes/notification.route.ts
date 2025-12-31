import { Router } from 'express';
import { notificationController } from '@/controllers';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
// Orden: rutas específicas antes que dinámicas

// GET /notifications - Obtener notificaciones del usuario actual (paginadas)
router.get('/', authorize, notificationController.getNotifications);

// GET /notifications/unread-count - Contar notificaciones no leídas
router.get('/unread-count', authorize, notificationController.getUnreadCount);

// GET /notifications/stream - Stream SSE de notificaciones en tiempo real
router.get('/stream', authorize, notificationController.streamNotifications);

// PATCH /notifications/:id/read - Marcar notificación como leída
router.patch('/:id/read', authorize, notificationController.markAsRead);

// PATCH /notifications/read-all - Marcar todas como leídas
router.patch('/read-all', authorize, notificationController.markAllAsRead);

// DELETE /notifications/:id - Eliminar notificación
router.delete('/:id', authorize, notificationController.deleteNotification);

export default router;
