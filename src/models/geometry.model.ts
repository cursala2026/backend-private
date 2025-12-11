import { Schema, Document } from 'mongoose';

export interface IPolygon extends Document {
  type: 'Polygon';
  coordinates: number[][][];
}

export const PolygonSchema: Schema<IPolygon> = new Schema<IPolygon>(
  {
    type: { type: String, enum: ['Polygon'], required: true },
    coordinates: { type: [[[Number]]], required: true },
  },
  { _id: false }
);

export interface IPoint extends Document {
  type: 'Point';
  coordinates: [number, number];
}

export const PointSchema: Schema<IPoint> = new Schema<IPoint>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);
