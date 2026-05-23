import { Request, Response, NextFunction } from 'express';
import BankAccountController from '../bankAccount.controller';
import BankAccountService from '@/services/bankAccount.service';

jest.mock('@/services/bankAccount.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('BankAccountController', () => {
  let controller: BankAccountController;
  let mockService: jest.Mocked<BankAccountService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockAccounts = [
    { _id: 'acc-1', alias: 'mi-cuenta', cbu: '1234567890123456789012' },
    { _id: 'acc-2', alias: 'otra-cuenta', cbu: '9876543210987654321098' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new BankAccountService({} as any) as jest.Mocked<BankAccountService>;
    controller = new BankAccountController(mockService);
    req = { body: {}, params: {}, query: {} };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getAllBankAccounts', () => {
    it('should return all bank accounts', async () => {
      mockService.getAllBankAccounts.mockResolvedValue(mockAccounts as any);

      await controller.getAllBankAccounts(req as Request, res as Response, next);

      expect(mockService.getAllBankAccounts).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockAccounts }));
    });

    it('should call next on error', async () => {
      mockService.getAllBankAccounts.mockRejectedValue(new Error('DB error'));
      await controller.getAllBankAccounts(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBankAccountsForStudent', () => {
    it('should return bank accounts for ALUMNO role', async () => {
      req.user = { _id: 'user-1', roles: ['ALUMNO'] } as any;
      mockService.getAllBankAccounts.mockResolvedValue(mockAccounts as any);

      await controller.getBankAccountsForStudent(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 403 if user is not ALUMNO', async () => {
      req.user = { _id: 'user-1', roles: ['ADMIN'] } as any;

      await controller.getBankAccountsForStudent(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(mockService.getAllBankAccounts).not.toHaveBeenCalled();
    });

    it('should return 403 if user is undefined', async () => {
      req.user = undefined;

      await controller.getBankAccountsForStudent(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should call next on service error', async () => {
      req.user = { _id: 'user-1', roles: ['ALUMNO'] } as any;
      mockService.getAllBankAccounts.mockRejectedValue(new Error('fail'));
      await controller.getBankAccountsForStudent(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getPublicBankAccounts', () => {
    it('should return only alias and cbu', async () => {
      mockService.getAllBankAccounts.mockResolvedValue(mockAccounts as any);

      await controller.getPublicBankAccounts(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          data: [
            { alias: 'mi-cuenta', cbu: '1234567890123456789012' },
            { alias: 'otra-cuenta', cbu: '9876543210987654321098' },
          ],
        })
      );
    });

    it('should call next on error', async () => {
      mockService.getAllBankAccounts.mockRejectedValue(new Error('fail'));
      await controller.getPublicBankAccounts(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateBankAccount', () => {
    it('should update bank account', async () => {
      req.params = { id: 'acc-1' };
      req.body = { alias: 'nueva-cuenta' };
      const updated = { _id: 'acc-1', alias: 'nueva-cuenta' };
      mockService.updateBankAccount.mockResolvedValue(updated as any);

      await controller.updateBankAccount(req as Request, res as Response, next);

      expect(mockService.updateBankAccount).toHaveBeenCalledWith('acc-1', req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: updated }));
    });

    it('should call next on error', async () => {
      req.params = { id: 'acc-1' };
      mockService.updateBankAccount.mockRejectedValue(new Error('fail'));
      await controller.updateBankAccount(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
