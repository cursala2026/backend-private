import { Schema, model, ObjectId } from 'mongoose';

export enum TicketStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface ISupportTicket {
  _id?: ObjectId;
  userId: Schema.Types.ObjectId;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority?: TicketPriority;
  resolvedBy?: Schema.Types.ObjectId;
  resolvedAt?: Date;
  adminNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SupportTicketModel extends ISupportTicket {}

export const SupportTicketSchema: Schema<SupportTicketModel> = new Schema<SupportTicketModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice compuesto para consultas frecuentes
SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ userId: 1, createdAt: -1 });

const SupportTicket = model<SupportTicketModel>(
  'SupportTicket',
  SupportTicketSchema,
  'supporttickets'
);

export { SupportTicket };
