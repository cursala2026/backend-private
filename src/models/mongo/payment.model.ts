import { Schema, model, ObjectId } from 'mongoose';

// Defining payment request status enum
export enum PaymentRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Interface for the payment request model
export interface IPaymentRequest {
  _id?: ObjectId;
  courseId: ObjectId | string;
  courseName: string;
  coursePrice: number;
  finalPrice?: number; // Price after discount (if promotional code applied)
  studentName: string;
  studentEmail: string;
  paymentTicket: string; // File path or URL to the uploaded payment proof
  comments?: string;
  modality?: string;
  startDate?: string | Date;
  days?: string[];
  time?: string;
  status: string;
  reviewedBy?: ObjectId | string;
  reviewNotes?: string;
  accessGrantedAt?: Date;
  accessExpiresAt?: Date; // Based on your 3-month access policy

  // Promotional code fields
  promotionalCodeApplied?: boolean;
  promotionalCode?: string;
  discountAmount?: number;
  discountType?: string; // PERCENTAGE or FIXED_AMOUNT
}

export interface PaymentRequestModel extends IPaymentRequest {}

// Schema definition for payment requests
export const PaymentRequestSchema: Schema<PaymentRequestModel> = new Schema<PaymentRequestModel>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Course',
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    coursePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      required: true,
      trim: true,
      match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    paymentTicket: {
      type: String,
      required: true,
    },
    comments: {
      type: String,
      trim: true,
    },
    modality: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    days: {
      type: [String],
    },
    time: {
      type: String,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    status: {
      type: String,
      enum: Object.values(PaymentRequestStatus),
      default: PaymentRequestStatus.PENDING,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    accessGrantedAt: {
      type: Date,
    },
    accessExpiresAt: {
      type: Date,
    },

    // Promotional code fields
    promotionalCodeApplied: {
      type: Boolean,
      default: false,
    },
    promotionalCode: {
      type: String,
      trim: true,
    },
    discountAmount: {
      type: Number,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PaymentRequest = model<PaymentRequestModel>('PaymentRequest', PaymentRequestSchema, 'paymentRequests');
export { PaymentRequest };
