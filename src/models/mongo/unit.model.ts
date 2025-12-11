import { Document, Schema } from 'mongoose';
import { Types } from '@/models';

interface IUnit {
  name: string;
  abbreviation: string;
  conversionFactor: number;
  _id: Types.ObjectId;
}

interface IUnits extends Document {
  group: string;
  baseUnit: string;
  units: IUnit[];
}

const UnitSchema: Schema<IUnit> = new Schema<IUnit>({
  name: { type: String, required: true },
  abbreviation: { type: String, required: true },
  conversionFactor: { type: Number, required: true },
  _id: { type: Schema.Types.ObjectId, required: true },
});

const UnitsSchema: Schema<IUnits> = new Schema<IUnits>(
  {
    group: { type: String, required: true },
    baseUnit: { type: String, required: true },
    units: { type: [UnitSchema], required: true },
  },
  { timestamps: true }
);

export { IUnit, IUnits, UnitsSchema };

export interface IUnitresponse {
  baseUnit: string;
  units: IUnit[];
}
