import { Schema, model, ObjectId } from 'mongoose';

// Enum para estados de pago de MercadoPago
export enum MercadoPagoPaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  AUTHORIZED = 'authorized',
  IN_PROCESS = 'in_process',
  IN_MEDIATION = 'in_mediation',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  CHARGED_BACK = 'charged_back',
}

// Interface para pagos de MercadoPago
export interface IMercadoPagoPayment {
  _id?: ObjectId;

  // Datos de MercadoPago
  paymentId: string; // ID único del pago en MercadoPago
  preferenceId?: string; // ID de la preferencia creada
  merchantOrderId?: string; // ID de la orden del comerciante
  externalReference: string; // Referencia externa (course_id_timestamp)

  // Estado del pago
  status: MercadoPagoPaymentStatus;
  statusDetail?: string; // Detalle específico del estado

  // Información financiera
  transactionAmount: number; // Monto de la transacción
  currencyId: string; // Moneda (ej: ARS)

  // Información del curso
  courseId: ObjectId | string;
  courseName: string;

  // Información del estudiante
  studentEmail: string;
  studentFirstName?: string;
  studentLastName?: string;

  // Información del pagador (desde MercadoPago)
  payerEmail?: string;
  payerId?: string;

  // Información de método de pago
  paymentMethodId?: string; // visa, mastercard, etc.
  paymentTypeId?: string; // credit_card, debit_card, etc.

  // Fechas importantes
  dateCreated?: Date; // Fecha de creación en MercadoPago
  dateApproved?: Date; // Fecha de aprobación
  dateProcessed?: Date; // Fecha de procesamiento en nuestro sistema

  // Información adicional
  installments?: number; // Cuotas
  issuerName?: string; // Banco emisor

  // Control interno
  isProcessed: boolean; // Si ya fue procesado por webhook
  accessGranted: boolean; // Si ya se otorgó acceso al curso
  accessGrantedAt?: Date;

  // Webhook data
  webhookReceived?: boolean;
  webhookProcessedAt?: Date;

  // Metadatos
  deviceId?: string; // Device fingerprinting
  userAgent?: string; // Browser info
  ipAddress?: string; // IP del usuario
}

export interface MercadoPagoPaymentModel extends IMercadoPagoPayment {}

// Schema para pagos de MercadoPago
export const MercadoPagoPaymentSchema: Schema<MercadoPagoPaymentModel> = new Schema<MercadoPagoPaymentModel>(
  {
    // Datos de MercadoPago
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    preferenceId: {
      type: String,
      index: true,
    },
    merchantOrderId: {
      type: String,
      index: true,
    },
    externalReference: {
      type: String,
      required: true,
      index: true,
    },

    // Estado del pago
    status: {
      type: String,
      enum: Object.values(MercadoPagoPaymentStatus),
      required: true,
      index: true,
    },
    statusDetail: {
      type: String,
    },

    // Información financiera
    transactionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currencyId: {
      type: String,
      default: 'ARS',
    },

    // Información del curso
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Course',
      index: true,
    },
    courseName: {
      type: String,
      required: true,
    },

    // Información del estudiante
    studentEmail: {
      type: String,
      required: true,
      index: true,
      match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    studentFirstName: {
      type: String,
    },
    studentLastName: {
      type: String,
    },

    // Información del pagador (desde MercadoPago)
    payerEmail: {
      type: String,
    },
    payerId: {
      type: String,
    },

    // Información de método de pago
    paymentMethodId: {
      type: String,
    },
    paymentTypeId: {
      type: String,
    },

    // Fechas importantes
    dateCreated: {
      type: Date,
    },
    dateApproved: {
      type: Date,
    },
    dateProcessed: {
      type: Date,
    },

    // Información adicional
    installments: {
      type: Number,
      min: 1,
      max: 24,
    },
    issuerName: {
      type: String,
    },

    // Control interno
    isProcessed: {
      type: Boolean,
      default: false,
      index: true,
    },
    accessGranted: {
      type: Boolean,
      default: false,
      index: true,
    },
    accessGrantedAt: {
      type: Date,
    },

    // Webhook data
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookProcessedAt: {
      type: Date,
    },

    // Metadatos
    deviceId: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índices compuestos para consultas eficientes
MercadoPagoPaymentSchema.index({ courseId: 1, studentEmail: 1 });
MercadoPagoPaymentSchema.index({ status: 1, isProcessed: 1 });
MercadoPagoPaymentSchema.index({ externalReference: 1, status: 1 });

const MercadoPagoPayment = model<MercadoPagoPaymentModel>(
  'MercadoPagoPayment',
  MercadoPagoPaymentSchema,
  'mercadoPagoPayments'
);
export { MercadoPagoPayment };
