import { Schema, ObjectId } from 'mongoose';
import generalConnection from '@/config/databases';
import { UserStatus } from '../enums';

export interface IClass {
  title: string;
  status: string;
  imageUrl?: string;
}

export interface ICourse {
  _id: ObjectId;
  name: string;
  description?: string;
  longDescription?: string;
  status: string;
  order: number;
  imageUrl?: string;
  classes: IClass[];
  students?: ObjectId[]; // Array de estudiantes inscritos
  meta?: {
    totalClasses: number;
    popularity: number;
  };
  days?: string[];
  time?: string;
  startDate?: Date;
  registrationOpenDate?: Date; // Fecha de apertura de inscripciones
  modality?: string;
  price?: number;
  programUrl?: string;
  maxInstallments: number;
  interestFree: boolean;
  showOnHome?: boolean;
  mainTeacher?: ObjectId; // Mantener para compatibilidad, pero usar teachers
  teachers?: ObjectId[]; // Array de profesores (1-3)
  numberOfClasses?: number;
  duration?: number; // Duración del curso en horas
  isPublished?: boolean; // Switch de publicación
}

export interface CourseModel extends ICourse {}

const ClassSchema = new Schema<IClass>(
  {
    title: { type: String, required: true },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    imageUrl: { type: String, match: /\.(jpg|jpeg|png|webp)$/i },
  },
  { _id: false }
);

export const CourseSchema: Schema<CourseModel> = new Schema<CourseModel>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    longDescription: { type: String },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    order: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, match: /\.(jpg|jpeg|png|webp)$/i },
    classes: {
      type: [ClassSchema],
      default: [],
    },
    students: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    meta: {
      totalClasses: { type: Number, default: 0 },
      popularity: { type: Number, min: 0, max: 5, default: 0 },
    },
    days: { type: [String] },
    time: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    startDate: { type: Date },
    registrationOpenDate: { type: Date }, // Fecha de apertura de inscripciones
    modality: { type: String },
    price: { type: Number, min: 0 },
    programUrl: { type: String, match: /\.pdf$/i },
    maxInstallments: { type: Number, min: 1 },
    interestFree: { type: Boolean },
    showOnHome: { type: Boolean, default: false },
    mainTeacher: { type: Schema.Types.ObjectId, ref: 'User' }, // Mantener para compatibilidad
    teachers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      validate: {
        validator: function(teachers: ObjectId[]) {
          return teachers.length >= 1 && teachers.length <= 3;
        },
        message: 'El curso debe tener entre 1 y 3 profesores asignados'
      }
    },
    numberOfClasses: { type: Number, min: 1 },
    duration: { type: Number, min: 0.5 }, // Duración del curso en horas
    isPublished: { type: Boolean, default: true }, // Por defecto publicado
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Course = generalConnection.model<CourseModel>('Course', CourseSchema, 'courses');
export { Course };
