import { Schema, model } from 'mongoose';
import { Types } from '@/models';

// Interfaces for the Questionnaire model
export interface IQuestionOption {
  _id?: Types.ObjectId;
  text: string;
  order: number;
}

export interface IQuestion {
  _id?: Types.ObjectId;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TEXT';
  // Texto breve del enunciado (para `promptType: 'TEXT'`) — se mantiene por compatibilidad
  questionText: string;
  // Tipo de enunciado/prompt: texto, imagen o video (imágenes/videos gestionados por Bunny)
  promptType?: 'TEXT' | 'IMAGE' | 'VIDEO';
  // URL del media cuando `promptType` es IMAGE o VIDEO (p. ej. URL de Bunny)
  promptMediaUrl?: string;
  // Proveedor de media (opcional). Actualmente soportado: 'BUNNY'
  promptMediaProvider?: 'BUNNY';
  // Estado de la subida de media: 'ready' | 'processing' | 'error'
  mediaUploadStatus?: 'ready' | 'processing' | 'error';
  // Nombre original del archivo de media
  mediaOriginalName?: string;
  order: number;
  points: number;
  required: boolean;
  // Solo para MULTIPLE_CHOICE
  options?: IQuestionOption[];
  // Nota: soportamos múltiples respuestas correctas
  // `correctOptionIds` es preferible; `correctOptionId` queda por compatibilidad
  correctOptionIds?: Types.ObjectId[];
  correctOptionId?: Types.ObjectId;
}

export interface IQuestionnairePosition {
  type: 'BETWEEN_CLASSES' | 'FINAL_EXAM';
  afterClassId?: Types.ObjectId; // Required if type is BETWEEN_CLASSES
}

export interface IQuestionnaire {
  _id?: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  description?: string;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'DRAFT'
  position: IQuestionnairePosition;
  questions: IQuestion[];
  passingScore?: number; // 0-100
  allowRetries: boolean;
  maxRetries?: number; // null = unlimited retries
  showCorrectAnswers: boolean;
  timeLimitMinutes?: number; // Tiempo límite en minutos para resolver el cuestionario (opcional)
  createdBy: Types.ObjectId; // Reference to User (professor)
  isSurvey: boolean; 
}

export interface QuestionnaireModel extends IQuestionnaire {}

// Schema for Question Option
const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

// Schema for Question
const QuestionSchema = new Schema<IQuestion>(
  {
    type: {
      type: String,
      required: true,
      enum: ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TEXT'],
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Prompt type and media URL for image/video prompts
    promptType: {
      type: String,
      required: false,
      enum: ['TEXT', 'IMAGE', 'VIDEO'],
      default: 'TEXT',
    },
    promptMediaUrl: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    promptMediaProvider: {
      type: String,
      required: false,
      enum: ['BUNNY'],
    },
    mediaUploadStatus: {
      type: String,
      enum: ['ready', 'processing', 'error'],
      default: 'ready',
      required: false,
    },
    mediaOriginalName: {
      type: String,
      required: false,
      trim: true,
      maxlength: 500,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
    },
    required: {
      type: Boolean,
      required: true,
      default: true,
    },
    // Only for MULTIPLE_CHOICE
    options: {
      type: [QuestionOptionSchema],
      required: false,
    },
    correctOptionIds: {
      type: [Schema.Types.ObjectId],
      required: false,
    },
    correctOptionId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
  },
  { _id: true }
);

// Schema for Position
const PositionSchema = new Schema<IQuestionnairePosition>(
  {
    type: {
      type: String,
      required: true,
      enum: ['BETWEEN_CLASSES', 'FINAL_EXAM'],
    },
    afterClassId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: false,
    },
  },
  { _id: false }
);

// Main Questionnaire Schema
export const QuestionnaireSchema: Schema<QuestionnaireModel> = new Schema<QuestionnaireModel>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INACTIVE', 'DRAFT'],
      default: 'ACTIVE',
    },
    position: {
      type: PositionSchema,
      required: true,
    },
    questions: {
      type: [QuestionSchema],
      required: true,
      validate: {
        validator(v: IQuestion[]) {
          return v && v.length > 0;
        },
        message: 'At least one question is required',
      },
    },
    passingScore: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
    },
    allowRetries: {
      type: Boolean,
      required: true,
      default: true,
    },
    maxRetries: {
      type: Number,
      required: false,
      min: 1,
    },
    showCorrectAnswers: {
      type: Boolean,
      required: true,
      default: true,
    },
    timeLimitMinutes: {
      type: Number,
      required: false,
      min: 1,
      max: 1440, // Máximo 24 horas (1440 minutos)
    },
    isSurvey: { 
      type: Boolean, 
      required: true,
      default: false 
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create indexes for better performance
QuestionnaireSchema.index({ courseId: 1, status: 1 });
QuestionnaireSchema.index({ createdBy: 1 });
QuestionnaireSchema.index({ 'position.afterClassId': 1 });

const Questionnaire = model<QuestionnaireModel>('Questionnaire', QuestionnaireSchema, 'questionnaires');
export { Questionnaire };

// Document type for repositories
export type QuestionnaireDoc = import('mongoose').HydratedDocument<IQuestionnaire>;
