
/* eslint-env jest */
import PaymentService from '@/services/payment.service';
import PaymentRepository from '@/repositories/payment.repository';
import { sendEmail } from '@/utils/emailer';
import config from '@/config';
// Mock dependencies
jest.mock('@/repositories/payment.repository');
jest.mock('@/utils/emailer');
jest.mock('@/config', () => ({
  INFO_EMAIL: 'info@example.com',
}));
const mockPaymentRepository = PaymentRepository as jest.MockedClass<typeof PaymentRepository>;
describe('PaymentService', () => {
  let service: PaymentService;
  let mockRepository: jest.Mocked<PaymentRepository>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = mockPaymentRepository.prototype as unknown as jest.Mocked<PaymentRepository>;
    service = new PaymentService(mockRepository);
  });
  describe('submitPayment', () => {
    test('submits payment successfully', async () => {
      const paymentData = {
        studentName: 'John Doe',
        studentEmail: 'john@example.com',
        courseName: 'Test Course',
        coursePrice: 100,
        finalPrice: 90,
        promotionalCodeApplied: true,
        promotionalCode: 'DISCOUNT10',
        discountAmount: 10,
        paymentTicket: 'ticket.pdf',
      };
      const mockResult = { id: 'payment-id' };
      mockRepository.submitPayment = jest.fn().mockResolvedValue(mockResult);
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await service.submitPayment(paymentData);
      expect(result).toEqual(mockResult);
      expect(mockRepository.submitPayment).toHaveBeenCalledWith(paymentData);
      expect(sendEmail).toHaveBeenCalledTimes(2);
    });
    test('submits payment without promotional code', async () => {
      const paymentData = {
        studentName: 'Jane Smith',
        studentEmail: 'jane@example.com',
        courseName: 'Test Course 2',
        coursePrice: 200,
        finalPrice: 200,
        promotionalCodeApplied: false,
        paymentTicket: 'ticket2.pdf',
      };
      const mockResult = { id: 'payment-id-2' };
      mockRepository.submitPayment = jest.fn().mockResolvedValue(mockResult);
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await service.submitPayment(paymentData);
      expect(result).toEqual(mockResult);
      expect(mockRepository.submitPayment).toHaveBeenCalledWith(paymentData);
      expect(sendEmail).toHaveBeenCalled();
    });
    test('submits payment without payment ticket', async () => {
      const paymentData = {
        studentName: 'Bob Johnson',
        studentEmail: 'bob@example.com',
        courseName: 'Test Course 3',
        coursePrice: 150,
        finalPrice: 150,
        promotionalCodeApplied: false,
      };
      const mockResult = { id: 'payment-id-3' };
      mockRepository.submitPayment = jest.fn().mockResolvedValue(mockResult);
      (sendEmail as jest.Mock).mockResolvedValue({});
      const result = await service.submitPayment(paymentData);
      expect(result).toEqual(mockResult);
    });
  });
});
