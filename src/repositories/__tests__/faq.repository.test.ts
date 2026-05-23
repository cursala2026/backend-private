import { Types } from 'mongoose';
import FAQRepository from '../faq.repository';

describe('FAQRepository', () => {
  let repository: FAQRepository;
  let mockModel: any;
  let mockConnection: any;

  beforeEach(() => {
    // Mock chainable methods
    const mockExec = jest.fn();
    const mockSort = jest.fn().mockReturnValue({ exec: mockExec });

    mockModel = {
      find: jest.fn().mockReturnValue({ sort: mockSort, exec: mockExec }),
      findById: jest.fn().mockReturnValue({ exec: mockExec }),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: mockExec }),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: mockExec }),
      distinct: jest.fn(),
      bulkWrite: jest.fn(),
    };

    mockConnection = {
      model: jest.fn().mockReturnValue(mockModel),
    };

    repository = new FAQRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('FAQ', expect.anything(), 'faqs');
    });
  });

  describe('getFAQs', () => {
    it('should fetch all FAQs when activeOnly is false', async () => {
      const mockExec = mockModel.find().sort().exec;
      mockExec.mockResolvedValueOnce([{ _id: '1', question: 'Q1' }]);

      const result = await repository.getFAQs();

      expect(mockModel.find).toHaveBeenCalledWith({});
      expect(mockModel.find().sort).toHaveBeenCalledWith({ category: 1, order: 1 });
      expect(result).toEqual([{ _id: '1', question: 'Q1' }]);
    });

    it('should fetch only active FAQs when activeOnly is true', async () => {
      const mockExec = mockModel.find().sort().exec;
      mockExec.mockResolvedValueOnce([{ _id: '1', question: 'Q1', isActive: true }]);

      const result = await repository.getFAQs(true);

      expect(mockModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual([{ _id: '1', question: 'Q1', isActive: true }]);
    });
  });

  describe('getFAQsByCategory', () => {
    it('should fetch FAQs by category without active filter', async () => {
      const mockExec = mockModel.find().sort().exec;
      mockExec.mockResolvedValueOnce([{ _id: '1', category: 'billing' }]);

      const result = await repository.getFAQsByCategory('billing');

      expect(mockModel.find).toHaveBeenCalledWith({ category: 'billing' });
      expect(mockModel.find().sort).toHaveBeenCalledWith({ order: 1 });
      expect(result).toEqual([{ _id: '1', category: 'billing' }]);
    });

    it('should fetch FAQs by category with active filter', async () => {
      const mockExec = mockModel.find().sort().exec;
      mockExec.mockResolvedValueOnce([{ _id: '1', category: 'billing', isActive: true }]);

      const result = await repository.getFAQsByCategory('billing', true);

      expect(mockModel.find).toHaveBeenCalledWith({ category: 'billing', isActive: true });
      expect(result).toEqual([{ _id: '1', category: 'billing', isActive: true }]);
    });
  });

  describe('getFAQById', () => {
    it('should throw an error for invalid ID', async () => {
      await expect(repository.getFAQById('invalid-id')).rejects.toThrow('The provided FAQ ID is not valid.');
    });

    it('should fetch FAQ by valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const mockExec = mockModel.findById().exec;
      mockExec.mockResolvedValueOnce({ _id: validId, question: 'Q' });

      const result = await repository.getFAQById(validId);

      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toEqual({ _id: validId, question: 'Q' });
    });
  });

  describe('createFAQ', () => {
    it('should create an FAQ', async () => {
      const faqData = { question: 'Q', answer: 'A', category: 'general' } as any;
      mockModel.create.mockResolvedValueOnce({ _id: '1', ...faqData });

      const result = await repository.createFAQ(faqData);

      expect(mockModel.create).toHaveBeenCalledWith(faqData);
      expect(result).toEqual({ _id: '1', ...faqData });
    });
  });

  describe('updateFAQ', () => {
    it('should throw error for invalid ID', async () => {
      await expect(repository.updateFAQ('invalid', {})).rejects.toThrow('The provided FAQ ID is not valid.');
    });

    it('should update FAQ with valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const updateData = { question: 'Updated' };
      const mockExec = mockModel.findByIdAndUpdate().exec;
      mockExec.mockResolvedValueOnce({ _id: validId, ...updateData });

      const result = await repository.updateFAQ(validId, updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, updateData, { new: true });
      expect(result).toEqual({ _id: validId, ...updateData });
    });
  });

  describe('deleteFAQ', () => {
    it('should throw error for invalid ID', async () => {
      await expect(repository.deleteFAQ('invalid')).rejects.toThrow('The provided FAQ ID is not valid.');
    });

    it('should delete FAQ with valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const mockExec = mockModel.findByIdAndDelete().exec;
      mockExec.mockResolvedValueOnce({ _id: validId });

      const result = await repository.deleteFAQ(validId);

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
      expect(result).toEqual({ _id: validId });
    });
  });

  describe('getCategories', () => {
    it('should return unique categories without null/undefined', async () => {
      mockModel.distinct.mockResolvedValueOnce(['general', null, 'billing', undefined]);

      const result = await repository.getCategories();

      expect(mockModel.distinct).toHaveBeenCalledWith('category');
      expect(result).toEqual(['general', 'billing']);
    });
  });

  describe('updateFAQOrder', () => {
    it('should perform bulkwrite for valid IDs and return modifiedCount', async () => {
      const validId1 = new Types.ObjectId().toHexString();
      const validId2 = new Types.ObjectId().toHexString();
      const orderUpdates = [
        { id: validId1, order: 1 },
        { id: 'invalid', order: 2 }, // Debería filtrarse
        { id: validId2, order: 3 },
      ];

      mockModel.bulkWrite.mockResolvedValueOnce({ modifiedCount: 2 });

      const result = await repository.updateFAQOrder(orderUpdates);

      expect(mockModel.bulkWrite).toHaveBeenCalledTimes(1);
      const bulkOpsArg = mockModel.bulkWrite.mock.calls[0][0];
      
      // Debe haber solo 2 operaciones, la inválida se ignora
      expect(bulkOpsArg).toHaveLength(2);
      expect(bulkOpsArg[0].updateOne.filter._id.toString()).toBe(validId1);
      expect(bulkOpsArg[0].updateOne.update.order).toBe(1);
      expect(bulkOpsArg[1].updateOne.filter._id.toString()).toBe(validId2);
      expect(bulkOpsArg[1].updateOne.update.order).toBe(3);
      
      expect(result).toBe(2);
    });

    it('should not call bulkWrite if no valid updates provided', async () => {
      const orderUpdates = [{ id: 'invalid', order: 1 }];

      const result = await repository.updateFAQOrder(orderUpdates);

      expect(mockModel.bulkWrite).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
});
