import { PaymentRequestSchema, IPaymentRequest, Connection, Model, Types } from '@/models';

class PaymentRepository {
  private readonly model: Model<IPaymentRequest>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IPaymentRequest>('PaymentRequest', PaymentRequestSchema, 'paymentRequests');
  }

  /**
   * Creates a new payment request in the database
   * @param paymentData Payment request data including course and student information
   * @returns The created payment request
   */
  async submitPayment(paymentData: Partial<IPaymentRequest>): Promise<IPaymentRequest> {
    // Validate courseId if provided
    if (paymentData.courseId && !Types.ObjectId.isValid(paymentData.courseId.toString())) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    // Create the payment request
    const created = await this.model.create(paymentData as Partial<IPaymentRequest>);
    return created as unknown as IPaymentRequest;
  }
}

export default PaymentRepository;
