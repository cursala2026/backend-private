import { Schema, model } from 'mongoose';
import generalConnection from '@/config/databases';

export interface IClassProgress {
  classId: Schema.Types.ObjectId;
  watchTime: number; // Tiempo en segundos donde se quedó
  duration: number; // Duración total del video en segundos
  completed: boolean;
  completedAt?: Date;
  lastWatchedAt: Date;
}

export interface ICourseProgress {
  userId: Schema.Types.ObjectId;
  courseId: Schema.Types.ObjectId;
  classesProgress: IClassProgress[];
  currentClassId?: Schema.Types.ObjectId; // Última clase que estaba viendo
  overallProgress: number; // Porcentaje de progreso general (0-100)
  startedAt: Date;
  lastAccessedAt: Date;
}

const ClassProgressSchema = new Schema<IClassProgress>(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    watchTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

export const CourseProgressSchema = new Schema<ICourseProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    classesProgress: {
      type: [ClassProgressSchema],
      default: [],
    },
    currentClassId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
    },
    overallProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para búsquedas rápidas por usuario y curso
CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const CourseProgressModel = generalConnection.model<ICourseProgress>(
  'CourseProgress',
  CourseProgressSchema
);
