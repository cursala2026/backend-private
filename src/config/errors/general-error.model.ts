import Error from './error.model';

export interface GeneralError {
  errors: Error[];
  status: number;
  message: string;
}
