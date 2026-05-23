import { Types } from 'mongoose';
import PaymentRepository from '../payment.repository';

describe('PaymentRepository', () => {
  let repository: PaymentRepository;
  let mockModel: any;
  let mockConnection: any;

  beforeEach(() => {
    mockModel = {
      create: jest.fn(),
    };

    mockConnection = {
      model: jest.fn().mockReturnValue(mockModel),
    };

    repository = new PaymentRepository(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize the model', () => {
      expect(mockConnection.model).toHaveBeenCalledWith('PaymentRequest', expect.anything(), 'paymentRequests');
    });
  });

  describe('submitPayment', () => {
    it('should throw error if courseId is invalid', async () => {
      await expect(repository.submitPayment({ courseId: 'invalid-id' as any })).rejects.toThrow('El ID del curso proporcionado no es válido.');
    });

    it('should create payment request with valid data', async () => {
      const validId = new Types.ObjectId();
      const paymentData = { courseId: validId, amount: 100 } as any;
      const createdData = { _id: '1', ...paymentData };
      
      mockModel.create.mockResolvedValueOnce(createdData);

      const result = await repository.submitPayment(paymentData);

      expect(mockModel.create).toHaveBeenCalledWith(paymentData);
      expect(result).toEqual(createdData);
    });

    it('should create payment request if courseId is omitted', async () => {
      const paymentData = { amount: 100 } as any;
      const createdData = { _id: '1', ...paymentData };
      
      mockModel.create.mockResolvedValueOnce(createdData);

      const result = await repository.submitPayment(paymentData);

      expect(mockModel.create).toHaveBeenCalledWith(paymentData);
      expect(result).toEqual(createdData);
    });
  });
});
