
/* eslint-env jest */

import BusinessTrainingService from '@/services/businessTraining.service';
import BusinessTrainingRepository from '@/repositories/businessTraining.repository';
import { sendEmail } from '@/utils/emailer';
jest.mock('@/utils/emailer');
jest.mock('@/repositories/businessTraining.repository');
const mockBusinessTrainingRepository: any = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
};
let businessTrainingService: BusinessTrainingService;
beforeEach(() => {
  jest.clearAllMocks();
  businessTrainingService = new BusinessTrainingService(mockBusinessTrainingRepository);
});
describe('BusinessTrainingService', () => {
  describe('getAllBusinessTrainings', () => {
    test('returns all business trainings', async () => {
      const mockTrainings = [{ id: '1', name: 'Training 1' }];
      mockBusinessTrainingRepository.findAll.mockResolvedValue(mockTrainings);
      const result = await businessTrainingService.getAllBusinessTrainings();
      expect(result).toEqual(mockTrainings);
      expect(mockBusinessTrainingRepository.findAll).toHaveBeenCalled();
    });
  });
  describe('getBusinessTrainingById', () => {
    test('returns business training by id', async () => {
      const mockTraining = { id: '1', name: 'Training 1' };
      mockBusinessTrainingRepository.findById.mockResolvedValue(mockTraining);
      const result = await businessTrainingService.getBusinessTrainingById('1');
      expect(result).toEqual(mockTraining);
      expect(mockBusinessTrainingRepository.findById).toHaveBeenCalledWith('1');
    });
  });
  describe('createBusinessTraining', () => {
    test('creates business training and sends emails', async () => {
      const data = { name: 'Company', email: 'test@example.com', phoneNumber: '123', message: 'Msg' };
      const mockCreated = { id: '1', ...data };
      mockBusinessTrainingRepository.create.mockResolvedValue(mockCreated);
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await businessTrainingService.createBusinessTraining(data);
      expect(result).toEqual(mockCreated);
      expect(mockBusinessTrainingRepository.create).toHaveBeenCalledWith(data);
      expect(sendEmail).toHaveBeenCalledTimes(2);
    });
  });
  describe('updateBusinessTrainingById', () => {
    test('updates business training by id', async () => {
      const data = { name: 'Updated' };
      const mockUpdated = { id: '1', name: 'Updated' };
      mockBusinessTrainingRepository.updateById.mockResolvedValue(mockUpdated);
      const result = await businessTrainingService.updateBusinessTrainingById('1', data);
      expect(result).toEqual(mockUpdated);
      expect(mockBusinessTrainingRepository.updateById).toHaveBeenCalledWith('1', data);
    });
  });
  describe('deleteBusinessTrainingById', () => {
    test('deletes business training by id', async () => {
      const mockDeleted = { id: '1' };
      mockBusinessTrainingRepository.deleteById.mockResolvedValue(mockDeleted);
      const result = await businessTrainingService.deleteBusinessTrainingById('1');
      expect(result).toEqual(mockDeleted);
      expect(mockBusinessTrainingRepository.deleteById).toHaveBeenCalledWith('1');
    });
  });
});
