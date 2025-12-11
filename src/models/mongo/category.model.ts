import { Schema, model, ObjectId } from 'mongoose';
import { UserStatus } from '../enums';

interface ICategory {
  _id: ObjectId;
  name: string;
  description?: string;
  status: UserStatus;
  order: number;
  imageUrl?: string;
  courses: ObjectId[];
  meta?: {
    totalCourses: number;
    popularity: number;
  };
}

interface CategoryModel extends ICategory {}

export const CategorySchema: Schema<CategoryModel> = new Schema<CategoryModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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
      match: /\.(jpg|jpeg|png|webp)$/i,
    },
    courses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    meta: {
      totalCourses: {
        type: Number,
        default: 0,
      },
      popularity: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Category = model<CategoryModel>('Category', CategorySchema, 'categories');

export { Category, ICategory, CategoryModel };
