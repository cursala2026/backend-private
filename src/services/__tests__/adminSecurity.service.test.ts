/* eslint-env jest */
import mongoose from 'mongoose';
import crypto from 'crypto';
import AdminSecurityService from '@/services/adminSecurity.service';
import AdminVerificationCode from '@/models/mongo/adminVerificationCode.model';
import { sendEmail, logger } from '@/utils';
import config from '@/config';

// Mock dependencies
jest.mock('mongoose');
jest.mock('crypto');
jest.mock('@/utils', () => ({
  sendEmail: jest.fn(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/config', () => ({
  ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
}));

// Mock the AdminVerificationCode model with static methods
const mockAdminVerificationCode = {
  updateMany: jest.fn(),
  findOne: jest.fn(),
  deleteMany: jest.fn(),
};

const mockInstance = {
  _id: 'code-id',
  save: jest.fn().mockResolvedValue({ _id: 'code-id' }),
};

jest.mock('@/models/mongo/adminVerificationCode.model', () => ({
  __esModule: true,
  default: jest.fn(() => mockInstance),
}));

// Add static methods to the mock
Object.assign(jest.mocked(require('@/models/mongo/adminVerificationCode.model').default), mockAdminVerificationCode);

describe('AdminSecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAndSendCode', () => {
    test('generates and sends code successfully', async () => {
      const request = {
        userId: '507f1f77bcf86cd799439011',
        action: 'edit_bank_account',
        userData: { email: 'user@example.com' },
        metadata: { formType: 'bank' },
      };

      mockAdminVerificationCode.updateMany.mockResolvedValue({});
      (crypto.randomInt as jest.Mock).mockReturnValue(123456);
      (sendEmail as jest.Mock).mockResolvedValue({});
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);

      const result = await AdminSecurityService.generateAndSendCode(request);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Código de verificación enviado al email del administrador');
      expect(mockAdminVerificationCode.updateMany).toHaveBeenCalled();
      expect(mockInstance.save).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalled();
    });

    test('returns error for invalid userId', async () => {
      const request = {
        userId: 'invalid',
        action: 'edit_bank_account',
        userData: { email: 'user@example.com' },
        metadata: { formType: 'bank' },
      };

      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(false);

      const result = await AdminSecurityService.generateAndSendCode(request);

      expect(result.success).toBe(false);
      expect(result.message).toBe('ID de usuario inválido');
    });

    test('handles error during code generation', async () => {
      const request = {
        userId: '507f1f77bcf86cd799439011',
        action: 'edit_bank_account',
        userData: { email: 'user@example.com' },
        metadata: { formType: 'bank' },
      };

      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);
      mockAdminVerificationCode.updateMany.mockRejectedValue(new Error('DB error'));

      const result = await AdminSecurityService.generateAndSendCode(request);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error generando código de verificación');
    });
  });

  describe('verifyCode', () => {
    test('verifies code successfully', async () => {
      const request = {
        userId: '507f1f77bcf86cd799439011',
        action: 'edit_bank_account',
        code: '123456',
      };

      const mockCode = { _id: 'code-id', isUsed: false, save: jest.fn() };
      mockAdminVerificationCode.findOne.mockResolvedValue(mockCode);
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);

      const result = await AdminSecurityService.verifyCode(request);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Código verificado correctamente');
      expect(mockCode.isUsed).toBe(true);
      expect(mockCode.save).toHaveBeenCalled();
    });

    test('returns error for invalid or expired code', async () => {
      const request = {
        userId: '507f1f77bcf86cd799439011',
        action: 'edit_bank_account',
        code: '123456',
      };

      mockAdminVerificationCode.findOne.mockResolvedValue(null);
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);

      const result = await AdminSecurityService.verifyCode(request);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Código inválido o expirado');
    });

    test('handles error during verification', async () => {
      const request = {
        userId: '507f1f77bcf86cd799439011',
        action: 'edit_bank_account',
        code: '123456',
      };

      mockAdminVerificationCode.findOne.mockRejectedValue(new Error('DB error'));
      (mongoose.Types.ObjectId.isValid as jest.Mock).mockReturnValue(true);

      const result = await AdminSecurityService.verifyCode(request);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error verificando código');
    });
  });

  describe('cleanupExpiredCodes', () => {
    test('cleans up expired codes', async () => {
      mockAdminVerificationCode.deleteMany.mockResolvedValue({ deletedCount: 5 });

      await AdminSecurityService.cleanupExpiredCodes();

      expect(mockAdminVerificationCode.deleteMany).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 5 expired verification codes');
    });

    test('handles error during cleanup', async () => {
      mockAdminVerificationCode.deleteMany.mockRejectedValue(new Error('DB error'));

      await AdminSecurityService.cleanupExpiredCodes();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('hasRecentCode', () => {
    test('returns true if recent code exists', async () => {
      mockAdminVerificationCode.findOne.mockResolvedValue({ _id: 'code-id' });

      const result = await AdminSecurityService.hasRecentCode('user-id', 'action');

      expect(result).toBe(true);
    });

    test('returns false if no recent code', async () => {
      mockAdminVerificationCode.findOne.mockResolvedValue(null);

      const result = await AdminSecurityService.hasRecentCode('user-id', 'action');

      expect(result).toBe(false);
    });

    test('handles error and returns false', async () => {
      mockAdminVerificationCode.findOne.mockRejectedValue(new Error('DB error'));

      const result = await AdminSecurityService.hasRecentCode('user-id', 'action');

      expect(result).toBe(false);
    });
  });
});
