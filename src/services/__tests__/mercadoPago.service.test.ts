
/* eslint-env jest */
// Set environment variables before importing anything
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
process.env.NODE_ENV = 'test';

// Mock dependencies BEFORE importing the service
const mockCreate = jest.fn();
const mockGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockCreate,
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockGet,
  })),
}));

jest.mock('@/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  maskSensitiveFields: jest.fn((data) => data),
}));

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createPaymentPreference, getPaymentInfo, processWebhookNotification, validateMercadoPagoConfig } from '@/services/mercadoPago.service';
import { logger, maskSensitiveFields } from '@/utils';

const mockMercadoPagoConfig = MercadoPagoConfig as jest.MockedClass<typeof MercadoPagoConfig>;
const mockPreference = Preference as jest.MockedClass<typeof Preference>;
const mockPayment = Payment as jest.MockedClass<typeof Payment>;
describe('MercadoPago Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    process.env.FRONTEND_URL = 'http://localhost:3001';
    process.env.BACKEND_URL = 'http://localhost:8080';
  });
  describe('createPaymentPreference', () => {
    test('creates payment preference successfully', async () => {
      const data = {
        items: [{ id: 'item1', title: 'Test Item', description: 'Desc', quantity: 1, currency_id: 'ARS', unit_price: 100 }],
        payer: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
      };
      const mockResponse = {
        id: 'pref-id',
        init_point: 'init-point',
        sandbox_init_point: 'sandbox-init',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await createPaymentPreference(data);
      expect(result).toEqual({
        id: 'pref-id',
        initPoint: 'init-point',
        sandboxInitPoint: 'sandbox-init',
        mode: 'production',
      });
      expect(mockCreate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
    test('throws error on API failure', async () => {
      const data = {
        items: [{ id: 'item1', title: 'Test Item', description: 'Desc', quantity: 1, currency_id: 'ARS', unit_price: 100 }],
        payer: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
      };

      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(createPaymentPreference(data)).rejects.toThrow('MercadoPago Error: API Error');
      expect(logger.error).toHaveBeenCalled();
    });
  });
  describe('getPaymentInfo', () => {
    test('retrieves payment info successfully', async () => {
      const paymentId = '12345';
      const mockPaymentInfo = { status: 'approved', transaction_amount: 100 };

      mockGet.mockResolvedValue(mockPaymentInfo);

      const result = await getPaymentInfo(paymentId);
      expect(result).toEqual(mockPaymentInfo);
      expect(mockGet).toHaveBeenCalledWith({ id: paymentId });
    });
    test('throws error on API failure', async () => {
      const paymentId = '12345';

      mockGet.mockRejectedValue(new Error('API Error'));

      await expect(getPaymentInfo(paymentId)).rejects.toThrow('Error al obtener información del pago: API Error');
    });
  });
  describe('processWebhookNotification', () => {
    test('processes payment webhook successfully', async () => {
      const notificationData = { type: 'payment', data: { id: '12345' } };
      const mockPaymentInfo = {
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 100,
        external_reference: 'ref',
        payer: { email: 'john@example.com', id: 'payer-id' },
        date_created: '2023-01-01',
      };

      mockGet.mockResolvedValue(mockPaymentInfo);

      const result = await processWebhookNotification(notificationData);
      expect(result).toEqual({
        paymentId: '12345',
        status: 'approved',
        statusDetail: 'accredited',
        amount: 100,
        externalReference: 'ref',
        transactionDate: '2023-01-01',
        payer: {
          email: 'john@example.com',
          id: 'payer-id',
        },
      });
    });
    test('returns null for non-payment type', async () => {
      const notificationData = { type: 'other', data: { id: '12345' } };
      const result = await processWebhookNotification(notificationData);
      expect(result).toBeNull();
    });
    test('throws error on processing failure', async () => {
      const notificationData = { type: 'payment', data: { id: '12345' } };

      mockGet.mockRejectedValue(new Error('API Error'));

      await expect(processWebhookNotification(notificationData)).rejects.toThrow('Error al procesar notificación de webhook');
    });
  });
  describe('validateMercadoPagoConfig', () => {
    test('validates config successfully', () => {
      process.env.MERCADOPAGO_ACCESS_TOKEN = 'token';
      const result = validateMercadoPagoConfig();
      expect(result).toBe(true);
    });
    test('throws error if token missing', () => {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      expect(() => validateMercadoPagoConfig()).toThrow('MERCADOPAGO_ACCESS_TOKEN environment variable is required');
    });
  });
});
