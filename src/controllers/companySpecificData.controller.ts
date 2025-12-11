import { NextFunction, Request, Response } from 'express';
import prepareResponse from '../utils/api-response';
import CompanySpecificDataService from '@/services/companySpecificData.service';

export default class CompanySpecificDataController {
  constructor(private readonly companySpecificDataService: CompanySpecificDataService) {}

  /**
   * Get all company specific data
   */
  getAllCompanySpecificData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.companySpecificDataService.getAllCompanySpecificData();
      return res.json(prepareResponse(200, 'Datos específicos de la compañía obtenidos correctamente', data));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Update company privacy policy
   */
  updateCompanySpecificData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedData = await this.companySpecificDataService.updateCompanySpecificData(id, updateData);

      return res.json(prepareResponse(200, 'Datos específicos de la compañía actualizados correctamente', updatedData));
    } catch (error) {
      return next(error);
    }
  };
}
