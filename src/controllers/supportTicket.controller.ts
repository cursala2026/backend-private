import { Request, Response, NextFunction } from 'express';
import SupportTicketService from '@/services/supportTicket.service';
import { logger, prepareResponse } from '@/utils';
import { IUser } from '@/models/user.model';
import { TicketStatus } from '@/models/mongo/supportTicket.model';

class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  /**
   * POST /support-tickets
   * Crear un nuevo ticket de soporte (usuario)
   */
  createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const { subject, message } = req.body;

      if (!subject || !message) {
        res.status(400).json(prepareResponse(400, 'El asunto y el mensaje son requeridos'));
        return;
      }

      const ticket = await this.supportTicketService.createTicket({
        userId: user._id.toString(),
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        subject,
        message,
      });

      res.json(prepareResponse(201, 'Ticket de soporte creado exitosamente', ticket));
    } catch (error) {
      logger.error(`Error creando ticket de soporte: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /support-tickets/my-tickets
   * Obtener tickets del usuario actual
   */
  getMyTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const userId = user._id.toString();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as TicketStatus | undefined;

      const result = await this.supportTicketService.getUserTickets(userId, {
        page,
        limit,
        status,
      });

      res.json(
        prepareResponse(200, 'Tickets obtenidos exitosamente', result.data, result.pagination)
      );
    } catch (error) {
      logger.error(`Error obteniendo tickets del usuario: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /support-tickets (admin)
   * Obtener todos los tickets
   */
  getAllTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as TicketStatus | undefined;

      const result = await this.supportTicketService.getAllTickets({
        page,
        limit,
        status,
      });

      res.json(
        prepareResponse(200, 'Tickets obtenidos exitosamente', result.data, result.pagination)
      );
    } catch (error) {
      logger.error(`Error obteniendo todos los tickets: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /support-tickets/:id
   * Obtener un ticket por ID
   */
  getTicketById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const ticket = await this.supportTicketService.getTicketById(id);

      if (!ticket) {
        res.status(404).json(prepareResponse(404, 'Ticket no encontrado'));
        return;
      }

      res.json(prepareResponse(200, 'Ticket obtenido exitosamente', ticket));
    } catch (error) {
      logger.error(`Error obteniendo ticket: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * PATCH /support-tickets/:id/resolve (admin)
   * Marcar ticket como resuelto
   */
  resolveTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as IUser;
      const { id } = req.params;
      const { adminNotes } = req.body;

      const ticket = await this.supportTicketService.resolveTicket(
        id,
        user._id.toString(),
        adminNotes
      );

      if (!ticket) {
        res.status(404).json(prepareResponse(404, 'Ticket no encontrado'));
        return;
      }

      res.json(prepareResponse(200, 'Ticket marcado como resuelto', ticket));
    } catch (error) {
      logger.error(`Error resolviendo ticket: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * PATCH /support-tickets/:id/status (admin)
   * Actualizar estado del ticket
   */
  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !Object.values(TicketStatus).includes(status)) {
        res.status(400).json(prepareResponse(400, 'Estado inválido'));
        return;
      }

      const ticket = await this.supportTicketService.updateTicketStatus(id, status);

      if (!ticket) {
        res.status(404).json(prepareResponse(404, 'Ticket no encontrado'));
        return;
      }

      res.json(prepareResponse(200, 'Estado del ticket actualizado', ticket));
    } catch (error) {
      logger.error(`Error actualizando estado del ticket: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * PATCH /support-tickets/:id/notes (admin)
   * Actualizar notas de admin
   */
  updateNotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;

      if (!adminNotes) {
        res.status(400).json(prepareResponse(400, 'Las notas del admin son requeridas'));
        return;
      }

      const ticket = await this.supportTicketService.updateAdminNotes(id, adminNotes);

      if (!ticket) {
        res.status(404).json(prepareResponse(404, 'Ticket no encontrado'));
        return;
      }

      res.json(prepareResponse(200, 'Notas actualizadas exitosamente', ticket));
    } catch (error) {
      logger.error(`Error actualizando notas del ticket: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * GET /support-tickets/stats (admin)
   * Obtener estadísticas de tickets
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.supportTicketService.getStats();

      res.json(prepareResponse(200, 'Estadísticas obtenidas exitosamente', stats));
    } catch (error) {
      logger.error(`Error obteniendo estadísticas: ${(error as Error).message}`);
      next(error);
    }
  };

  /**
   * DELETE /support-tickets/:id (admin)
   * Eliminar ticket
   */
  deleteTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const deleted = await this.supportTicketService.deleteTicket(id);

      if (!deleted) {
        res.status(404).json(prepareResponse(404, 'Ticket no encontrado'));
        return;
      }

      res.json(prepareResponse(200, 'Ticket eliminado exitosamente'));
    } catch (error) {
      logger.error(`Error eliminando ticket: ${(error as Error).message}`);
      next(error);
    }
  };
}

export default SupportTicketController;
