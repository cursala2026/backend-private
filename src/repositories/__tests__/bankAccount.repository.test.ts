import { Types } from 'mongoose';
import BankAccountRepository from '../bankAccount.repository';

describe('BankAccountRepository', () => {
  let repository: BankAccountRepository;
  let mockModel: any;
  let mockConnection: any;

  beforeEach(() => {
    mockModel = {
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockConnection = {
      model: jest.fn().mockReturnValue(mockModel),
    };

    repository = new BankAccountRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('BankAccount', expect.anything(), 'bankAccounts');
    });
  });

  describe('getBankAccounts', () => {
    it('should fetch all bank accounts', async () => {
      const mockAccounts = [{ _id: '1', alias: 'alias.test', cbu: '123' }];
      mockModel.find.mockResolvedValueOnce(mockAccounts);

      const result = await repository.getBankAccounts();

      expect(mockModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('updateBankAccount', () => {
    it('should throw error for invalid ID', async () => {
      await expect(repository.updateBankAccount('invalid-id', {})).rejects.toThrow('The provided bank account ID is not valid.');
    });

    it('should update bank account with valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const updateData = { alias: 'new.alias', cbu: '321' };
      const updatedAccount = { _id: validId, ...updateData };
      mockModel.findByIdAndUpdate.mockResolvedValueOnce(updatedAccount);

      const result = await repository.updateBankAccount(validId, updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, updateData, { new: true });
      expect(result).toEqual(updatedAccount);
    });
  });
});
