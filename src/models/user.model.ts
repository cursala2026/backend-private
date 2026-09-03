import mongoose, { Schema, model } from 'mongoose';
import { Types } from '@/models';
import { UserRoles, UserStatus, TeacherStatus } from './enums';

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
  roles: UserRoles;
  resetPasswordToken: string;
  assignedCoursesEdit?: IAssignedCourseEdit[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
  signedContractUrl?: string;
  // Implementación Issue #15
  hasCompletedInterestsForm: boolean;
  interests: Types.ObjectId[];
  interestsSuggestions?: string;
  //Implementación Issue #53
  teacherStatus: TeacherStatus;
  title: string;
  yearsOfExperience: number;
  bio: string;
  photoUrl: string;
  cvUrl: string;
  signatureUrl: string;
  agreementAccepted: boolean;
  agreementTimestamp?: Date;
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
    roles: { type: String, enum: Object.values(UserRoles), required: true },
    resetPasswordToken: String,
    assignedCoursesEdit: [AssignedCoursesEditSchema],
    lastConnection: { type: Date, required: false, default: Date.now },
    professionalDescription: { type: String, required: false },
    profilePhotoUrl: { type: String, required: false },
    professionalSignatureUrl: { type: String, required: false },
    signedContractUrl: { type: String, required: false },
    
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

    // ISSUE #53
    teacherStatus: { type: String, enum: Object.values(TeacherStatus), default: TeacherStatus.NOT_REQUESTED },
    title: { type: String, required: true },
    yearsOfExperience: { type: Number, min: 0, required: true },
    bio: { type: String, maxlength: 500, required: true },
    photoUrl: { type: String, required: true },
    cvUrl: { type: String, required: true },
    signatureUrl: { type: String, required: true },
    agreementAccepted: { type: Boolean, default: false },
    agreementTimestamp: { type: Date, validate: { validator: function (this: any, value: Date) { if (this.agreementAccepted && !value) {return false; } return true; }, message: 'agreementTimestamp is required if agreementAccepted is true', }, },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || model<UserModel>('User', UserSchema, 'users');