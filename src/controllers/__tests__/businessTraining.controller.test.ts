import { Request, Response, NextFunction } from 'express';
import BusinessTrainingController from '../businessTraining.controller';
import BusinessTrainingService from '@/services/businessTraining.service';

jest.mock('@/services/businessTraining.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('BusinessTrainingController', () => {
  let controller: BusinessTrainingController;
  let mockService: jest.Mocked<BusinessTrainingService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockTraining = { _id: 'bt-1', title: 'Training 1' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new BusinessTrainingService({} as any) as jest.Mocked<BusinessTrainingService>;
    controller = new BusinessTrainingController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllBusinessTrainings', () => {
    it('should return all trainings', async () => {
      mockService.getAllBusinessTrainings.mockResolvedValue([mockTraining] as any);

      await controller.getAllBusinessTrainings(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: [mockTraining] }));
    });

    it('should call next on error', async () => {
      mockService.getAllBusinessTrainings.mockRejectedValue(new Error('fail'));
      await controller.getAllBusinessTrainings(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBusinessTrainingById', () => {
    it('should return training by id', async () => {
      req.params = { id: 'bt-1' };
      mockService.getBusinessTrainingById.mockResolvedValue(mockTraining as any);

      await controller.getBusinessTrainingById(req as Request, res as Response, next);

      expect(mockService.getBusinessTrainingById).toHaveBeenCalledWith('bt-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockTraining }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.getBusinessTrainingById.mockResolvedValue(null as any);

      await controller.getBusinessTrainingById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'bt-1' };
      mockService.getBusinessTrainingById.mockRejectedValue(new Error('fail'));
      await controller.getBusinessTrainingById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createBusinessTraining', () => {
    it('should create a training', async () => {
      req.body = { title: 'New Training' };
      mockService.createBusinessTraining.mockResolvedValue(mockTraining as any);

      await controller.createBusinessTraining(req as Request, res as Response, next);

      expect(mockService.createBusinessTraining).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    });

    it('should call next on error', async () => {
      mockService.createBusinessTraining.mockRejectedValue(new Error('fail'));
      await controller.createBusinessTraining(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateBusinessTrainingById', () => {
    it('should update a training', async () => {
      req.params = { id: 'bt-1' };
      req.body = { title: 'Updated' };
      const updated = { ...mockTraining, title: 'Updated' };
      mockService.updateBusinessTrainingById.mockResolvedValue(updated as any);

      await controller.updateBusinessTrainingById(req as Request, res as Response, next);

      expect(mockService.updateBusinessTrainingById).toHaveBeenCalledWith('bt-1', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.updateBusinessTrainingById.mockResolvedValue(null as any);

      await controller.updateBusinessTrainingById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'bt-1' };
      mockService.updateBusinessTrainingById.mockRejectedValue(new Error('fail'));
      await controller.updateBusinessTrainingById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteBusinessTrainingById', () => {
    it('should delete a training', async () => {
      req.params = { id: 'bt-1' };
      mockService.deleteBusinessTrainingById.mockResolvedValue(mockTraining as any);

      await controller.deleteBusinessTrainingById(req as Request, res as Response, next);

      expect(mockService.deleteBusinessTrainingById).toHaveBeenCalledWith('bt-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.deleteBusinessTrainingById.mockResolvedValue(null as any);

      await controller.deleteBusinessTrainingById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'bt-1' };
      mockService.deleteBusinessTrainingById.mockRejectedValue(new Error('fail'));
      await controller.deleteBusinessTrainingById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
