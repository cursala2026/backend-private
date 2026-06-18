import mongoose, { Schema, model } from 'mongoose';

export interface IUserMongo {
  id: string;
  name: string;
  email: string;
  courses: string[];
  notifiedOnNoCourse?: Date;
  notifiedOnCourseStart?: Date;
  roles?: string[];
}

export interface IRecommendedCourse {
  name: string;
  img: string;
  description: string;
  duration: number;
  level: string;
}

export interface ICourseStart {
  id: string;
  userId: string;
  courseName: string;
  userName: string;
  email: string;
  startDate: Date;
}

const UserSchema = new Schema<IUserMongo>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  courses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  notifiedOnNoCourse: { type: Date },
  notifiedOnCourseStart: { type: Date },
  roles: [{ type: String }]
});

export const UserModel = mongoose.models.User || model<IUserMongo>('User', UserSchema, 'users');
