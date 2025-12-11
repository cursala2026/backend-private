import { IUser } from '../models/user.model';

// Extended User interface with additional fields that exist in the local User model
export interface IUserExtended extends IUser {
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
}
