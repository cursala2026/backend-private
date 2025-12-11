import { Document, Schema } from 'mongoose';
import { Types } from '@/models';
import { IPoint, PointSchema } from '../geometry.model';
import { ObjectId } from './genericMongo.model';

interface ICity extends Document {
  _id: Types.ObjectId;
  name: string;
  municipality: Schema.Types.ObjectId;
  geometry: IPoint;
}

const CitySchema: Schema<ICity> = new Schema<ICity>(
  {
    name: { type: String, required: true },
    municipality: { type: Schema.Types.ObjectId, ref: 'Municipality', required: true },
    geometry: { type: PointSchema, required: true },
  },
  { timestamps: true }
);

export { ICity, CitySchema };
