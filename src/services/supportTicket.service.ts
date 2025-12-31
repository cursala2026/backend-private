import { logger } from '@/utils';
import SupportTicketRepository, {
  GetTicketsParams,
  TicketsPaginated,
} from '@/repositories/supportTicket.repository';
import { ISupportTicket, TicketStatus } from '@/models/mongo/supportTicket.model';

export interface CreateTicketPayload {
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
}

class SupportTicketService {
  constructor(private readonly supportTicketRepository: SupportTicketRepository) {}

  /**
   * Crear un nuevo ticket de soporte
   */
  async createTicket(payload: CreateTicketPayload): Promise<ISupportTicket> {
    try {
      const ticket = await this.supportTicketRepository.create({
        userId: payload.userId as any,
        userEmail: payload.userEmail,
        userName: payload.userName,
        subject: payload.subject,
        message: payload.message,
        status: TicketStatus.PENDING,
      });

      logger.info(`Ticket de soporte creado: ${ticket._id} por usuario ${payload.userId}`);

      return ticket;
    } catch (error) {
      logger.error(`Error creando ticket de soporte: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Obtener tickets del usuario
   */
  async getUserTickets(userId: string, params: GetTicketsParams): Promise<TicketsPaginated> {
    return this.supportTicketRepository.findByUserId(userId, params);
  }

  /**
   * Obtener todos los tickets (admin)
   */
  async getAllTickets(params: GetTicketsParams): Promise<TicketsPaginated> {
    return this.supportTicketRepository.findAll(params);
  }

  /**
   * Obtener ticket por ID
   */
  async getTicketById(ticketId: string): Promise<ISupportTicket | null> {
    return this.supportTicketRepository.findById(ticketId);
  }

  /**
   * Marcar ticket como resuelto
   */
  async resolveTicket(
    ticketId: string,
    resolvedBy: string,
    adminNotes?: string
  ): Promise<ISupportTicket | null> {
    const ticket = await this.supportTicketRepository.markAsResolved(
      ticketId,
      resolvedBy,
      adminNotes
    );

    if (ticket) {
      logger.info(`Ticket ${ticketId} marcado como resuelto por admin ${resolvedBy}`);
    }

    return ticket;
  }

  /**
   * Actualizar estado del ticket
   */
  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<ISupportTicket | null> {
    const ticket = await this.supportTicketRepository.updateStatus(ticketId, status);

    if (ticket) {
      logger.info(`Estado del ticket ${ticketId} actualizado a ${status}`);
    }

    return ticket;
  }

  /**
   * Actualizar notas de admin
   */
  async updateAdminNotes(ticketId: string, adminNotes: string): Promise<ISupportTicket | null> {
    return this.supportTicketRepository.updateAdminNotes(ticketId, adminNotes);
  }

  /**
   * Obtener estadísticas de tickets
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
  }> {
    return this.supportTicketRepository.getStats();
  }

  /**
   * Eliminar ticket (solo admin)
   */
  async deleteTicket(ticketId: string): Promise<boolean> {
    const deleted = await this.supportTicketRepository.delete(ticketId);

    if (deleted) {
      logger.info(`Ticket ${ticketId} eliminado`);
    }

    return deleted;
  }
}

export default SupportTicketService;
