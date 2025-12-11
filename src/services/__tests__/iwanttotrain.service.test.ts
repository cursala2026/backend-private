
/* eslint-env jest */
import mongoose from 'mongoose';
import IWantToTrainService from '@/services/iwanttotrain.service';
import IWantToTrainRepository from '@/repositories/iwanttotrain.repository';
import { IIWantToTrain } from '@/models/mongo/iwanttotrain.model';
jest.mock('@/utils/emailer', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('@/repositories/iwanttotrain.repository');
const mockSendEmail = require('@/utils/emailer').sendEmail;
const mockIWantToTrainRepository = IWantToTrainRepository as jest.Mocked<typeof IWantToTrainRepository>;
describe('IWantToTrainService', () => {
  let iWantToTrainService: any;
  beforeEach(() => {
    jest.clearAllMocks();
    iWantToTrainService = new IWantToTrainService(mockIWantToTrainRepository.prototype);
  });
  describe('getAllIWantToTrain', () => {
    test('retrieves all IWantToTrain records successfully', async () => {
      const mockRecords: any[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'John Doe',
          email: 'john@example.com',
          phonePrefix: '+54',
          phoneNumber: '123456789',
          message: 'I want to train',
        },
      ];
      mockIWantToTrainRepository.prototype.findAll = jest.fn().mockResolvedValue(mockRecords);
      const result = await iWantToTrainService.getAllIWantToTrain();
      expect(result).toEqual(mockRecords);
      expect(mockIWantToTrainRepository.prototype.findAll).toHaveBeenCalled();
    });
    test('handles error during retrieval', async () => {
      mockIWantToTrainRepository.prototype.findAll = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(iWantToTrainService.getAllIWantToTrain()).rejects.toThrow('DB error');
    });
  });
  describe('getIWantToTrainById', () => {
    test('retrieves IWantToTrain by ID successfully', async () => {
      const mockRecord: any = {
        _id: new mongoose.Types.ObjectId(),
        name: 'John Doe',
        email: 'john@example.com',
        phonePrefix: '+54',
        phoneNumber: '123456789',
        message: 'I want to train',
      };
      mockIWantToTrainRepository.prototype.findById = jest.fn().mockResolvedValue(mockRecord);
      const result = await iWantToTrainService.getIWantToTrainById('1');
      expect(result).toEqual(mockRecord);
      expect(mockIWantToTrainRepository.prototype.findById).toHaveBeenCalledWith('1');
    });
    test('handles error during retrieval', async () => {
      mockIWantToTrainRepository.prototype.findById = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(iWantToTrainService.getIWantToTrainById('1')).rejects.toThrow('DB error');
    });
  });
  describe('createIWantToTrain', () => {
    test('creates IWantToTrain successfully and sends emails', async () => {
      const data: Partial<IIWantToTrain> = {
        name: 'John Doe',
        email: 'john@example.com',
        phonePrefix: '+54',
        phoneNumber: '123456789',
        message: 'I want to train',
      };
      const createdRecord: IIWantToTrain = {
        _id: new mongoose.Types.ObjectId(),
        ...data,
      } as unknown as IIWantToTrain;
      mockIWantToTrainRepository.prototype.create = jest.fn().mockResolvedValue(createdRecord);
      mockSendEmail.mockResolvedValue({});
      const result = await iWantToTrainService.createIWantToTrain(data);
      expect(result).toEqual(createdRecord);
      expect(mockIWantToTrainRepository.prototype.create).toHaveBeenCalledWith(data);
      expect(mockSendEmail).toHaveBeenCalledTimes(2); // One to admin, one to user
    });
    test('handles error during creation', async () => {
      const data: Partial<IIWantToTrain> = {
        name: 'John Doe',
        email: 'john@example.com',
      };
      mockIWantToTrainRepository.prototype.create = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(iWantToTrainService.createIWantToTrain(data)).rejects.toThrow('DB error');
    });
    test('handles email sending error', async () => {
      const data: Partial<IIWantToTrain> = {
        name: 'John Doe',
        email: 'john@example.com',
      };
      const createdRecord: IIWantToTrain = {
        _id: new mongoose.Types.ObjectId(),
        ...data,
      } as unknown as IIWantToTrain;
      mockIWantToTrainRepository.prototype.create = jest.fn().mockResolvedValue(createdRecord);
      mockSendEmail.mockRejectedValue(new Error('Email error'));
      // Should still succeed despite email error
      const result = await iWantToTrainService.createIWantToTrain(data);
      expect(result).toEqual(createdRecord);
    });
  });
  describe('updateIWantToTrainById', () => {
    test('updates IWantToTrain successfully', async () => {
      const data: Partial<IIWantToTrain> = { name: 'Updated Name' };
      const updatedRecord: IIWantToTrain = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Updated Name',
        email: 'john@example.com',
      } as unknown as IIWantToTrain;
      mockIWantToTrainRepository.prototype.updateById = jest.fn().mockResolvedValue(updatedRecord);
      const result = await iWantToTrainService.updateIWantToTrainById('1', data);
      expect(result).toEqual(updatedRecord);
      expect(mockIWantToTrainRepository.prototype.updateById).toHaveBeenCalledWith('1', data);
    });
    test('handles error during update', async () => {
      const data: Partial<IIWantToTrain> = { name: 'Updated Name' };
      mockIWantToTrainRepository.prototype.updateById = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(iWantToTrainService.updateIWantToTrainById('1', data)).rejects.toThrow('DB error');
    });
  });
  describe('deleteIWantToTrainById', () => {
    test('deletes IWantToTrain successfully', async () => {
      const deletedRecord: IIWantToTrain = {
        _id: new mongoose.Types.ObjectId(),
        name: 'John Doe',
        email: 'john@example.com',
      } as unknown as IIWantToTrain;
      mockIWantToTrainRepository.prototype.deleteById = jest.fn().mockResolvedValue(deletedRecord);
      const result = await iWantToTrainService.deleteIWantToTrainById('1');
      expect(result).toEqual(deletedRecord);
      expect(mockIWantToTrainRepository.prototype.deleteById).toHaveBeenCalledWith('1');
    });
    test('handles error during deletion', async () => {
      mockIWantToTrainRepository.prototype.deleteById = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(iWantToTrainService.deleteIWantToTrainById('1')).rejects.toThrow('DB error');
    });
  });
});
