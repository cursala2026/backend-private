import { NextFunction, Request, Response } from 'express';
import prepareResponse from '../utils/api-response';
import BankAccountService from '@/services/bankAccount.service';

export default class BankAccountController {
  constructor(private readonly bankAccountService: BankAccountService) {}

  /**
   * Get all bank accounts
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
   * Update bank account
   */
  updateBankAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedAccount = await this.bankAccountService.updateBankAccount(id, updateData);

      return res.json(prepareResponse(200, 'Bank account updated successfully', updatedAccount));
    } catch (error) {
      return next(error);
    }
  };
}
