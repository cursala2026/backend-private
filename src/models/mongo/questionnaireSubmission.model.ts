import { Schema, model } from 'mongoose';
import { ObjectId } from '@/models';

// Interface for Answer
export interface IAnswer {
  questionId: ObjectId;
  questionType: 'MULTIPLE_CHOICE' | 'TEXT';
  // Soportar selección múltiple en frontend/backend
  selectedOptionIds?: ObjectId[];
  selectedOptionId?: ObjectId; // For backward compatibility (single selection)
  textAnswer?: string; // For text questions
  isCorrect?: boolean; // Auto-graded for MC
  pointsAwarded?: number; // Graded points
  feedback?: string; // Professor feedback on text answers
}

// Interface for Questionnaire Submission
export interface IQuestionnaireSubmission {
  _id?: ObjectId;
  questionnaireId: ObjectId;
  courseId: ObjectId; // Denormalized for easier queries
  studentId: ObjectId;
  studentName?: string; // Denormalized for easier queries
  studentEmail?: string; // Denormalized for easier queries
  profilePhotoUrl?: string; // Denormalized for easier queries
  attemptNumber: number;
  answers: IAnswer[];

  // Grading status
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  autoGradedScore: number; // 0-100 (multiple choice)
  manualGradedScore?: number; // 0-100 (text)
  finalScore?: number; // 0-100 (combined)

  // Grading metadata
  gradedBy?: ObjectId; // Professor who graded text questions
  gradedAt?: Date;
  feedback?: string; // Overall feedback from professor

  // Timestamps
  startedAt: Date;
  submittedAt?: Date;
}

export interface QuestionnaireSubmissionModel extends IQuestionnaireSubmission {}

// Schema for Answer
const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    questionType: {
      type: String,
      required: true,
      enum: ['MULTIPLE_CHOICE', 'TEXT'],
    },
    selectedOptionId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    selectedOptionIds: {
      type: [Schema.Types.ObjectId],
      required: false,
    },
    textAnswer: {
      type: String,
      required: false,
      trim: true,
      maxlength: 5000,
    },
    isCorrect: {
      type: Boolean,
      required: false,
    },
    pointsAwarded: {
      type: Number,
      required: false,
      min: 0,
    },
    feedback: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

// Main QuestionnaireSubmission Schema
export const QuestionnaireSubmissionSchema: Schema<QuestionnaireSubmissionModel> = new Schema<QuestionnaireSubmissionModel>(
  {
    questionnaireId: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: {
      type: String,
      required: false,
    },
    studentEmail: {
      type: String,
      required: false,
    },
    profilePhotoUrl: {
      type: String,
      required: false,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    answers: {
      type: [AnswerSchema],
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ['IN_PROGRESS', 'SUBMITTED', 'GRADED'],
      default: 'IN_PROGRESS',
    },
    autoGradedScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    manualGradedScore: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
    },
    finalScore: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
    },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    gradedAt: {
      type: Date,
      required: false,
    },
    feedback: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create indexes for better performance
QuestionnaireSubmissionSchema.index({ questionnaireId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });
QuestionnaireSubmissionSchema.index({ studentId: 1, status: 1 });
QuestionnaireSubmissionSchema.index({ questionnaireId: 1, status: 1 });
QuestionnaireSubmissionSchema.index({ courseId: 1, studentId: 1 });

const QuestionnaireSubmission = model<QuestionnaireSubmissionModel>(
  'QuestionnaireSubmission',
  QuestionnaireSubmissionSchema,
  'questionnaireSubmissions'
);
export { QuestionnaireSubmission };

// Document type for repositories
export type QuestionnaireSubmissionDoc = import('mongoose').HydratedDocument<IQuestionnaireSubmission>;
