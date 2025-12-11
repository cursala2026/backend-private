import { Connection } from 'mongoose';
import { Model } from '@/models';
import { logger, maskSensitiveFields } from '../utils';
import {
  IMercadoPagoPayment,
  MercadoPagoPaymentStatus,
  MercadoPagoPaymentSchema,
} from '@/models/mongo/mercadoPago.model';

export default class MercadoPagoRepository {
  private readonly model: Model<IMercadoPagoPayment>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IMercadoPagoPayment>(
      'MercadoPagoPayment',
      MercadoPagoPaymentSchema,
      'mercadoPagoPayments'
    );
  }

  /**
   * Crea un nuevo registro de pago de MercadoPago
   */
  async createPayment(paymentData: Partial<IMercadoPagoPayment>): Promise<IMercadoPagoPayment> {
    try {
      const savedPayment = await this.model.create(paymentData as Partial<IMercadoPagoPayment>);
      const saved = savedPayment as unknown as IMercadoPagoPayment;

      logger.info('MercadoPago payment created in database', {
        paymentId: saved.paymentId,
        courseId: saved.courseId,
        studentEmail: saved.studentEmail,
        amount: saved.transactionAmount,
      });

      return saved;
    } catch (error) {
      logger.error('Error creating MercadoPago payment', {
        error: (error as Error).message,
        paymentData: maskSensitiveFields(paymentData),
      });
      throw error;
    }
  }

  /**
   * Busca un pago por ID de MercadoPago
   */
  async findByPaymentId(paymentId: string): Promise<IMercadoPagoPayment | null> {
    try {
      const res = await this.model.findOne({ paymentId }).exec();
      return res as unknown as IMercadoPagoPayment | null;
    } catch (error) {
      logger.error('Error finding payment by paymentId', {
        paymentId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Busca un pago por referencia externa
   */
  async findByExternalReference(externalReference: string): Promise<IMercadoPagoPayment | null> {
    try {
      const res = await this.model.findOne({ externalReference }).exec();
      return res as unknown as IMercadoPagoPayment | null;
    } catch (error) {
      logger.error('Error finding payment by external reference', {
        externalReference,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Actualiza el estado de un pago
   */
  async updatePaymentStatus(
    paymentId: string,
    status: MercadoPagoPaymentStatus,
    additionalData?: Partial<IMercadoPagoPayment>
  ): Promise<IMercadoPagoPayment | null> {
    try {
      const updateData: Partial<IMercadoPagoPayment> = {
        status,
        ...additionalData,
      };

      // Si el pago es aprobado, marcar fecha de aprobación
      if (status === MercadoPagoPaymentStatus.APPROVED) {
        updateData.dateApproved = new Date();
      }

      const updatedPayment = await this.model
        .findOneAndUpdate({ paymentId }, { $set: updateData }, { new: true })
        .exec();

      const res = updatedPayment as unknown as IMercadoPagoPayment | null;

      if (res) {
        logger.info('Payment status updated', {
          paymentId,
          oldStatus: status,
          newStatus: res.status,
        });
      }

      return res;
    } catch (error) {
      logger.error('Error updating payment status', {
        paymentId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Marca un pago como procesado
   */
  async markAsProcessed(paymentId: string): Promise<IMercadoPagoPayment | null> {
    try {
      const res = await this.model
        .findOneAndUpdate(
          { paymentId },
          {
            $set: {
              isProcessed: true,
              dateProcessed: new Date(),
            },
          },
          { new: true }
        )
        .exec();

      return res as unknown as IMercadoPagoPayment | null;
    } catch (error) {
      logger.error('Error marking payment as processed', {
        paymentId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Marca un pago con acceso otorgado
   */
  async grantAccess(paymentId: string): Promise<IMercadoPagoPayment | null> {
    try {
      const res = await this.model
        .findOneAndUpdate(
          { paymentId },
          {
            $set: {
              accessGranted: true,
              accessGrantedAt: new Date(),
            },
          },
          { new: true }
        )
        .exec();

      return res as unknown as IMercadoPagoPayment | null;
    } catch (error) {
      logger.error('Error granting access for payment', {
        paymentId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Obtiene todos los pagos de un estudiante
   */
  async getPaymentsByStudent(studentEmail: string): Promise<IMercadoPagoPayment[]> {
    try {
      const res = await this.model.find({ studentEmail }).sort({ createdAt: -1 }).exec();
      return res as unknown as IMercadoPagoPayment[];
    } catch (error) {
      logger.error('Error getting payments by student', {
        studentEmail,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Obtiene todos los pagos de un curso
   */
  async getPaymentsByCourse(courseId: string): Promise<IMercadoPagoPayment[]> {
    try {
      const res = await this.model.find({ courseId }).sort({ createdAt: -1 }).exec();
      return res as unknown as IMercadoPagoPayment[];
    } catch (error) {
      logger.error('Error getting payments by course', {
        courseId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Obtiene pagos pendientes de procesar
   */
  async getPendingPayments(): Promise<IMercadoPagoPayment[]> {
    try {
      const res = await this.model
        .find({
          status: MercadoPagoPaymentStatus.APPROVED,
          isProcessed: false,
        })
        .sort({ createdAt: 1 })
        .exec();

      return res as unknown as IMercadoPagoPayment[];
    } catch (error) {
      logger.error('Error getting pending payments', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de pagos
   */
  async getPaymentStats(): Promise<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    totalAmount: number;
  }> {
    try {
      const stats = await this.model.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ['$status', MercadoPagoPaymentStatus.APPROVED] }, 1, 0],
              },
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ['$status', MercadoPagoPaymentStatus.PENDING] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ['$status', MercadoPagoPaymentStatus.REJECTED] }, 1, 0],
              },
            },
            totalAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', MercadoPagoPaymentStatus.APPROVED] }, '$transactionAmount', 0],
              },
            },
          },
        },
      ]).exec();

      const s = (stats as unknown[])[0] as unknown as {
        total: number;
        approved: number;
        pending: number;
        rejected: number;
        totalAmount: number;
      };

      return (
        s || {
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          totalAmount: 0,
        }
      );
    } catch (error) {
      logger.error('Error getting payment stats', {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
