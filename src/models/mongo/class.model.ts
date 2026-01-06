import { Schema, model } from 'mongoose';
import { UserStatus } from '../enums';
import { Types } from '@/models';

export interface IClassData {
  name: string;
  description?: string;
  status: string;
  order: number;
  imageUrl?: string;
  videoUrl?: string;
  videoOriginalName?: string;
  videoStatus?: string;
  courseId: Types.ObjectId;
  supportMaterials?: string[];
  meta?: {
    views: number;
    duration: string;
  };
  linkLive?: string;
  examConfig?: {
    examLink: string;
    examVisible: boolean;
    examStartDate: Date;
    examEndDate: Date;
  };
}

export const ClassSchema: Schema<IClassData> = new Schema<IClassData>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
      validate: {
        validator(v: string) {
          if (!v) return true;
          // Aceptar URLs de Bunny CDN o archivos con extensiones de imagen
          return /^https?:\/\/.+/.test(v) || /\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Image URL must be a valid URL or end with a valid image extension',
      },
    },
    videoUrl: {
      type: String,
      validate: {
        validator(v: string) {
          if (!v) return true;
          // Aceptar cualquier URL válida (incluyendo Bunny CDN) o archivos con extensiones de video
          return /^https?:\/\/.+/.test(v) || /\.(mp4|mov|avi|mkv)$/i.test(v);
        },
        message: 'Video URL must be a valid URL or end with a valid video extension',
      },
    },
    videoOriginalName: {
      type: String,
      required: false,
    },
    videoStatus: {
      type: String,
      enum: ['ready', 'processing', 'error'],
      default: 'ready',
      required: false,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    supportMaterials: {
      type: [String],
      required: false,
    },
    meta: {
      views: {
        type: Number,
        default: 0,
      },
      duration: {
        type: String,
        match: /^\d{1,2}:\d{2}$/,
        default: '00:00',
      },
    },
    linkLive: {
      type: String,
      required: false,
    },
    examConfig: {
      examLink: {
        type: String,
        required: false,
        validate: {
          validator(v: string) {
            if (!v) return true; // Allow empty values
            return /^https?:\/\/.+/.test(v);
          },
          message: 'Exam link must be a valid URL',
        },
      },
      examVisible: {
        type: Boolean,
        default: false,
      },
      examStartDate: {
        type: Date,
        required: false,
      },
      examEndDate: {
        type: Date,
        required: false,
        validate: {
          validator(this: IClassData, v: Date) {
            if (!v || !this.examConfig?.examStartDate) return true;
            return v > this.examConfig.examStartDate;
          },
          message: 'Exam end date must be after start date',
        },
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ClassSchema.index({ status: 1 });
ClassSchema.index({ courseId: 1 });
ClassSchema.index({ order: 1 });

const ClassModel = model<IClassData>('Class', ClassSchema, 'classes');
export { ClassModel };

// Document type for repositories
export type ClassDoc = import('mongoose').HydratedDocument<IClassData>;
