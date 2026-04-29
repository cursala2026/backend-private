import { NextFunction, Request, Response } from 'express';
import { IUser } from '../models/user.model';
import prepareResponse from '../utils/api-response';
import BankAccountService from '@/services/bankAccount.service';

export default class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  /**
   * Obtiner todas las cuentas bancarias
   */
  getAllBankAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bankAccounts = await this.bankAccountService.getAllBankAccounts();
      return res.json(prepareResponse(200, 'Bank accounts fetched successfully', bankAccounts));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get bank accounts for student users
   */
  getBankAccountsForStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      if (!user || !user.roles || !user.roles.includes('ALUMNO')) {
        return res.status(403).json(prepareResponse(403, 'Access denied. Only students can access this resource.'));
      }

      const bankAccounts = await this.bankAccountService.getAllBankAccounts();
      return res.json(prepareResponse(200, 'Bank accounts fetched successfully', bankAccounts));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Public endpoint for students area: returns non-sensitive bank account info
   * (alias and last 4 digits of CBU) without requiring authentication.
   */
  getPublicBankAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bankAccounts = await this.bankAccountService.getAllBankAccounts();

      const publicAccounts = bankAccounts.map((acc: any) => ({
        alias: acc.alias,
        cbu: acc.cbu,
      }));

      return res.json(prepareResponse(200, 'Public bank accounts fetched successfully', publicAccounts));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Update bank account
   */
  updateBankAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const updateData = req.body;

      const updatedAccount = await this.bankAccountService.updateBankAccount(id, updateData);

      return res.json(prepareResponse(200, 'Bank account updated successfully', updatedAccount));
    } catch (error) {
      return next(error);
    }
  };
}
