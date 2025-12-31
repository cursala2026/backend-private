import { SupportTicketSchema, ISupportTicket, TicketStatus } from '@/models/mongo/supportTicket.model';
import { Connection, Model, Types } from '@/models';

export interface GetTicketsParams {
  page: number;
  limit: number;
  status?: TicketStatus;
}

export interface TicketsPaginated {
  data: ISupportTicket[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    totalPages: number;
  };
}

class SupportTicketRepository {
  private readonly model: Model<ISupportTicket>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<ISupportTicket>(
      'SupportTicket',
      SupportTicketSchema,
      'supporttickets'
    );
  }

  /**
   * Crear un nuevo ticket de soporte
   */
  async create(ticketData: Partial<ISupportTicket>): Promise<ISupportTicket> {
    const ticket = await this.model.create(ticketData as Partial<ISupportTicket>);
    return ticket as unknown as ISupportTicket;
  }

  /**
   * Obtener tickets del usuario con paginación
   */
  async findByUserId(userId: string, params: GetTicketsParams): Promise<TicketsPaginated> {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const filter: any = { userId: new Types.ObjectId(userId) };
    if (status) {
      filter.status = status;
    }

    const total = await this.model.countDocuments(filter as any).exec();

    const tickets = await this.model
      .find(filter as any)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return {
      data: tickets as unknown as ISupportTicket[],
      pagination: {
        page,
        page_size: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener todos los tickets (para admin) con paginación
   */
  async findAll(params: GetTicketsParams): Promise<TicketsPaginated> {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const total = await this.model.countDocuments(filter as any).exec();

    const tickets = await this.model
      .find(filter as any)
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return {
      data: tickets as unknown as ISupportTicket[],
      pagination: {
        page,
        page_size: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar ticket por ID
   */
  async findById(ticketId: string): Promise<ISupportTicket | null> {
    const ticket = await this.model
      .findById(new Types.ObjectId(ticketId))
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName')
      .lean()
      .exec();

    return ticket as unknown as ISupportTicket | null;
  }

  /**
   * Marcar ticket como resuelto
   */
  async markAsResolved(
    ticketId: string,
    resolvedBy: string,
    adminNotes?: string
  ): Promise<ISupportTicket | null> {
    const ticket = await this.model
      .findByIdAndUpdate(
        new Types.ObjectId(ticketId),
        {
          $set: {
            status: TicketStatus.RESOLVED,
            resolvedBy: new Types.ObjectId(resolvedBy),
            resolvedAt: new Date(),
            ...(adminNotes && { adminNotes }),
          },
        },
        { new: true }
      )
      .lean()
      .exec();

    return ticket as unknown as ISupportTicket | null;
  }

  /**
   * Actualizar estado del ticket
   */
  async updateStatus(ticketId: string, status: TicketStatus): Promise<ISupportTicket | null> {
    const ticket = await this.model
      .findByIdAndUpdate(
        new Types.ObjectId(ticketId),
        { $set: { status } },
        { new: true }
      )
      .lean()
      .exec();

    return ticket as unknown as ISupportTicket | null;
  }

  /**
   * Actualizar notas de admin
   */
  async updateAdminNotes(ticketId: string, adminNotes: string): Promise<ISupportTicket | null> {
    const ticket = await this.model
      .findByIdAndUpdate(
        new Types.ObjectId(ticketId),
        { $set: { adminNotes } },
        { new: true }
      )
      .lean()
      .exec();

    return ticket as unknown as ISupportTicket | null;
  }

  /**
   * Contar tickets por estado
   */
  async countByStatus(status: TicketStatus): Promise<number> {
    return this.model.countDocuments({ status } as any).exec();
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
    const [total, pending, inProgress, resolved] = await Promise.all([
      this.model.countDocuments({} as any).exec(),
      this.model.countDocuments({ status: TicketStatus.PENDING } as any).exec(),
      this.model.countDocuments({ status: TicketStatus.IN_PROGRESS } as any).exec(),
      this.model.countDocuments({ status: TicketStatus.RESOLVED } as any).exec(),
    ]);

    return { total, pending, inProgress, resolved };
  }

  /**
   * Eliminar ticket (solo admin)
   */
  async delete(ticketId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: new Types.ObjectId(ticketId) } as any).exec();
    return result.deletedCount > 0;
  }
}

export default SupportTicketRepository;
