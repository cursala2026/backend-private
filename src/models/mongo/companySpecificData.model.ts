import { Schema, model, Document } from 'mongoose';
import { Types } from '@/models';

export interface ICompanySpecificData extends Document {
  _id: Types.ObjectId;
  privacyPolicy: string;
  termsOfService: string;
  certificateLogos: string[];
}

const DEFAULT_PRIVACY_POLICY = 'Esta es la política de privacidad por defecto.';
export const DEFAULT_TERMS_OF_SERVICE = 'Estos son los términos de servicio por defecto.';

export const CompanySpecificDataSchema: Schema<ICompanySpecificData> = new Schema<ICompanySpecificData>(
  {
    privacyPolicy: {
      type: String,
      required: true,
      default: DEFAULT_PRIVACY_POLICY,
      trim: true,
    },
    termsOfService: {
      type: String,
      default: DEFAULT_TERMS_OF_SERVICE,
      trim: true,
    },
    certificateLogos: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 6,
        message: 'El certificado puede contener un máximo de 6 logos',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const CompanySpecificData = model<ICompanySpecificData>(
  'CompanySpecificData',
  CompanySpecificDataSchema,
  'companySpecificData'
);

export { CompanySpecificData };
