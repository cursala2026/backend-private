import { Request, Response, NextFunction } from 'express';
import RequestACourseController from '../requestACourse.controller';
import RequestACourseService from '@/services/requestACourse.service';

jest.mock('@/services/requestACourse.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('RequestACourseController', () => {
  let controller: RequestACourseController;
  let mockService: jest.Mocked<RequestACourseService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockRequest = { _id: 'rac-1', courseName: 'JavaScript Avanzado' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new RequestACourseService({} as any) as jest.Mocked<RequestACourseService>;
    controller = new RequestACourseController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllRequestACourse', () => {
    it('should return all requests', async () => {
      mockService.getAllRequestACourse.mockResolvedValue([mockRequest] as any);

      await controller.getAllRequestACourse(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: [mockRequest] }));
    });

    it('should call next on error', async () => {
      mockService.getAllRequestACourse.mockRejectedValue(new Error('fail'));
      await controller.getAllRequestACourse(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRequestACourseById', () => {
    it('should return request by id', async () => {
      req.params = { id: 'rac-1' };
      mockService.getRequestACourseById.mockResolvedValue(mockRequest as any);

      await controller.getRequestACourseById(req as Request, res as Response, next);

      expect(mockService.getRequestACourseById).toHaveBeenCalledWith('rac-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockRequest }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.getRequestACourseById.mockResolvedValue(null as any);

      await controller.getRequestACourseById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'rac-1' };
      mockService.getRequestACourseById.mockRejectedValue(new Error('fail'));
      await controller.getRequestACourseById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createRequestACourse', () => {
    it('should create a course request', async () => {
      req.body = { courseName: 'React Hooks' };
      mockService.createRequestACourse.mockResolvedValue(mockRequest as any);

      await controller.createRequestACourse(req as Request, res as Response, next);

      expect(mockService.createRequestACourse).toHaveBeenCalledWith(req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    });

    it('should call next on error', async () => {
      mockService.createRequestACourse.mockRejectedValue(new Error('fail'));
      await controller.createRequestACourse(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateRequestACourseById', () => {
    it('should update a course request', async () => {
      req.params = { id: 'rac-1' };
      req.body = { courseName: 'Updated Name' };
      const updated = { ...mockRequest, courseName: 'Updated Name' };
      mockService.updateRequestACourseById.mockResolvedValue(updated as any);

      await controller.updateRequestACourseById(req as Request, res as Response, next);

      expect(mockService.updateRequestACourseById).toHaveBeenCalledWith('rac-1', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.updateRequestACourseById.mockResolvedValue(null as any);

      await controller.updateRequestACourseById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'rac-1' };
      mockService.updateRequestACourseById.mockRejectedValue(new Error('fail'));
      await controller.updateRequestACourseById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteRequestACourseById', () => {
    it('should delete a course request', async () => {
      req.params = { id: 'rac-1' };
      mockService.deleteRequestACourseById.mockResolvedValue(mockRequest as any);

      await controller.deleteRequestACourseById(req as Request, res as Response, next);

      expect(mockService.deleteRequestACourseById).toHaveBeenCalledWith('rac-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.deleteRequestACourseById.mockResolvedValue(null as any);

      await controller.deleteRequestACourseById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'rac-1' };
      mockService.deleteRequestACourseById.mockRejectedValue(new Error('fail'));
      await controller.deleteRequestACourseById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
