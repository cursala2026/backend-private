import { Schema, model } from 'mongoose';
import { Types } from '@/models';
import { UserStatus } from './enums';

export interface IAssignedCourseEdit {
  courseId: Types.ObjectId;
}

export interface IUser {
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
  assignedCoursesEdit?: IAssignedCourseEdit[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
  // Implementación Issue #15
  hasCompletedInterestsForm: boolean;
  interests: Types.ObjectId[];
  interestsSuggestions?: string;
}

export interface UserModel extends IUser { }

export const AssignedCoursesEditSchema = new Schema<IAssignedCourseEdit>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  },
  { _id: false }
);

export const UserSchema: Schema<UserModel> = new Schema<UserModel>(
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
    roles: [{ type: String }],
    resetPasswordToken: String,
    assignedCoursesEdit: [AssignedCoursesEditSchema],
    lastConnection: { type: Date, required: false, default: Date.now },
    professionalDescription: { type: String, required: false },
    profilePhotoUrl: { type: String, required: false },
    professionalSignatureUrl: { type: String, required: false },
    
    // UBICACIÓN CORRECTA ISSUE #15
    hasCompletedInterestsForm: { 
      type: Boolean, 
      default: false 
    },
    interests: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Course' 
    }],
    interestsSuggestions: { 
      type: String, 
      required: false 
    },
  },
  { timestamps: true }
);

export const User = model<UserModel>('User', UserSchema, 'users');