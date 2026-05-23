import { Request, Response, NextFunction } from 'express';
import FAQController from '../faq.controller';
import FAQService from '@/services/faq.service';

jest.mock('@/services/faq.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('FAQController', () => {
  let controller: FAQController;
  let mockService: jest.Mocked<FAQService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new FAQService({} as any) as jest.Mocked<FAQService>;
    controller = new FAQController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllFAQs', () => {
    it('should return all FAQs with activeOnly=false by default', async () => {
      const mockFaqs = [{ _id: '1', question: 'Q1' }];
      mockService.getAllFAQs.mockResolvedValue(mockFaqs as any);

      await controller.getAllFAQs(req as Request, res as Response, next);

      expect(mockService.getAllFAQs).toHaveBeenCalledWith(false);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockFaqs }));
    });

    it('should parse activeOnly=true from query', async () => {
      req.query = { activeOnly: 'true' };
      mockService.getAllFAQs.mockResolvedValue([]);

      await controller.getAllFAQs(req as Request, res as Response, next);

      expect(mockService.getAllFAQs).toHaveBeenCalledWith(true);
    });

    it('should call next on error', async () => {
      mockService.getAllFAQs.mockRejectedValue(new Error('DB error'));
      await controller.getAllFAQs(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getFAQsByCategory', () => {
    it('should return FAQs by category', async () => {
      req.params = { category: 'general' };
      req.query = { activeOnly: 'false' };
      const mockFaqs = [{ _id: '1' }];
      mockService.getFAQsByCategory.mockResolvedValue(mockFaqs as any);

      await controller.getFAQsByCategory(req as Request, res as Response, next);

      expect(mockService.getFAQsByCategory).toHaveBeenCalledWith('general', false);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.params = { category: 'general' };
      mockService.getFAQsByCategory.mockRejectedValue(new Error('fail'));
      await controller.getFAQsByCategory(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getFAQById', () => {
    it('should return FAQ by id', async () => {
      req.params = { id: 'faq-123' };
      const mockFaq = { _id: 'faq-123', question: 'Q1' };
      mockService.getFAQById.mockResolvedValue(mockFaq as any);

      await controller.getFAQById(req as Request, res as Response, next);

      expect(mockService.getFAQById).toHaveBeenCalledWith('faq-123');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockFaq }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'x' };
      mockService.getFAQById.mockRejectedValue(new Error('fail'));
      await controller.getFAQById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createFAQ', () => {
    it('should create a new FAQ', async () => {
      req.body = { question: 'Q?', answer: 'A.' };
      const newFaq = { _id: 'new-faq', ...req.body };
      mockService.createFAQ.mockResolvedValue(newFaq as any);

      await controller.createFAQ(req as Request, res as Response, next);

      expect(mockService.createFAQ).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201, data: newFaq }));
    });

    it('should call next on error', async () => {
      mockService.createFAQ.mockRejectedValue(new Error('fail'));
      await controller.createFAQ(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateFAQ', () => {
    it('should update a FAQ', async () => {
      req.params = { id: 'faq-123' };
      req.body = { answer: 'updated' };
      const updated = { _id: 'faq-123', answer: 'updated' };
      mockService.updateFAQ.mockResolvedValue(updated as any);

      await controller.updateFAQ(req as Request, res as Response, next);

      expect(mockService.updateFAQ).toHaveBeenCalledWith('faq-123', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'x' };
      mockService.updateFAQ.mockRejectedValue(new Error('fail'));
      await controller.updateFAQ(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteFAQ', () => {
    it('should delete a FAQ', async () => {
      req.params = { id: 'faq-123' };
      mockService.deleteFAQ.mockResolvedValue({ _id: 'faq-123' } as any);

      await controller.deleteFAQ(req as Request, res as Response, next);

      expect(mockService.deleteFAQ).toHaveBeenCalledWith('faq-123');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'x' };
      mockService.deleteFAQ.mockRejectedValue(new Error('fail'));
      await controller.deleteFAQ(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      const cats = ['general', 'courses'];
      mockService.getCategories.mockResolvedValue(cats as any);

      await controller.getCategories(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: cats }));
    });

    it('should call next on error', async () => {
      mockService.getCategories.mockRejectedValue(new Error('fail'));
      await controller.getCategories(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateFAQOrder', () => {
    it('should update FAQ order', async () => {
      req.body = { orderUpdates: [{ id: '1', order: 0 }] };
      const result = { updated: 1 };
      mockService.updateFAQOrder.mockResolvedValue(result as any);

      await controller.updateFAQOrder(req as Request, res as Response, next);

      expect(mockService.updateFAQOrder).toHaveBeenCalledWith(req.body.orderUpdates);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.body = { orderUpdates: [] };
      mockService.updateFAQOrder.mockRejectedValue(new Error('fail'));
      await controller.updateFAQOrder(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
