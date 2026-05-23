import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PromotionalCodeController from '../promotionalCode.controller';
import PromotionalCodeService from '@/services/promotionalCode.service';
import { DiscountType, PromotionalCodeStatus } from '@/models/mongo/promotionalCode.model';

jest.mock('@/services/promotionalCode.service');
jest.mock('@/utils', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
  prepareResponse: jest.fn((status, message, data) => ({ status, message, data })),
}));

describe('PromotionalCodeController', () => {
  let controller: PromotionalCodeController;
  let mockService: jest.Mocked<PromotionalCodeService>;
  let req: Partial<Request>;
  let res: Partial<Response>;

  const mockUser = { _id: new mongoose.Types.ObjectId().toString() };
  const mockCode = {
    _id: 'code-1',
    code: 'TEST10',
    name: 'Test Code',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    status: PromotionalCodeStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new PromotionalCodeService() as jest.Mocked<PromotionalCodeService>;
    controller = new PromotionalCodeController(mockService);
    req = { body: {}, params: {}, query: {}, user: mockUser as any };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  });

  describe('createPromotionalCode', () => {
    it('should create a code successfully', async () => {
      req.body = { code: 'TEST10', name: 'Test', discountValue: 10 };
      mockService.createPromotionalCode.mockResolvedValue(mockCode as any);

      await controller.createPromotionalCode(req as Request, res as Response);

      expect(mockService.createPromotionalCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TEST10',
          name: 'Test',
          discountValue: 10,
          status: PromotionalCodeStatus.ACTIVE,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = { code: 'TEST10' }; // missing name and value
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if discount value <= 0', async () => {
      req.body = { code: 'TEST10', name: 'Test', discountValue: 0 };
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if percentage discount > 100', async () => {
      req.body = { code: 'TEST10', name: 'Test', discountType: DiscountType.PERCENTAGE, discountValue: 150 };
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if unauthenticated', async () => {
      req.user = undefined;
      req.body = { code: 'TEST10', name: 'Test', discountValue: 10 };
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if service throws "Ya existe un código promocional"', async () => {
      req.body = { code: 'TEST10', name: 'Test', discountValue: 10 };
      mockService.createPromotionalCode.mockRejectedValue(new Error('Ya existe un código promocional'));
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on generic error', async () => {
      req.body = { code: 'TEST10', name: 'Test', discountValue: 10 };
      mockService.createPromotionalCode.mockRejectedValue(new Error('DB failure'));
      await controller.createPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAllPromotionalCodes', () => {
    it('should return all codes', async () => {
      mockService.getAllPromotionalCodes.mockResolvedValue([mockCode] as any);
      await controller.getAllPromotionalCodes(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [mockCode] }));
    });

    it('should return 500 on generic error', async () => {
      mockService.getAllPromotionalCodes.mockRejectedValue(new Error('DB failure'));
      await controller.getAllPromotionalCodes(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPromotionalCodeById', () => {
    it('should return code by id', async () => {
      req.params = { id: 'code-1' };
      mockService.getPromotionalCodeById.mockResolvedValue(mockCode as any);
      await controller.getPromotionalCodeById(req as Request, res as Response);
      expect(mockService.getPromotionalCodeById).toHaveBeenCalledWith('code-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockCode }));
    });

    it('should return 400 if id is missing', async () => {
      req.params = { id: '' };
      await controller.getPromotionalCodeById(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if code not found', async () => {
      req.params = { id: 'code-1' };
      mockService.getPromotionalCodeById.mockResolvedValue(null as any);
      await controller.getPromotionalCodeById(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on error', async () => {
      req.params = { id: 'code-1' };
      mockService.getPromotionalCodeById.mockRejectedValue(new Error('DB failure'));
      await controller.getPromotionalCodeById(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updatePromotionalCode', () => {
    it('should update code successfully', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockResolvedValue({ ...mockCode, discountValue: 20 } as any);
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if id is missing', async () => {
      req.params = { id: '' };
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if unauthenticated', async () => {
      req.user = undefined;
      req.params = { id: 'code-1' };
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if discount value <= 0', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 0 };
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if percentage > 100', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountType: DiscountType.PERCENTAGE, discountValue: 150 };
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if code not found', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockResolvedValue(null as any);
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if service throws "Ya existe"', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockRejectedValue(new Error('Ya existe un código promocional'));
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on error', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockRejectedValue(new Error('DB fail'));
      await controller.updatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('pausePromotionalCode', () => {
    it('should pause code successfully', async () => {
      req.params = { id: 'code-1' };
      mockService.pausePromotionalCode.mockResolvedValue({ ...mockCode, status: PromotionalCodeStatus.PAUSED } as any);
      await controller.pausePromotionalCode(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if id is missing', async () => {
      req.params = { id: '' };
      await controller.pausePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if unauthenticated', async () => {
      req.user = undefined;
      req.params = { id: 'code-1' };
      await controller.pausePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if code not found', async () => {
      req.params = { id: 'code-1' };
      mockService.pausePromotionalCode.mockResolvedValue(null as any);
      await controller.pausePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on error', async () => {
      req.params = { id: 'code-1' };
      mockService.pausePromotionalCode.mockRejectedValue(new Error('fail'));
      await controller.pausePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('patchPromotionalCode', () => {
    it('should patch code successfully with allowed fields', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 50, invalidField: 'test' };
      mockService.updatePromotionalCode.mockResolvedValue({ ...mockCode, discountValue: 50 } as any);
      
      await controller.patchPromotionalCode(req as Request, res as Response);
      
      expect(mockService.updatePromotionalCode).toHaveBeenCalledWith(
        'code-1',
        { discountValue: 50 },
        expect.any(mongoose.Types.ObjectId)
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if no allowed fields sent', async () => {
      req.params = { id: 'code-1' };
      req.body = { invalidField: 'test' };
      await controller.patchPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.updatePromotionalCode).not.toHaveBeenCalled();
    });

    it('should return 400 if percentage > 100', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountType: DiscountType.PERCENTAGE, discountValue: 150 };
      await controller.patchPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if code not found', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockResolvedValue(null as any);
      await controller.patchPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on error', async () => {
      req.params = { id: 'code-1' };
      req.body = { discountValue: 20 };
      mockService.updatePromotionalCode.mockRejectedValue(new Error('fail'));
      await controller.patchPromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('activatePromotionalCode', () => {
    it('should activate code successfully', async () => {
      req.params = { id: 'code-1' };
      mockService.activatePromotionalCode.mockResolvedValue({ ...mockCode } as any);
      await controller.activatePromotionalCode(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'code-1' };
      mockService.activatePromotionalCode.mockResolvedValue(null as any);
      await controller.activatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deletePromotionalCode', () => {
    it('should delete code successfully', async () => {
      req.params = { id: 'code-1' };
      mockService.deletePromotionalCode.mockResolvedValue({ deleted: true } as any);
      await controller.deletePromotionalCode(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'code-1' };
      mockService.deletePromotionalCode.mockResolvedValue(null as any);
      await controller.deletePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('validatePromotionalCode', () => {
    it('should validate code successfully', async () => {
      req.body = { code: 'TEST10', courseId: 'c1', originalPrice: 100 };
      const validation = { message: 'OK', isValid: true };
      mockService.validatePromotionalCode.mockResolvedValue(validation as any);

      await controller.validatePromotionalCode(req as Request, res as Response);

      expect(mockService.validatePromotionalCode).toHaveBeenCalledWith('TEST10', 'c1', mockUser._id, 100);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: validation }));
    });

    it('should use anonymous user if neither body nor auth user provides id', async () => {
      req.user = undefined;
      req.body = { code: 'TEST10', courseId: 'c1', originalPrice: 100 };
      mockService.validatePromotionalCode.mockResolvedValue({ message: 'OK' } as any);

      await controller.validatePromotionalCode(req as Request, res as Response);

      expect(mockService.validatePromotionalCode).toHaveBeenCalledWith(
        'TEST10',
        'c1',
        expect.stringMatching(/^anonymous_/),
        100
      );
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = { code: 'TEST10' };
      await controller.validatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on error', async () => {
      req.body = { code: 'TEST10', courseId: 'c1', originalPrice: 100 };
      mockService.validatePromotionalCode.mockRejectedValue(new Error('fail'));
      await controller.validatePromotionalCode(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPromotionalCodeStats', () => {
    it('should return stats', async () => {
      mockService.getPromotionalCodeStats.mockResolvedValue({ total: 5 } as any);
      await controller.getPromotionalCodeStats(req as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { total: 5 } }));
    });

    it('should return 500 on error', async () => {
      mockService.getPromotionalCodeStats.mockRejectedValue(new Error('fail'));
      await controller.getPromotionalCodeStats(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCoursesWithActivePromotions', () => {
    it('should return courses with active promotions', async () => {
      req.body = { courseIds: ['c1', 'c2'] };
      mockService.getActivePromotionsForCourses.mockResolvedValue({ c1: true } as any);

      await controller.getCoursesWithActivePromotions(req as Request, res as Response);

      expect(mockService.getActivePromotionsForCourses).toHaveBeenCalledWith(['c1', 'c2']);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if courseIds is not array', async () => {
      req.body = { courseIds: 'c1' };
      await controller.getCoursesWithActivePromotions(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on error', async () => {
      req.body = { courseIds: ['c1'] };
      mockService.getActivePromotionsForCourses.mockRejectedValue(new Error('fail'));
      await controller.getCoursesWithActivePromotions(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
