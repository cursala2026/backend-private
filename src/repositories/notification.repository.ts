import { NotificationSchema, INotification, NotificationModel } from '@/models/mongo/notification.model';
import { Connection, Model, Types } from '@/models';

export interface GetNotificationsParams {
  page: number;
  limit: number;
  includeRead?: boolean;
}

export interface NotificationsPaginated {
  data: INotification[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    totalPages: number;
  };
}

class NotificationRepository {
  private readonly model: Model<INotification>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<INotification>(
      'Notification',
      NotificationSchema,
      'notifications'
    );
  }

  /**
   * Crear una nueva notificación
   */
  async create(notificationData: Partial<INotification>): Promise<INotification> {
    const notification = await this.model.create(notificationData as Partial<INotification>);
    return notification as unknown as INotification;
  }

  /**
   * Obtener notificaciones de un usuario con paginación
   */
  async findByUserId(
    userId: string,
    params: GetNotificationsParams
  ): Promise<NotificationsPaginated> {
    const { page, limit, includeRead = true } = params;
    const skip = (page - 1) * limit;

    // Construir filtro
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (!includeRead) {
      filter.isRead = false;
    }

    // Obtener total
    const total = await this.model.countDocuments(filter as any).exec();

    // Obtener notificaciones paginadas (ordenadas por más reciente)
    const notifications = await this.model
      .find(filter as any)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return {
      data: notifications as unknown as INotification[],
      pagination: {
        page,
        page_size: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Contar notificaciones no leídas de un usuario
   */
  async countUnreadByUserId(userId: string): Promise<number> {
    return this.model
      .countDocuments({
        userId: new Types.ObjectId(userId),
        isRead: false,
      } as any)
      .exec();
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification | null> {
    const notification = await this.model
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId), // Seguridad: solo el dueño puede marcar
        } as any,
        { $set: { isRead: true } },
        { new: true }
      )
      .lean()
      .exec();

    return notification as unknown as INotification | null;
  }

  /**
   * Marcar todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.model
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          isRead: false,
        } as any,
        { $set: { isRead: true } }
      )
      .exec();

    return result.modifiedCount;
  }

  /**
   * Eliminar una notificación
   */
  async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.model
      .deleteOne({
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId), // Seguridad: solo el dueño puede eliminar
      } as any)
      .exec();

    return result.deletedCount > 0;
  }

  /**
   * Buscar una notificación por ID (con verificación de propietario)
   */
  async findById(notificationId: string, userId: string): Promise<INotification | null> {
    const notification = await this.model
      .findOne({
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      } as any)
      .lean()
      .exec();

    return notification as unknown as INotification | null;
  }

  /**
   * Eliminar todas las notificaciones leídas de un usuario
   */
  async deleteAllRead(userId: string): Promise<number> {
    const result = await this.model
      .deleteMany({
        userId: new Types.ObjectId(userId),
        isRead: true,
      } as any)
      .exec();

    return result.deletedCount;
  }
}

export default NotificationRepository;
