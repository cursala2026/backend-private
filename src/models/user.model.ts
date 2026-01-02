import { Schema, model } from 'mongoose';
import { Types } from '@/models';
import { UserStatus } from './enums';

interface IAssignedCourse {
  courseId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
}

interface IAssignedCourseEdit {
  courseId: Types.ObjectId;
}

interface IUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: Date;
  dni?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
  resetPasswordToken: string;
  assignedCourses?: IAssignedCourse[];
  assignedCoursesEdit?: IAssignedCourseEdit[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
}

interface UserModel extends IUser { }

const AssignedCourseSchema = new Schema<IAssignedCourse>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { _id: false }
);
const AssignedCoursesEditSchema = new Schema<IAssignedCourseEdit>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  },
  { _id: false }
);

const UserSchema: Schema<UserModel> = new Schema<UserModel>(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: false },
    birthDate: { type: Date, required: false },
    dni: { type: String, required: false },
    status: { type: String, enum: Object.values(UserStatus) },
    // Roles ahora se almacenan como códigos string (e.g. 'ADMIN','ALUMNO')
    roles: [{ type: String }],
    resetPasswordToken: String,
    assignedCourses: [AssignedCourseSchema],
    assignedCoursesEdit: [AssignedCoursesEditSchema],
    lastConnection: { type: Date, required: false, default: Date.now },
    professionalDescription: { type: String, required: false },
    profilePhotoUrl: { type: String, required: false },
    professionalSignatureUrl: { type: String, required: false },
  },
  { timestamps: true }
);

const User = model<UserModel>('User', UserSchema, 'users');

export {
  User,
  IUser,
  UserModel,
  IAssignedCourseEdit,
  UserSchema,
  AssignedCourseSchema,
  IAssignedCourse,
  AssignedCoursesEditSchema,
};
