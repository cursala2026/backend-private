import { Document, Schema } from 'mongoose';

interface IBusinessTraining extends Document {
  name: string;
  email: string;
  phoneNumber: string;
  message: string;
}

const BusinessTrainingSchema: Schema<IBusinessTraining> = new Schema<IBusinessTraining>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export { IBusinessTraining, BusinessTrainingSchema };
