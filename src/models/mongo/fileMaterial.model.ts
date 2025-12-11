import { Schema, model, ObjectId } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { UserStatus } from '../enums';

export enum FileMaterialType {
  TEMPLATE = 'template',
  EDUCATIONAL_MATERIAL = 'educational_material',
  SUPPORT_DOCUMENT = 'support_document',
}

export enum FileMaterialCategory {
  WORD = 'word',
  EXCEL = 'excel',
  PDF = 'pdf',
  POWERPOINT = 'powerpoint',
  IMAGE = 'image',
  OTHER = 'other',
}

export interface IFileMaterial {
  _id: ObjectId;
  name: string;
  description?: string;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  type: FileMaterialType;
  category: FileMaterialCategory;
  isPublic: boolean;
  downloadCount: number;
  uploadedBy: ObjectId;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const FileMaterialSchema: Schema<IFileMaterial> = new Schema<IFileMaterial>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(FileMaterialType),
      required: true,
      default: FileMaterialType.EDUCATIONAL_MATERIAL,
    },
    category: {
      type: String,
      enum: Object.values(FileMaterialCategory),
      required: true,
      default: FileMaterialCategory.OTHER,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Índices para optimizar consultas
FileMaterialSchema.index({ status: 1, type: 1 });
FileMaterialSchema.index({ category: 1, status: 1 });
FileMaterialSchema.index({ isPublic: 1, status: 1 });
FileMaterialSchema.index({ uploadedBy: 1 });
FileMaterialSchema.index({ createdAt: -1 });

// Plugin de paginación
FileMaterialSchema.plugin(mongoosePaginate);

export const FileMaterialMongo = model<IFileMaterial>('FileMaterial', FileMaterialSchema);

// Document type for repositories
export type FileMaterialDoc = import('mongoose').HydratedDocument<IFileMaterial>;
