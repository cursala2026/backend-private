
/* eslint-env jest */
// Set environment variables before importing anything
jest.mock('@/config/errors', () => ({
  __esModule: true,
  default: {}
}));
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
process.env.NODE_ENV = 'test';

import MercadoPagoPaymentService from '@/services/mercadoPagoPayment.service';
import MercadoPagoRepository from '@/repositories/mercadoPago.repository';
import UserRepository from '@/repositories/user.repository';
import CourseRepository from '@/repositories/course.repository';
import { sendEmail, logger, maskSensitiveFields } from '@/utils';
import * as MercadoPagoService from '@/services/mercadoPago.service';
import config from '@/config';
// Mock dependencies
jest.mock('@/repositories/mercadoPago.repository');
jest.mock('@/repositories/user.repository');
jest.mock('@/repositories/course.repository');
jest.mock('@/utils', () => ({
  sendEmail: jest.fn(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  maskSensitiveFields: jest.fn((data) => data),
}));
jest.mock('@/services/mercadoPago.service');
jest.mock('@/config', () => ({
  ADMINISTRATION_EMAIL: 'admin@example.com',
}));
const mockMercadoPagoRepository = MercadoPagoRepository as jest.MockedClass<typeof MercadoPagoRepository>;
const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockCourseRepository = CourseRepository as jest.MockedClass<typeof CourseRepository>;
describe('MercadoPagoPaymentService', () => {
  let service: MercadoPagoPaymentService;
  let mockRepositoryInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a mock instance with all methods
    mockRepositoryInstance = {
      findByPaymentId: jest.fn(),
      createPayment: jest.fn(),
      updatePaymentStatus: jest.fn(),
      getPaymentsByStudent: jest.fn(),
      getPaymentStats: jest.fn(),
    };
    // Mock the constructor to return our instance
    mockMercadoPagoRepository.mockImplementation(() => mockRepositoryInstance);
    service = new MercadoPagoPaymentService(mockRepositoryInstance);
  });
  describe('registerSuccessfulPayment', () => {
    test('registers payment successfully', async () => {
      const paymentData = {
        paymentId: '12345',
        courseId: 'course1',
        studentEmail: 'student@example.com',
        amount: 100,
        externalReference: 'ref_course1',
      };
      const mockPaymentInfo = {
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'ARS',
        payer: { first_name: 'John', last_name: 'Doe', email: 'student@example.com', id: 'payer-id' },
        date_created: '2023-01-01',
        date_approved: '2023-01-01',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 1,
      };
      const mockCourse = { name: 'Test Course' };
      const mockPaymentRecord = { paymentId: '12345' };
      mockRepositoryInstance.findByPaymentId.mockResolvedValue(null);
      (MercadoPagoService.getPaymentInfo as jest.Mock).mockResolvedValue(mockPaymentInfo);
      mockCourseRepository.prototype.findOneById = jest.fn().mockResolvedValue(mockCourse);
      mockRepositoryInstance.createPayment.mockResolvedValue(mockPaymentRecord);
      mockUserRepository.prototype.findOneByEmail = jest.fn().mockResolvedValue({ _id: 'user-id', firstName: 'John' });
      mockUserRepository.prototype.assignCourseToUser = jest.fn().mockResolvedValue({});

      // Mock the sendPaymentConfirmationEmails call
      (sendEmail as jest.Mock).mockResolvedValue({});

      const result = await service.registerSuccessfulPayment(paymentData);
      expect(result).toEqual(mockPaymentRecord);
      expect(mockRepositoryInstance.createPayment).toHaveBeenCalled();
      // The service calls sendEmail for emails in sendPaymentConfirmationEmails
      expect(logger.info).toHaveBeenCalled();
    });
    test('returns existing payment if already exists', async () => {
      const existingPayment = { paymentId: '12345' };
      mockRepositoryInstance.findByPaymentId.mockResolvedValue(existingPayment);
      const result = await service.registerSuccessfulPayment({ paymentId: '12345', courseId: 'course1', studentEmail: 'student@example.com', amount: 100, externalReference: 'ref_course1' });
      expect(result).toEqual(existingPayment);
      expect(MercadoPagoService.getPaymentInfo).not.toHaveBeenCalled();
    });
    test('throws error if payment not approved', async () => {
      const paymentData = {
        paymentId: '12345',
        courseId: 'course1',
        studentEmail: 'student@example.com',
        amount: 100,
        externalReference: 'ref_course1',
      };
      const mockPaymentInfo = { status: 'pending' };
      (MercadoPagoService.getPaymentInfo as jest.Mock).mockResolvedValue(mockPaymentInfo);
      await expect(service.registerSuccessfulPayment(paymentData)).rejects.toThrow('Payment is not approved');
    });
  });
  describe('processWebhookNotification', () => {
    test('processes payment webhook successfully', async () => {
      const webhookData = { type: 'payment', data: { id: '12345', external_reference: 'ref_course1' } };
      const mockPaymentInfo = {
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        currency_id: 'ARS',
        payer: { first_name: 'John', last_name: 'Doe', email: 'student@example.com', id: 'payer-id' },
        date_created: '2023-01-01',
        date_approved: '2023-01-01',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        installments: 1,
        external_reference: 'ref_course1',
      };

      (MercadoPagoService.getPaymentInfo as jest.Mock).mockResolvedValue(mockPaymentInfo);
      mockRepositoryInstance.findByPaymentId.mockResolvedValue(null);
      mockCourseRepository.prototype.findOneById = jest.fn().mockResolvedValue({ name: 'Test Course' });
      mockRepositoryInstance.createPayment.mockResolvedValue({ paymentId: '12345', status: 'approved' });
      mockUserRepository.prototype.findOneByEmail = jest.fn().mockResolvedValue({ _id: 'user-id', firstName: 'John' });
      mockUserRepository.prototype.assignCourseToUser = jest.fn().mockResolvedValue({});
      (sendEmail as jest.Mock).mockResolvedValue({});

      const result = await service.processWebhookNotification(webhookData);
      expect(result).toBeDefined();
    });
    test('returns null for non-payment type', async () => {
      const webhookData = { type: 'other' };
      const result = await service.processWebhookNotification(webhookData);
      expect(result).toBeNull();
    });
    test('updates existing payment', async () => {
      const webhookData = { type: 'payment', data: { id: '12345' } };
      const mockPaymentInfo = { status: 'approved', external_reference: 'ref_course1' };
      const updatedPayment = { paymentId: '12345', status: 'approved' };
      (MercadoPagoService.getPaymentInfo as jest.Mock).mockResolvedValue(mockPaymentInfo);
      mockRepositoryInstance.findByPaymentId.mockResolvedValue({ paymentId: '12345', status: 'pending' });
      mockRepositoryInstance.updatePaymentStatus.mockResolvedValue(updatedPayment);
      const result = await service.processWebhookNotification(webhookData);
      expect(result).toEqual(updatedPayment);
      expect(mockRepositoryInstance.updatePaymentStatus).toHaveBeenCalled();
    });
  });
  describe('getStudentPayments', () => {
    test('retrieves student payments', async () => {
      const studentEmail = 'student@example.com';
      const payments = [{ paymentId: '12345' }];
      mockRepositoryInstance.getPaymentsByStudent.mockResolvedValue(payments);
      const result = await service.getStudentPayments(studentEmail);
      expect(result).toEqual(payments);
      expect(mockRepositoryInstance.getPaymentsByStudent).toHaveBeenCalledWith(studentEmail);
    });
  });
  describe('getPaymentStats', () => {
    test('retrieves payment stats', async () => {
      const stats = { total: 100 };
      mockRepositoryInstance.getPaymentStats.mockResolvedValue(stats);
      const result = await service.getPaymentStats();
      expect(result).toEqual(stats);
      expect(mockRepositoryInstance.getPaymentStats).toHaveBeenCalled();
    });
  });
});
