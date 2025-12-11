import { IBankAccount } from '@/models';
import BankAccountRepository from '@/repositories/bankAccount.repository';

class BankAccountService {
  constructor(private readonly bankAccountRepository: BankAccountRepository) {}

  /**
   * Retrieves all bank accounts
   * @returns Array of bank accounts
   */
  async getAllBankAccounts(): Promise<IBankAccount[]> {
    try {
      return await this.bankAccountRepository.getBankAccounts();
    } catch (error) {
      throw new Error(`Error retrieving bank accounts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates a bank account with CBU and/or alias
   * @param id Bank account ID
   * @param updateData Partial data to update (cbu and/or alias)
   * @returns Updated bank account
   */
  async updateBankAccount(id: string, updateData: Partial<Pick<IBankAccount, 'cbu' | 'alias'>>): Promise<IBankAccount> {
    try {
      if (!updateData.cbu && !updateData.alias) {
        throw new Error('Must provide at least CBU or alias to update.');
      }

      const updatedAccount = await this.bankAccountRepository.updateBankAccount(id, updateData);

      if (!updatedAccount) {
        throw new Error('Bank account not found.');
      }

      return updatedAccount;
    } catch (error) {
      throw new Error(`Error updating bank account: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default BankAccountService;
