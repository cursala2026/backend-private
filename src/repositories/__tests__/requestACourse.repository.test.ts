import { Types } from 'mongoose';
import RequestACourseRepository from '../requestACourse.repository';

describe('RequestACourseRepository', () => {
  let repository: RequestACourseRepository;
  let mockModel: any;
  let mockConnection: any;

  beforeEach(() => {
    const mockExec = jest.fn();

    mockModel = {
      find: jest.fn().mockReturnValue({ exec: mockExec }),
      findById: jest.fn().mockReturnValue({ exec: mockExec }),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: mockExec }),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: mockExec }),
    };

    mockConnection = {
      model: jest.fn().mockReturnValue(mockModel),
    };

    repository = new RequestACourseRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('RequestACourse', expect.anything(), 'requestacourse');
    });
  });

  describe('findAll', () => {
    it('should fetch all records', async () => {
      const mockData = [{ _id: '1', name: 'Course Request 1' }];
      mockModel.find().exec.mockResolvedValueOnce(mockData);

      const result = await repository.findAll();

      expect(mockModel.find).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  describe('findById', () => {
    it('should fetch record by valid ID', async () => {
      const validId = new Types.ObjectId();
      const mockData = { _id: validId, name: 'Request' };
      mockModel.findById().exec.mockResolvedValueOnce(mockData);

      const result = await repository.findById(validId.toHexString());

      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('should create a record', async () => {
      const data = { name: 'New Request' } as any;
      const createdData = { _id: '1', ...data };
      mockModel.create.mockResolvedValueOnce(createdData);

      const result = await repository.create(data);

      expect(mockModel.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(createdData);
    });
  });

  describe('updateById', () => {
    it('should update record by valid ID', async () => {
      const validId = new Types.ObjectId();
      const updateData = { name: 'Updated' };
      const updatedMock = { _id: validId, ...updateData };
      mockModel.findByIdAndUpdate().exec.mockResolvedValueOnce(updatedMock);

      const result = await repository.updateById(validId.toHexString(), updateData);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, updateData, { new: true });
      expect(result).toEqual(updatedMock);
    });
  });

  describe('deleteById', () => {
    it('should delete record by valid ID', async () => {
      const validId = new Types.ObjectId();
      const deletedMock = { _id: validId, name: 'Deleted' };
      mockModel.findByIdAndDelete().exec.mockResolvedValueOnce(deletedMock);

      const result = await repository.deleteById(validId.toHexString());

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
      expect(result).toEqual(deletedMock);
    });
  });
});
