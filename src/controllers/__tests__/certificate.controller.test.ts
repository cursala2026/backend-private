import { Request, Response, NextFunction } from 'express';
import CertificateController from '../certificate.controller';
import CertificateService from '@/services/certificate.service';
import { hasAdminRole } from '@/middlewares/adminSecurity.middleware';

jest.mock('@/services/certificate.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));
jest.mock('@/middlewares/adminSecurity.middleware', () => ({
  hasAdminRole: jest.fn(),
}));

describe('CertificateController', () => {
  let controller: CertificateController;
  let mockService: jest.Mocked<CertificateService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockUser = { _id: 'user-1' };
  const mockCertificate = {
    _id: 'cert-1',
    studentId: 'student-1',
    courseId: 'course-1',
    verificationCode: 'raw-code',
    generatedBy: 'user-1',
    toObject: () => ({ _id: 'cert-1', verificationCode: 'raw-code' })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new CertificateService({} as any, {} as any, {} as any) as jest.Mocked<CertificateService>;
    controller = new CertificateController(mockService);
    req = { body: {}, params: {}, query: {}, user: mockUser as any };
    res = { 
      json: jest.fn(), 
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
    next = jest.fn();
  });

  describe('generateCertificate', () => {
    it('should generate a certificate successfully', async () => {
      req.body = { studentId: 'student-1', courseId: 'course-1' };
      mockService.generateCertificate.mockResolvedValue(mockCertificate as any);

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(mockService.generateCertificate).toHaveBeenCalledWith('student-1', 'course-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    });

    it('should return 400 if required data is missing', async () => {
      req.body = { studentId: 'student-1' }; // missing courseId

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.generateCertificate).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.body = { studentId: 'student-1', courseId: 'course-1' };

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if service throws "no encontrado"', async () => {
      req.body = { studentId: 'student-1', courseId: 'course-1' };
      mockService.generateCertificate.mockRejectedValue(new Error('Curso no encontrado'));

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 409 if service throws "Ya existe"', async () => {
      req.body = { studentId: 'student-1', courseId: 'course-1' };
      mockService.generateCertificate.mockRejectedValue(new Error('Ya existe un certificado'));

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return 403 if service throws "no está inscrito"', async () => {
      req.body = { studentId: 'student-1', courseId: 'course-1' };
      mockService.generateCertificate.mockRejectedValue(new Error('El estudiante no está inscrito'));

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should call next on generic error', async () => {
      req.body = { studentId: 'student-1', courseId: 'course-1' };
      mockService.generateCertificate.mockRejectedValue(new Error('DB failure'));

      await controller.generateCertificate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateCertificate', () => {
    it('should validate certificate successfully', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.validateCertificate.mockResolvedValue({ isValid: true, data: mockCertificate } as any);

      await controller.validateCertificate(req as Request, res as Response, next);

      expect(mockService.validateCertificate).toHaveBeenCalledWith('code123');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if code is missing', async () => {
      req.params = { verificationCode: '' };

      await controller.validateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if result is invalid', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.validateCertificate.mockResolvedValue({ isValid: false, message: 'Invalid' } as any);

      await controller.validateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if service throws "inválido"', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.validateCertificate.mockRejectedValue(new Error('Código inválido'));

      await controller.validateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
    
    it('should call next on generic error', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.validateCertificate.mockRejectedValue(new Error('DB Error'));

      await controller.validateCertificate(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('checkCertificateExists', () => {
    it('should return exists true and encoded verification code', async () => {
      req.params = { studentId: 'student-1', courseId: 'course-1' };
      mockService.checkCertificateExists.mockResolvedValue(mockCertificate as any);

      await controller.checkCertificateExists(req as Request, res as Response, next);

      const encodedCode = Buffer.from('raw-code', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      expect(mockService.checkCertificateExists).toHaveBeenCalledWith('student-1', 'course-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
         data: expect.objectContaining({ 
           exists: true, 
           certificate: expect.objectContaining({ verificationCode: encodedCode }) 
         }) 
      }));
    });

    it('should return exists false if no certificate', async () => {
      req.params = { studentId: 'student-1', courseId: 'course-1' };
      mockService.checkCertificateExists.mockResolvedValue(null as any);

      await controller.checkCertificateExists(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
         data: expect.objectContaining({ exists: false, certificate: null }) 
      }));
    });

    it('should return 400 if params are missing', async () => {
      req.params = { studentId: 'student-1' }; // missing courseId

      await controller.checkCertificateExists(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('debugListAllCertificates', () => {
    it('should list all certificates', async () => {
      mockService.debugListAllCertificates.mockResolvedValue([mockCertificate] as any);

      await controller.debugListAllCertificates(req as Request, res as Response, next);

      expect(mockService.debugListAllCertificates).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });
  });

  describe('getCertificatesByCourse', () => {
    it('should get certificates by course', async () => {
      req.params = { courseId: 'course-1' };
      mockService.getCertificatesByCourse.mockResolvedValue([mockCertificate] as any);

      await controller.getCertificatesByCourse(req as Request, res as Response, next);

      expect(mockService.getCertificatesByCourse).toHaveBeenCalledWith('course-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if courseId is missing', async () => {
      req.params = { courseId: '' };

      await controller.getCertificatesByCourse(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCertificatesByStudent', () => {
    it('should map certificates for student', async () => {
      req.params = { studentId: 'student-1' };
      const certWithPopulatedCourse = {
        ...mockCertificate,
        courseId: { name: 'React Course' }
      };
      mockService.getCertificatesByStudent.mockResolvedValue([certWithPopulatedCourse] as any);

      await controller.getCertificatesByStudent(req as Request, res as Response, next);

      expect(mockService.getCertificatesByStudent).toHaveBeenCalledWith('student-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        data: expect.arrayContaining([
          expect.objectContaining({ courseName: 'React Course' })
        ])
      }));
    });

    it('should return 400 if studentId is missing', async () => {
      req.params = { studentId: '' };

      await controller.getCertificatesByStudent(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteCertificate', () => {
    it('should delete certificate', async () => {
      req.params = { certificateId: 'cert-1' };
      mockService.deleteCertificate.mockResolvedValue({ deleted: true } as any);

      await controller.deleteCertificate(req as Request, res as Response, next);

      expect(mockService.deleteCertificate).toHaveBeenCalledWith('cert-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if certificateId is missing', async () => {
      req.params = { certificateId: '' };

      await controller.deleteCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if user is unauthenticated', async () => {
      req.user = undefined;
      req.params = { certificateId: 'cert-1' };

      await controller.deleteCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if service throws "no encontrado"', async () => {
      req.params = { certificateId: 'cert-1' };
      mockService.deleteCertificate.mockRejectedValue(new Error('Certificado no encontrado'));

      await controller.deleteCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('regenerateCertificate', () => {
    beforeEach(() => {
      (hasAdminRole as jest.Mock).mockReturnValue(false);
    });

    it('should regenerate if user is original generator', async () => {
      req.params = { certificateId: 'cert-1' };
      mockService.checkCertificateExistsById.mockResolvedValue(mockCertificate as any);
      mockService.regenerateCertificate.mockResolvedValue({ ...mockCertificate, new: true } as any);

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(mockService.regenerateCertificate).toHaveBeenCalledWith('cert-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should regenerate if user is admin', async () => {
      req.params = { certificateId: 'cert-1' };
      req.user = { _id: 'admin-1' } as any;
      (hasAdminRole as jest.Mock).mockReturnValue(true);
      
      const existingCert = { ...mockCertificate, generatedBy: 'user-1' };
      mockService.checkCertificateExistsById.mockResolvedValue(existingCert as any);
      mockService.regenerateCertificate.mockResolvedValue({ ...existingCert, new: true } as any);

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(mockService.regenerateCertificate).toHaveBeenCalledWith('cert-1', 'admin-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 if user is not generator nor admin', async () => {
      req.params = { certificateId: 'cert-1' };
      req.user = { _id: 'other-user' } as any;
      mockService.checkCertificateExistsById.mockResolvedValue(mockCertificate as any);

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockService.regenerateCertificate).not.toHaveBeenCalled();
    });

    it('should return 404 if certificate not found', async () => {
      req.params = { certificateId: 'cert-1' };
      mockService.checkCertificateExistsById.mockResolvedValue(null as any);

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if certificateId is missing', async () => {
      req.params = { certificateId: '' };

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 if unauthenticated', async () => {
      req.user = undefined;
      req.params = { certificateId: 'cert-1' };

      await controller.regenerateCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('downloadCertificate', () => {
    it('should set headers and send pdf buffer', async () => {
      req.params = { verificationCode: 'code123' };
      const mockBuffer = Buffer.from('pdf content');
      mockService.downloadCertificate.mockResolvedValue(mockBuffer as any);

      await controller.downloadCertificate(req as Request, res as Response, next);

      expect(mockService.downloadCertificate).toHaveBeenCalledWith('code123');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', mockBuffer.length);
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('should return 400 if verificationCode is missing', async () => {
      req.params = { verificationCode: '' };

      await controller.downloadCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if service throws "no válido"', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.downloadCertificate.mockRejectedValue(new Error('Código no válido'));

      await controller.downloadCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if service throws "incompletos"', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.downloadCertificate.mockRejectedValue(new Error('Datos incompletos'));

      await controller.downloadCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for other generic errors', async () => {
      req.params = { verificationCode: 'code123' };
      mockService.downloadCertificate.mockRejectedValue(new Error('Server crashed'));

      await controller.downloadCertificate(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
