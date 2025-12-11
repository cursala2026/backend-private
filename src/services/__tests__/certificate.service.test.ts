
/* eslint-env jest */
import CertificateService from '@/services/certificate.service';
import UserRepository from '@/repositories/user.repository';
import CourseRepository from '@/repositories/course.repository';
import CertificateRepository from '@/repositories/certificate.repository';
import { sendEmail } from '@/utils/emailer';
import { logger } from '@/utils';
jest.mock('@/utils/emailer');
jest.mock('@/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/repositories/user.repository');
jest.mock('@/repositories/course.repository');
jest.mock('@/repositories/certificate.repository');
const mockUserRepository: any = {
  getUserById: jest.fn(),
  isUserEnrolledInCourse: jest.fn(),
};
const mockCourseRepository: any = {
  findById: jest.fn(),
};
const mockCertificateRepository: any = {
  findExistingCertificate: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  validateCertificate: jest.fn(),
  findAll: jest.fn(),
  findByCourse: jest.fn(),
  findByStudent: jest.fn(),
  softDelete: jest.fn(),
};
interface CertSvcMock {
  generateCertificatePDF: (...args: unknown[]) => Promise<Buffer>;
  decryptVerificationCode: (...args: unknown[]) => unknown;
}

let certificateService: CertificateService;
beforeEach(() => {
  jest.clearAllMocks();
  certificateService = new CertificateService(mockUserRepository, mockCourseRepository, mockCertificateRepository);
});
describe('CertificateService', () => {
  describe('generateCertificate', () => {
    test('generates certificate successfully', async () => {
      const student = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const course = { name: 'Test Course', description: 'Desc', startDate: new Date() };
      const teacher = { firstName: 'Teacher', lastName: 'One', email: 'teacher@example.com', professionalDescription: 'Prof' };
      const certificate = { certificateId: 'CERT-123', generatedAt: new Date() };
      mockUserRepository.getUserById.mockResolvedValueOnce(student).mockResolvedValueOnce(teacher);
      mockCourseRepository.findById.mockResolvedValue(course);
      mockUserRepository.isUserEnrolledInCourse.mockResolvedValue(true);
      mockCertificateRepository.findExistingCertificate.mockResolvedValue(null);
      mockCertificateRepository.create.mockResolvedValue(certificate);
      // Mock the PDF generation to return a buffer quickly
      interface CertSvcMock {
        generateCertificatePDF: (...args: unknown[]) => Promise<Buffer>;
        decryptVerificationCode: (...args: unknown[]) => unknown;
      }
      // Mock the internal PDF generation method on the service prototype
      jest.spyOn(CertificateService.prototype as any, 'generateCertificatePDFInternal').mockResolvedValue(Buffer.from('mock-pdf'));
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await certificateService.generateCertificate('student-id', 'course-id', 'teacher-id', 'generated-by');
      expect(result).toHaveProperty('certificateId');
      expect(result).toHaveProperty('verificationCode');
      expect(mockCertificateRepository.create).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
    });
    test('throws error if student not found', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);
      await expect(certificateService.generateCertificate('student-id', 'course-id', 'teacher-id', 'generated-by')).rejects.toThrow('Estudiante no encontrado');
    });
    test('throws error if course not found', async () => {
      const student = { firstName: 'John', lastName: 'Doe' };
      mockUserRepository.getUserById.mockResolvedValueOnce(student);
      mockCourseRepository.findById.mockResolvedValue(null);
      await expect(certificateService.generateCertificate('student-id', 'course-id', 'teacher-id', 'generated-by')).rejects.toThrow('Curso no encontrado');
    });
    test('throws error if teacher not found', async () => {
      const student = { firstName: 'John', lastName: 'Doe' };
      const course = { name: 'Test Course' };
      mockUserRepository.getUserById.mockResolvedValueOnce(student).mockResolvedValueOnce(null);
      mockCourseRepository.findById.mockResolvedValue(course);
      await expect(certificateService.generateCertificate('student-id', 'course-id', 'teacher-id', 'generated-by')).rejects.toThrow('Profesor no encontrado');
    });
    test('throws error if student not enrolled', async () => {
      const student = { firstName: 'John', lastName: 'Doe' };
      const course = { name: 'Test Course' };
      const teacher = { firstName: 'Teacher', lastName: 'One' };
      mockUserRepository.getUserById.mockResolvedValueOnce(student).mockResolvedValueOnce(teacher);
      mockCourseRepository.findById.mockResolvedValue(course);
      mockUserRepository.isUserEnrolledInCourse.mockResolvedValue(false);
      await expect(certificateService.generateCertificate('student-id', 'course-id', 'teacher-id', 'generated-by')).rejects.toThrow('El estudiante no está inscrito en este curso');
    });
  });
  describe('validateCertificate', () => {
    test('validates certificate successfully', async () => {
      const certificate = { studentId: 'student', courseId: 'course', teacherId: 'teacher', generatedAt: new Date() };
      // Mock decrypt to return valid non-expired data
      const certSvc2 = certificateService as unknown as CertSvcMock;
      jest.spyOn(certSvc2, 'decryptVerificationCode').mockReturnValue({ expiresAt: new Date(Date.now() + 10000) });
      mockCertificateRepository.validateCertificate.mockResolvedValue(certificate);
      // Mock fetching student, course and teacher
      const student = { _id: 'student', firstName: 'Stu', lastName: 'Dent', email: 'stu@example.com', username: 'stu' };
      const course = { _id: 'course', name: 'Course', description: 'Desc', startDate: new Date() };
      const teacher = { _id: 'teacher', firstName: 'Teach', lastName: 'Er', email: 'teach@example.com', professionalDescription: 'Prof' };
      mockUserRepository.getUserById.mockResolvedValueOnce(student).mockResolvedValueOnce(teacher);
      mockCourseRepository.findById.mockResolvedValue(course);

      const result = await certificateService.validateCertificate('valid-code');
      expect(result.isValid).toBe(true);
      expect(result.student).toBeTruthy();
      expect(result.student!._id).toBe('student');
    });
    test('returns invalid for expired certificate', async () => {
      // Mock decrypt to return expired date
      const certSvc3 = certificateService as unknown as CertSvcMock;
      jest.spyOn(certSvc3, 'decryptVerificationCode').mockReturnValue({ expiresAt: new Date(Date.now() - 1000) });
      const result = await certificateService.validateCertificate('expired-code');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('El certificado ha expirado');
    });
    test('returns invalid for non-existent certificate', async () => {
      // Mock decrypt to return valid non-expired data
      const certSvc4 = certificateService as unknown as CertSvcMock;
      jest.spyOn(certSvc4, 'decryptVerificationCode').mockReturnValue({ expiresAt: new Date(Date.now() + 10000) });
      mockCertificateRepository.validateCertificate.mockResolvedValue(null);
      const result = await certificateService.validateCertificate('invalid-code');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Certificado no encontrado');
    });
  });
  describe('checkCertificateExists', () => {
    test('checks if certificate exists', async () => {
      const certificate = { id: 'cert-id' };
      mockCertificateRepository.findExistingCertificate.mockResolvedValue(certificate);
      const result = await certificateService.checkCertificateExists('student-id', 'course-id');
      expect(result).toEqual(certificate);
      expect(mockCertificateRepository.findExistingCertificate).toHaveBeenCalledWith('student-id', 'course-id');
    });
  });
  describe('getCertificatesByCourse', () => {
    test('gets certificates by course', async () => {
      const certificates = [{ id: 'cert1' }];
      mockCertificateRepository.findByCourse.mockResolvedValue(certificates);
      const result = await certificateService.getCertificatesByCourse('course-id');
      expect(result).toEqual(certificates);
      expect(mockCertificateRepository.findByCourse).toHaveBeenCalledWith('course-id');
    });
  });
  describe('getCertificatesByStudent', () => {
    test('gets certificates by student', async () => {
      const certificates = [{ id: 'cert1' }];
      mockCertificateRepository.findByStudent.mockResolvedValue(certificates);
      const result = await certificateService.getCertificatesByStudent('student-id');
      expect(result).toEqual(certificates);
      expect(mockCertificateRepository.findByStudent).toHaveBeenCalledWith('student-id');
    });
  });
  describe('deleteCertificate', () => {
    test('deletes certificate successfully', async () => {
      const certificate = { id: 'cert-id' };
      mockCertificateRepository.softDelete.mockResolvedValue(certificate);
      const result = await certificateService.deleteCertificate('cert-id');
      expect(result.message).toBe('Certificado eliminado correctamente');
      expect(mockCertificateRepository.softDelete).toHaveBeenCalledWith('cert-id');
    });
    test('throws error if certificate not found', async () => {
      mockCertificateRepository.softDelete.mockResolvedValue(null);
      await expect(certificateService.deleteCertificate('cert-id')).rejects.toThrow('Certificado no encontrado');
    });
  });
});
