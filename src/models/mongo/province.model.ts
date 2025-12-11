import { Document, Schema } from 'mongoose';
import { PolygonSchema, IPolygon } from '../geometry.model';

interface IProvince extends Document {
  name: string;
  geometry: IPolygon;
}

const ProvinceSchema: Schema<IProvince> = new Schema<IProvince>(
  {
    name: { type: String, required: true },
    geometry: { type: PolygonSchema, required: true },
  },
  { timestamps: true }
);

export { IProvince, ProvinceSchema };
