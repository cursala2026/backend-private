import { Schema, model, ObjectId } from 'mongoose';

// Interfaces for the Questionnaire model
export interface IQuestionOption {
  _id?: ObjectId;
  text: string;
  order: number;
}

export interface IQuestion {
  _id?: ObjectId;
  type: 'MULTIPLE_CHOICE' | 'TEXT';
  questionText: string;
  order: number;
  points: number;
  required: boolean;
  // Solo para MULTIPLE_CHOICE
  options?: IQuestionOption[];
  correctOptionId?: ObjectId;
}

export interface IQuestionnairePosition {
  type: 'BETWEEN_CLASSES' | 'FINAL_EXAM';
  afterClassId?: ObjectId; // Required if type is BETWEEN_CLASSES
}

export interface IQuestionnaire {
  _id?: ObjectId;
  courseId: ObjectId;
  title: string;
  description?: string;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'DRAFT'
  position: IQuestionnairePosition;
  questions: IQuestion[];
  passingScore?: number; // 0-100
  allowRetries: boolean;
  maxRetries?: number; // null = unlimited retries
  showCorrectAnswers: boolean;
  createdBy: ObjectId; // Reference to User (professor)
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
      enum: ['MULTIPLE_CHOICE', 'TEXT'],
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
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
