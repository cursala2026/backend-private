import mongoose, { Schema, Document } from 'mongoose';
import generalConnection from '@/config/databases';

export interface IAdminVerificationCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  action: string; // Puede ser un ID de ruta: e.g. "POST:/api/v1/file-materials"
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
  metadata?: {
    formType?: string;
    targetId?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

const AdminVerificationCodeSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      length: 6,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL para auto-eliminar documentos expirados
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    metadata: {
      formType: String,
      targetId: String,
      userAgent: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true,
    collection: 'admin_verification_codes',
  }
);

// Índices compuestos para optimizar consultas
AdminVerificationCodeSchema.index({ userId: 1, code: 1 });
AdminVerificationCodeSchema.index({ userId: 1, action: 1, isUsed: 1 });
// Nota: índice expiresAt ya está definido en el campo con TTL

export default generalConnection.model<IAdminVerificationCode>(
  'AdminVerificationCode',
  AdminVerificationCodeSchema,
  'admin_verification_codes'
);
