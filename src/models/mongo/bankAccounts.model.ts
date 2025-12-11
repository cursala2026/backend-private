import { Schema, model, ObjectId } from 'mongoose';

// Interface for the bank account model
export interface IBankAccount {
  _id?: ObjectId;
  cbu: string;
  alias: string;
}

export interface BankAccountModel extends IBankAccount {}

// Schema definition for bank accounts
export const BankAccountSchema: Schema<BankAccountModel> = new Schema<BankAccountModel>(
  {
    cbu: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    alias: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const BankAccount = model<BankAccountModel>('BankAccount', BankAccountSchema, 'bankAccounts');
export { BankAccount };
