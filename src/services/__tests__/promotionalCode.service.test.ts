/* eslint-env jest */
import mongoose from 'mongoose';

// Mock dependencies BEFORE importing the service
jest.mock('@/models/mongo/promotionalCode.model', () => ({
  PromotionalCode: class {
    constructor(data: any) {
      Object.assign(this, data);
    }

    save = jest.fn().mockResolvedValue(this);
    isValid = jest.fn().mockReturnValue(true);
    appliesToCourse = jest.fn().mockReturnValue(true);
    getUserUsageCount = jest.fn().mockReturnValue(0);
    calculateDiscount = jest.fn().mockReturnValue(10);

    static find = jest.fn();
    static findById = jest.fn();
    static findOne = jest.fn();
    static findOneAndUpdate = jest.fn();
    static aggregate = jest.fn();
    static create = jest.fn();
    static updateOne = jest.fn();
    static updateMany = jest.fn();
    static deleteOne = jest.fn();
    static deleteMany = jest.fn();
    static countDocuments = jest.fn();
    static findByIdAndUpdate = jest.fn();
  },
  PromotionalCodeSchema: {
    methods: {},
    index: jest.fn(),
  },
  PromotionalCodeStatus: {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    EXPIRED: 'EXPIRED',
    DELETED: 'DELETED',
  },
  DiscountType: {
    PERCENTAGE: 'PERCENTAGE',
    FIXED_AMOUNT: 'FIXED_AMOUNT',
  },
}));

jest.mock('mongoose');
jest.mock('@/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/models/mongo/course.model', () => ({
  Course: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

// NOW import the service and models
import PromotionalCodeService from '@/services/promotionalCode.service';
import { PromotionalCode, PromotionalCodeStatus, DiscountType } from '@/models/mongo/promotionalCode.model';
import { Course } from '@/models/mongo/course.model';
import { logger } from '@/utils';

describe('PromotionalCodeService', () => {
  let service: PromotionalCodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromotionalCodeService();
  });

  describe('createPromotionalCode', () => {
    test('creates promotional code successfully', async () => {
      const data = { code: 'TEST10', discountType: DiscountType.PERCENTAGE, discountValue: 10 };
      (PromotionalCode.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      (Course.find as jest.Mock).mockResolvedValue([]);
      (PromotionalCode.create as jest.Mock).mockResolvedValue(data);

      const result = await service.createPromotionalCode(data);

      expect(PromotionalCode.findOne).toHaveBeenCalledWith({ code: 'TEST10' });
      expect(logger.info).toHaveBeenCalled();
    });

    test('throws error if code already exists', async () => {
      const data = { code: 'TEST10' };
      (PromotionalCode.findOne as jest.Mock) = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ code: 'TEST10' }) });

      await expect(service.createPromotionalCode(data)).rejects.toThrow('Ya existe un código promocional con ese nombre');
    });
  });

  describe('getAllPromotionalCodes', () => {
    test('retrieves all promotional codes', async () => {
      const codes = [{ code: 'TEST10' }];
      (PromotionalCode.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(codes) }),
            }),
          }),
        }),
      });

      const result = await service.getAllPromotionalCodes();

      expect(result).toEqual(codes);
    });
  });

  describe('getPromotionalCodeById', () => {
    test('retrieves promotional code by id', async () => {
      const code = { _id: 'id', code: 'TEST10' };
      (PromotionalCode.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(code) }),
          }),
        }),
      });

      const result = await service.getPromotionalCodeById('id');

      expect(result).toEqual(code);
    });
  });

  describe('getPromotionalCodeByCode', () => {
    test('retrieves promotional code by code', async () => {
      const code = { code: 'TEST10' };
      (PromotionalCode.findOne as jest.Mock) = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(code) }) });

      const result = await service.getPromotionalCodeByCode('test10');

      expect(PromotionalCode.findOne).toHaveBeenCalledWith({
        code: 'TEST10',
        status: { $ne: PromotionalCodeStatus.DELETED },
      });
      expect(result).toEqual(code);
    });
  });

  describe('updatePromotionalCode', () => {
    test('updates promotional code successfully', async () => {
      const updatedData = { code: 'NEWCODE', _id: 'id', discountType: DiscountType.PERCENTAGE, discountValue: 10 };
      const data = { code: 'NEWCODE' };
      const modifiedBy = new mongoose.Types.ObjectId();
      (PromotionalCode.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      // Create mock that returns the updated data after populate
      const mockPopulate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedData) });

      (PromotionalCode.findByIdAndUpdate as jest.Mock).mockReturnValue({ populate: mockPopulate });

      const result = await service.updatePromotionalCode('id', data, modifiedBy);

      expect(result).toEqual(updatedData);
      expect(mockPopulate).toHaveBeenCalledWith('applicableCourses', 'name price');
    });
  });

  describe('validatePromotionalCode', () => {
    test('validates promotional code successfully', async () => {
      const promotionalCode = {
        isValid: jest.fn().mockReturnValue(true),
        appliesToCourse: jest.fn().mockReturnValue(true),
        getUserUsageCount: jest.fn().mockReturnValue(0),
        calculateDiscount: jest.fn().mockReturnValue(10),
      };
      (PromotionalCode.findOne as jest.Mock) = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(promotionalCode) }) });

      const result = await service.validatePromotionalCode('TEST10', 'course1', 'user1', 100);

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(10);
      expect(result.finalPrice).toBe(90);
    });

    test('returns invalid if code not found', async () => {
      (PromotionalCode.findOne as jest.Mock) = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) });

      const result = await service.validatePromotionalCode('INVALID', 'course1', 'user1', 100);

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Código promocional no encontrado');
    });
  });

  describe('applyPromotionalCode', () => {
    test('applies promotional code successfully', async () => {
      const promotionalCode: any = {
        usedCount: 0,
        usageHistory: [],
        save: jest.fn(),
      };
      (PromotionalCode.findById as jest.Mock) = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(promotionalCode) });

      const result = await service.applyPromotionalCode('id', 'user1', 'course1', 10);

      expect(result).toBe(true);
      expect(promotionalCode.usedCount).toBe(1);
      expect(promotionalCode.save).toHaveBeenCalled();
    });
  });

  describe('getPromotionalCodeStats', () => {
    test('retrieves promotional code stats', async () => {
      (PromotionalCode.countDocuments as jest.Mock) = jest.fn()
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2);
      (PromotionalCode.aggregate as jest.Mock) = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([{ totalUsage: 50, totalDiscountGiven: 500 }]) });

      const result = await service.getPromotionalCodeStats();

      expect(result).toEqual({
        totalCodes: 10,
        activeCodes: 8,
        pausedCodes: 2,
        totalUsage: 50,
        totalDiscountGiven: 500,
      });
    });
  });

  describe('getActivePromotionsForCourses', () => {
    test('retrieves active promotions for courses', async () => {
      const codes = [
        { isValid: jest.fn().mockReturnValue(true), isGlobal: true },
        { isValid: jest.fn().mockReturnValue(true), isGlobal: false, applicableCourses: ['course1'] },
      ];
      (PromotionalCode.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(codes) }),
      });

      const result = await service.getActivePromotionsForCourses(['course1', 'course2']);

      expect(result).toEqual({ course1: true, course2: true });
    });
  });
});
