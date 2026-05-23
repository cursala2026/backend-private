import { Types } from 'mongoose';
import CategoryRepository from '../category.repository';

describe('CategoryRepository', () => {
  let repository: CategoryRepository;
  let mockModel: any;
  let mockConnection: any;

  beforeEach(() => {
    const mockExec = jest.fn();
    const mockSort = jest.fn().mockReturnValue({ exec: mockExec });

    mockModel = {
      findById: jest.fn().mockReturnValue({ exec: mockExec }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: mockExec }),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: mockExec }),
      find: jest.fn().mockReturnValue({ sort: mockSort, exec: mockExec }),
      findOne: jest.fn().mockReturnValue({ sort: mockSort, exec: mockExec }),
      create: jest.fn(),
    };

    mockConnection = {
      model: jest.fn().mockReturnValue(mockModel),
    };

    repository = new CategoryRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('Category', expect.anything(), 'categories');
    });
  });

  describe('findOneById', () => {
    it('should throw an error for invalid ID', async () => {
      await expect(repository.findOneById('invalid-id')).rejects.toThrow('El ID de categoría proporcionado no es válido.');
    });

    it('should fetch category by valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const mockData = { _id: validId, name: 'Category 1' };
      mockModel.findById().exec.mockResolvedValueOnce(mockData);

      const result = await repository.findOneById(validId);

      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockData);
    });
  });

  describe('findById', () => {
    it('should fetch category by ID without validation', async () => {
      const validId = new Types.ObjectId().toHexString();
      const mockData = { _id: validId, name: 'Category 2' };
      mockModel.findById().exec.mockResolvedValueOnce(mockData);

      const result = await repository.findById(validId);

      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockData);
    });
  });

  describe('update', () => {
    it('should update category and return it', async () => {
      const validId = new Types.ObjectId().toHexString();
      const updateData = { name: 'Updated' };
      const updatedMock = { _id: validId, ...updateData };
      mockModel.findByIdAndUpdate().exec.mockResolvedValueOnce(updatedMock);

      const result = await repository.update(validId, updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, updateData, { new: true });
      expect(result).toEqual(updatedMock);
    });

    it('should throw error if category not found', async () => {
      mockModel.findByIdAndUpdate().exec.mockResolvedValueOnce(null);

      await expect(repository.update('id', {})).rejects.toThrow('Category not found.');
    });
  });

  describe('create', () => {
    it('should create category with order 1 if no previous categories exist', async () => {
      const categoryData = { name: 'New' } as any;
      mockModel.findOne().sort().exec.mockResolvedValueOnce(null);
      
      const expectedPayload = { ...categoryData, status: 'ACTIVE', order: 1 };
      const createdData = { _id: '1', ...expectedPayload };
      mockModel.create.mockResolvedValueOnce(createdData);

      const result = await repository.create(categoryData);

      expect(mockModel.findOne).toHaveBeenCalled();
      expect(mockModel.findOne().sort).toHaveBeenCalledWith({ order: -1 });
      expect(mockModel.create).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual(createdData);
    });

    it('should create category with next order if previous categories exist', async () => {
      const categoryData = { name: 'New 2' } as any;
      mockModel.findOne().sort().exec.mockResolvedValueOnce({ order: 5 });
      
      const expectedPayload = { ...categoryData, status: 'ACTIVE', order: 6 };
      const createdData = { _id: '2', ...expectedPayload };
      mockModel.create.mockResolvedValueOnce(createdData);

      const result = await repository.create(categoryData);

      expect(mockModel.create).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual(createdData);
    });
  });

  describe('delete', () => {
    it('should throw error for invalid ID', async () => {
      await expect(repository.delete('invalid')).rejects.toThrow('El ID de categoría proporcionado no es válido.');
    });

    it('should delete category with valid ID', async () => {
      const validId = new Types.ObjectId().toHexString();
      const deletedMock = { _id: validId, name: 'Deleted' };
      mockModel.findByIdAndDelete().exec.mockResolvedValueOnce(deletedMock);

      const result = await repository.delete(validId);

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
      expect(result).toEqual(deletedMock);
    });
  });

  describe('findAll', () => {
    it('should fetch all categories sorted by order', async () => {
      const mockData = [{ _id: '1', name: 'Cat' }];
      mockModel.find().sort().exec.mockResolvedValueOnce(mockData);

      const result = await repository.findAll();

      expect(mockModel.find).toHaveBeenCalled();
      expect(mockModel.find().sort).toHaveBeenCalledWith({ order: 1 });
      expect(result).toEqual(mockData);
    });
  });
});
