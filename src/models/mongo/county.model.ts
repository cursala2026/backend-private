import { Document, Schema } from 'mongoose';
import { IPoint, PointSchema } from '../geometry.model';

interface ICountry extends Document {
  name: string;
  geometry: IPoint;
}

const CountrySchema: Schema<ICountry> = new Schema<ICountry>(
  {
    name: { type: String, required: true },
    geometry: { type: PointSchema, required: true },
  },
  { timestamps: true }
);

export { ICountry, CountrySchema };
