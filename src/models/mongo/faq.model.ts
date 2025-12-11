import { Schema, model, ObjectId } from 'mongoose';

// Interface for the FAQ model
export interface IFAQ {
  _id?: ObjectId;
  question: string;
  answer: string;
  category?: string;
  isActive: boolean;
  order: number;
}

export interface FAQModel extends IFAQ {}

// Schema definition for FAQs
export const FAQSchema: Schema<FAQModel> = new Schema<FAQModel>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
      default: 'General',
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create indexes for better performance
FAQSchema.index({ category: 1, order: 1 });
FAQSchema.index({ isActive: 1 });

const FAQ = model<FAQModel>('FAQ', FAQSchema, 'faqs');
export { FAQ };
