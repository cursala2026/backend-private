import { BankAccountSchema, IBankAccount, BankAccountModel, Connection, Model, Types } from '@/models';

class BankAccountRepository {
  private readonly model: Model<BankAccountModel>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<BankAccountModel>('BankAccount', BankAccountSchema, 'bankAccounts');
  }

  /**
   * Retrieves all bank accounts from the database
   * @returns Array of bank accounts
   */
  async getBankAccounts(): Promise<IBankAccount[]> {
    return this.model.find({});
  }

  /**
   * Updates a bank account with partial data
   * @param id Bank account ID
   * @param updateData Partial data to update (cbu and/or alias)
   * @returns Updated bank account
   */
  async updateBankAccount(
    id: string,
    updateData: Partial<Pick<IBankAccount, 'cbu' | 'alias'>>
  ): Promise<IBankAccount | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('The provided bank account ID is not valid.');
    }

    return this.model.findByIdAndUpdate(id, updateData, { new: true });
  }
}

export default BankAccountRepository;
