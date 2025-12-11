/* eslint-env jest */
import BankAccountService from '@/services/bankAccount.service';
import BankAccountRepository from '@/repositories/bankAccount.repository';

const mockBankAccountRepository: any = {
  getBankAccounts: jest.fn(),
  updateBankAccount: jest.fn(),
};
let bankAccountService: BankAccountService;

describe('BankAccountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bankAccountService = new BankAccountService(mockBankAccountRepository);
  });
  describe('getAllBankAccounts', () => {
    test('returns all bank accounts', async () => {
      const mockAccounts = [{ id: '1', cbu: '123' }];
      mockBankAccountRepository.getBankAccounts.mockResolvedValue(mockAccounts);
      const result = await bankAccountService.getAllBankAccounts();
      expect(result).toEqual(mockAccounts);
      expect(mockBankAccountRepository.getBankAccounts).toHaveBeenCalled();
    });
    test('throws error on repository failure', async () => {
      mockBankAccountRepository.getBankAccounts.mockRejectedValue(new Error('DB error'));
      await expect(bankAccountService.getAllBankAccounts()).rejects.toThrow('Error retrieving bank accounts: DB error');
    });
  });
  describe('updateBankAccount', () => {
    test('updates bank account successfully', async () => {
      const updateData = { cbu: 'new-cbu' };
      const mockUpdated = { id: '1', cbu: 'new-cbu' };
      mockBankAccountRepository.updateBankAccount.mockResolvedValue(mockUpdated);
      const result = await bankAccountService.updateBankAccount('1', updateData);
      expect(result).toEqual(mockUpdated);
      expect(mockBankAccountRepository.updateBankAccount).toHaveBeenCalledWith('1', updateData);
    });
    test('throws error if neither cbu nor alias provided', async () => {
      await expect(bankAccountService.updateBankAccount('1', {})).rejects.toThrow('Must provide at least CBU or alias to update.');
    });
    test('throws error if account not found', async () => {
      mockBankAccountRepository.updateBankAccount.mockResolvedValue(null);
      await expect(bankAccountService.updateBankAccount('1', { cbu: '123' })).rejects.toThrow('Bank account not found.');
    });
    test('throws error on repository failure', async () => {
      mockBankAccountRepository.updateBankAccount.mockRejectedValue(new Error('DB error'));
      await expect(bankAccountService.updateBankAccount('1', { cbu: '123' })).rejects.toThrow('Error updating bank account: DB error');
    });
  });
});
