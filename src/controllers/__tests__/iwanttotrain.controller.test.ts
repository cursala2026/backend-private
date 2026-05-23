import { Request, Response, NextFunction } from 'express';
import IWantToTrainController from '../iwanttotrain.controller';
import IWantToTrainService from '@/services/iwanttotrain.service';

jest.mock('@/services/iwanttotrain.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('IWantToTrainController', () => {
  let controller: IWantToTrainController;
  let mockService: jest.Mocked<IWantToTrainService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockEntry = { _id: 'iwtt-1', name: 'Juan Perez', company: 'Acme' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new IWantToTrainService({} as any) as jest.Mocked<IWantToTrainService>;
    controller = new IWantToTrainController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllIWantToTrain', () => {
    it('should return all entries', async () => {
      mockService.getAllIWantToTrain.mockResolvedValue([mockEntry] as any);

      await controller.getAllIWantToTrain(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: [mockEntry] }));
    });

    it('should call next on error', async () => {
      mockService.getAllIWantToTrain.mockRejectedValue(new Error('fail'));
      await controller.getAllIWantToTrain(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getIWantToTrainById', () => {
    it('should return entry by id', async () => {
      req.params = { id: 'iwtt-1' };
      mockService.getIWantToTrainById.mockResolvedValue(mockEntry as any);

      await controller.getIWantToTrainById(req as Request, res as Response, next);

      expect(mockService.getIWantToTrainById).toHaveBeenCalledWith('iwtt-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockEntry }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.getIWantToTrainById.mockResolvedValue(null as any);

      await controller.getIWantToTrainById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'iwtt-1' };
      mockService.getIWantToTrainById.mockRejectedValue(new Error('fail'));
      await controller.getIWantToTrainById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createIWantToTrain', () => {
    it('should create an entry', async () => {
      req.body = { name: 'Juan', company: 'Acme' };
      mockService.createIWantToTrain.mockResolvedValue(mockEntry as any);

      await controller.createIWantToTrain(req as Request, res as Response, next);

      expect(mockService.createIWantToTrain).toHaveBeenCalledWith(req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    });

    it('should call next on error', async () => {
      mockService.createIWantToTrain.mockRejectedValue(new Error('fail'));
      await controller.createIWantToTrain(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateIWantToTrainById', () => {
    it('should update an entry', async () => {
      req.params = { id: 'iwtt-1' };
      req.body = { company: 'Updated Corp' };
      mockService.updateIWantToTrainById.mockResolvedValue({ ...mockEntry, company: 'Updated Corp' } as any);

      await controller.updateIWantToTrainById(req as Request, res as Response, next);

      expect(mockService.updateIWantToTrainById).toHaveBeenCalledWith('iwtt-1', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.updateIWantToTrainById.mockResolvedValue(null as any);

      await controller.updateIWantToTrainById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'iwtt-1' };
      mockService.updateIWantToTrainById.mockRejectedValue(new Error('fail'));
      await controller.updateIWantToTrainById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteIWantToTrainById', () => {
    it('should delete an entry', async () => {
      req.params = { id: 'iwtt-1' };
      mockService.deleteIWantToTrainById.mockResolvedValue(mockEntry as any);

      await controller.deleteIWantToTrainById(req as Request, res as Response, next);

      expect(mockService.deleteIWantToTrainById).toHaveBeenCalledWith('iwtt-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.deleteIWantToTrainById.mockResolvedValue(null as any);

      await controller.deleteIWantToTrainById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'iwtt-1' };
      mockService.deleteIWantToTrainById.mockRejectedValue(new Error('fail'));
      await controller.deleteIWantToTrainById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
