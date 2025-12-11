import { Document, Schema } from 'mongoose';
import { Types } from '@/models';
import { ObjectId } from './genericMongo.model';

interface ISale extends Document {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  courseName: string;
  coursePrice: number;
  studentName: string;
  studentEmail: string;
  comments: string;
  modality: string;
  startDate: Date;
  days: string[];
  time: string;
}

const SaleSchema: Schema<ISale> = new Schema<ISale>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseName: { type: String, required: true },
    coursePrice: { type: Number, required: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    comments: { type: String, default: '' },
    modality: { type: String, required: true },
    startDate: { type: Date, required: true },
    days: { type: [String], required: true },
    time: { type: String, required: true },
  },
  { timestamps: true }
);

export { ISale, SaleSchema };
