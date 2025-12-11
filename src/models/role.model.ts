import { Document, Schema, model } from 'mongoose';

interface Role extends Document {
  name: string;
  description: string;
  code: string;
  features: Schema.Types.ObjectId[];
}

interface RoleModel extends Role, Document {}

const RoleSchema: Schema<RoleModel> = new Schema<RoleModel>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    features: [{ type: Schema.Types.ObjectId, ref: 'Feature' }],
  },
  { timestamps: true }
);

const Role = model<RoleModel>('Role', RoleSchema, 'roles');

export { Role, RoleModel, RoleSchema };
