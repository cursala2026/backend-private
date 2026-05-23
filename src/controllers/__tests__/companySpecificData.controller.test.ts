import { Request, Response, NextFunction } from 'express';
import CompanySpecificDataController from '../companySpecificData.controller';
import CompanySpecificDataService from '@/services/companySpecificData.service';

jest.mock('@/services/companySpecificData.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('CompanySpecificDataController', () => {
  let controller: CompanySpecificDataController;
  let mockService: jest.Mocked<CompanySpecificDataService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockData = { _id: 'csd-1', privacyPolicy: 'Policy text', partnerLogos: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new CompanySpecificDataService({} as any) as jest.Mocked<CompanySpecificDataService>;
    controller = new CompanySpecificDataController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllCompanySpecificData', () => {
    it('should return all company specific data', async () => {
      mockService.getAllCompanySpecificData.mockResolvedValue([mockData] as any);

      await controller.getAllCompanySpecificData(req as Request, res as Response, next);

      expect(mockService.getAllCompanySpecificData).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: [mockData] }));
    });

    it('should call next on error', async () => {
      mockService.getAllCompanySpecificData.mockRejectedValue(new Error('fail'));
      await controller.getAllCompanySpecificData(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateCompanySpecificData', () => {
    it('should update company specific data', async () => {
      req.params = { id: 'csd-1' };
      req.body = { privacyPolicy: 'Updated policy' };
      const updated = { ...mockData, privacyPolicy: 'Updated policy' };
      mockService.updateCompanySpecificData.mockResolvedValue(updated as any);

      await controller.updateCompanySpecificData(req as Request, res as Response, next);

      expect(mockService.updateCompanySpecificData).toHaveBeenCalledWith('csd-1', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'csd-1' };
      mockService.updateCompanySpecificData.mockRejectedValue(new Error('fail'));
      await controller.updateCompanySpecificData(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('uploadCertificateLogo', () => {
    it('should upload logo when file is present', async () => {
      req.params = { id: 'csd-1' };
      req.file = { buffer: Buffer.from('img'), originalname: 'logo.png' } as Express.Multer.File;
      const updated = { ...mockData, partnerLogos: ['https://cdn.test/logo.png'] };
      mockService.addCertificateLogo.mockResolvedValue(updated as any);

      await controller.uploadCertificateLogo(req as Request, res as Response, next);

      expect(mockService.addCertificateLogo).toHaveBeenCalledWith('csd-1', req.file.buffer, 'logo.png');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if no file provided', async () => {
      req.params = { id: 'csd-1' };
      req.file = undefined;

      await controller.uploadCertificateLogo(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.addCertificateLogo).not.toHaveBeenCalled();
    });

    it('should return 400 if service throws "máximo de" error', async () => {
      req.params = { id: 'csd-1' };
      req.file = { buffer: Buffer.from('img'), originalname: 'logo.png' } as Express.Multer.File;
      mockService.addCertificateLogo.mockRejectedValue(new Error('Se alcanzó el máximo de logos permitidos'));

      await controller.uploadCertificateLogo(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next on other errors', async () => {
      req.params = { id: 'csd-1' };
      req.file = { buffer: Buffer.from('img'), originalname: 'logo.png' } as Express.Multer.File;
      mockService.addCertificateLogo.mockRejectedValue(new Error('DB error'));

      await controller.uploadCertificateLogo(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('removeCertificateLogo', () => {
    it('should remove logo by valid index', async () => {
      req.params = { id: 'csd-1', index: '0' };
      mockService.removeCertificateLogo.mockResolvedValue(mockData as any);

      await controller.removeCertificateLogo(req as Request, res as Response, next);

      expect(mockService.removeCertificateLogo).toHaveBeenCalledWith('csd-1', 0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if index is NaN', async () => {
      req.params = { id: 'csd-1', index: 'abc' };

      await controller.removeCertificateLogo(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.removeCertificateLogo).not.toHaveBeenCalled();
    });

    it('should return 400 if index is negative', async () => {
      req.params = { id: 'csd-1', index: '-1' };

      await controller.removeCertificateLogo(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if service throws "Índice" error', async () => {
      req.params = { id: 'csd-1', index: '99' };
      mockService.removeCertificateLogo.mockRejectedValue(new Error('Índice fuera de rango'));

      await controller.removeCertificateLogo(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next on other errors', async () => {
      req.params = { id: 'csd-1', index: '0' };
      mockService.removeCertificateLogo.mockRejectedValue(new Error('DB error'));

      await controller.removeCertificateLogo(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
