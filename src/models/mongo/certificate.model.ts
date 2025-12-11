import { Schema, model, ObjectId } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICertificate {
  _id: ObjectId;
  certificateId: string;
  verificationCode: string;
  studentId: ObjectId;
  courseId: ObjectId;
  teacherId: ObjectId;
  generatedAt: Date;
  generatedBy: ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CertificateSchema: Schema<ICertificate> = new Schema<ICertificate>(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CERT-${uuidv4()}`,
    },
    verificationCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice compuesto para evitar certificados duplicados por estudiante-curso
CertificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

// Índices simples para búsquedas
CertificateSchema.index({ courseId: 1 });
CertificateSchema.index({ studentId: 1 });

const Certificate = model<ICertificate>('Certificate', CertificateSchema, 'certificates');
export { Certificate };

// Document type for repositories
export type CertificateDoc = import('mongoose').HydratedDocument<ICertificate>;
