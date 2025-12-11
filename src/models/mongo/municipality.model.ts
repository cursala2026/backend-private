import { Document, Schema } from 'mongoose';
import { PolygonSchema, IPolygon } from '../geometry.model';
import { ObjectId } from './genericMongo.model';

interface IMunicipality extends Document {
  name: string;
  province: ObjectId;
  geometry: IPolygon;
}

const MunicipalitySchema: Schema<IMunicipality> = new Schema<IMunicipality>(
  {
    name: { type: String, required: true },
    province: { type: Schema.Types.ObjectId, ref: 'Province', required: true },
    geometry: { type: PolygonSchema, required: true },
  },
  { timestamps: true }
);

export { IMunicipality, MunicipalitySchema };
