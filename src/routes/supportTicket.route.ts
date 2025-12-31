import { Router } from 'express';
import { supportTicketController } from '@/controllers';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';

const router = Router();

// =====================================
// RUTAS DE USUARIO (autenticadas)
// =====================================

// POST /support-tickets - Crear nuevo ticket
router.post('/', authorize, supportTicketController.createTicket);

// GET /support-tickets/my-tickets - Obtener mis tickets
router.get('/my-tickets', authorize, supportTicketController.getMyTickets);

// =====================================
// RUTAS DE ADMIN (autenticadas + admin)
// =====================================

// GET /support-tickets/stats - Estadísticas de tickets (admin)
router.get('/stats', authorize, requireAdmin, supportTicketController.getStats);

// GET /support-tickets - Obtener todos los tickets (admin)
router.get('/', authorize, requireAdmin, supportTicketController.getAllTickets);

// GET /support-tickets/:id - Obtener ticket por ID (admin o dueño)
router.get('/:id', authorize, supportTicketController.getTicketById);

// PATCH /support-tickets/:id/resolve - Marcar como resuelto (admin)
router.patch('/:id/resolve', authorize, requireAdmin, supportTicketController.resolveTicket);

// PATCH /support-tickets/:id/status - Actualizar estado (admin)
router.patch('/:id/status', authorize, requireAdmin, supportTicketController.updateStatus);

// PATCH /support-tickets/:id/notes - Actualizar notas (admin)
router.patch('/:id/notes', authorize, requireAdmin, supportTicketController.updateNotes);

// DELETE /support-tickets/:id - Eliminar ticket (admin)
router.delete('/:id', authorize, requireAdmin, supportTicketController.deleteTicket);

export default router;
