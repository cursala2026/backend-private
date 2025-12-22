import { Document, Schema, model } from 'mongoose';

interface Role extends Document {
  name: string;
  description: string;
  code: string;
}

interface RoleModel extends Role, Document {}

const RoleSchema: Schema<RoleModel> = new Schema<RoleModel>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    code: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const Role = model<RoleModel>('Role', RoleSchema, 'roles');

export { Role, RoleModel, RoleSchema };
