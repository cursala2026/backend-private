import { Schema, ObjectId } from 'mongoose';
import generalConnection from '@/config/databases';
import { UserStatus } from '../enums';

export interface IClass {
  title: string;
  status: string;
  imageUrl?: string;
  imageOriginalName?: string;
}

export interface IEnrolledStudent {
  userId: ObjectId;
  enrolledAt: Date;
  enrollmentType: 'MANUAL' | 'SELF'; // MANUAL = asignado por admin, SELF = auto-inscripción
  startDate?: Date; // Fecha de inicio del alumno (para cursos con cohorts)
  endDate?: Date; // Fecha de fin del alumno (para cursos con cohorts)
}

export interface ICourse {
  _id: ObjectId;
  name: string;
  /**
   * Campo `category` almacenado como string JSON con los campos { id, name, description }
   * Ejemplo: '{"id":"603...","name":"Marketing","description":"Cursos de marketing"}'
   */
  category?: string | null;
  description?: string;
  longDescription?: string;
  status: string;
  order: number;
  imageUrl?: string;
  imageOriginalName?: string; // Added original image filename
  classes: IClass[];
  questionnaires?: any[]; // Cuestionarios del curso (populated via lookup)
  orderedContent?: any[]; // Array ordenado de clases y cuestionarios intercalados
  students?: IEnrolledStudent[]; // Array de estudiantes inscritos con metadata
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
  programOriginalName?: string; // Added original program PDF filename
  pdfSynced?: boolean; // Campo para indicar si el PDF está sincronizado
  maxInstallments: number;
  interestFree: boolean;
  showOnHome?: boolean;
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
    imageOriginalName: { type: String, trim: true }, // Added schema for original image filename
  },
  { _id: false }
);

const EnrolledStudentSchema = new Schema<IEnrolledStudent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    enrolledAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    enrollmentType: {
      type: String,
      required: true,
      enum: ['MANUAL', 'SELF'],
      default: 'SELF',
    },
    startDate: {
      type: Date,
      required: false,
    },
    endDate: {
      type: Date,
      required: false,
    },
  },
  { _id: false }
);

export const CourseSchema: Schema<CourseModel> = new Schema<CourseModel>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    // Category stored as JSON string with only id, name and description
    category: { type: String },
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
      type: [EnrolledStudentSchema],
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
    programOriginalName: { type: String, trim: true }, // Added schema for original program PDF filename
    pdfSynced: { type: Boolean, default: false }, // Campo para indicar si el PDF está sincronizado
    maxInstallments: { type: Number, min: 1 },
    interestFree: { type: Boolean },
    showOnHome: { type: Boolean, default: false },
    teachers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      // Nota: Se removió la validación que obligaba entre 1 y 3 profesores
      // para permitir crear cursos sin profesores o con cualquier cantidad.
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
