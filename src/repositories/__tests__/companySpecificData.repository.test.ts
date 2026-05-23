import { Types } from 'mongoose';
import CompanySpecificDataRepository from '../companySpecificData.repository';

describe('CompanySpecificDataRepository', () => {
  let repository: CompanySpecificDataRepository;
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

    repository = new CompanySpecificDataRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('CompanySpecificData', expect.anything(), 'companySpecificData');
    });
  });

  describe('getAll', () => {
    it('should fetch all records', async () => {
      const mockData = [{ _id: '1', privacyPolicy: 'policy' }];
      mockModel.find.mockResolvedValueOnce(mockData);

      const result = await repository.getAll();

      expect(mockModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockData);
    });
  });

  describe('updateCompanySpecificData', () => {
    it('should throw error for invalid ID', async () => {
      await expect(repository.updateCompanySpecificData('invalid', {})).rejects.toThrow('El ID proporcionado no es válido.');
    });

    it('should update record for valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const updateData = { privacyPolicy: 'new policy' };
      const updatedData = { _id: validId, ...updateData };
      mockModel.findByIdAndUpdate.mockResolvedValueOnce(updatedData);

      const result = await repository.updateCompanySpecificData(validId, updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, updateData, { new: true });
      expect(result).toEqual(updatedData);
    });
  });
});
