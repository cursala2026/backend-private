/* eslint-env jest */
// Mock enums before importing modules that use them
jest.mock('@/models/enums', () => ({
  UserStatus: {
    INACTIVE: 'INACTIVE',
    ACTIVE: 'ACTIVE',
  },
  UserRoles: {
    ADMIN: 'ADMIN',
    ALUMNO: 'ALUMNO',
    PROFESOR: 'PROFESOR',
  },
  CorporateMails: {
    INFO: 'info@example.com',
  },
}));

import RequestACourseService from '@/services/requestACourse.service';
import RequestACourseRepository from '@/repositories/requestACourse.repository';
import { sendEmail } from '@/utils/emailer';
// Mock dependencies
jest.mock('@/repositories/requestACourse.repository');
jest.mock('@/utils/emailer');
const mockRequestACourseRepository = RequestACourseRepository as jest.MockedClass<typeof RequestACourseRepository>;
describe('RequestACourseService', () => {
  let service: RequestACourseService;
  let mockRepositoryInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a mock instance with all methods
    mockRepositoryInstance = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };
    // Mock the constructor to return our instance
    mockRequestACourseRepository.mockImplementation(() => mockRepositoryInstance);
    service = new RequestACourseService(mockRepositoryInstance);
  });
  describe('getAllRequestACourse', () => {
    test('retrieves all requests', async () => {
      const requests = [{ id: '1', name: 'Test' }];
      mockRepositoryInstance.findAll.mockResolvedValue(requests);
      const result = await service.getAllRequestACourse();
      expect(result).toEqual(requests);
      expect(mockRepositoryInstance.findAll).toHaveBeenCalled();
    });
  });

  describe('getRequestACourseById', () => {
    test('retrieves request by id', async () => {
      const request = { id: '1', name: 'Test' };
      mockRepositoryInstance.findById.mockResolvedValue(request);
      const result = await service.getRequestACourseById('1');
      expect(result).toEqual(request);
      expect(mockRepositoryInstance.findById).toHaveBeenCalledWith('1');
    });
  });

  describe('createRequestACourse', () => {
    test('creates request successfully', async () => {
      const data = {
        name: 'John Doe',
        company: 'Test Corp',
        email: 'john@example.com',
        phonePrefix: '+54',
        phoneNumber: '123456789',
        message: 'Test message',
      };
      const mockResult = { id: '1', ...data };
      mockRepositoryInstance.create.mockResolvedValue(mockResult);
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await service.createRequestACourse(data);
      expect(result).toEqual(mockResult);
      expect(mockRepositoryInstance.create).toHaveBeenCalledWith(data);
      expect(sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateRequestACourseById', () => {
    test('updates request by id', async () => {
      const data = { name: 'Updated Name' };
      const updatedRequest = { id: '1', name: 'Updated Name' };
      mockRepositoryInstance.updateById.mockResolvedValue(updatedRequest);
      const result = await service.updateRequestACourseById('1', data);
      expect(result).toEqual(updatedRequest);
      expect(mockRepositoryInstance.updateById).toHaveBeenCalledWith('1', data);
    });
  });

  describe('deleteRequestACourseById', () => {
    test('deletes request by id', async () => {
      const deletedRequest = { id: '1', deleted: true };
      mockRepositoryInstance.deleteById.mockResolvedValue(deletedRequest);
      const result = await service.deleteRequestACourseById('1');
      expect(result).toEqual(deletedRequest);
      expect(mockRepositoryInstance.deleteById).toHaveBeenCalledWith('1');
    });
  });
});