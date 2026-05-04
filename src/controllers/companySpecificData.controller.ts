import { NextFunction, Request, Response } from 'express';
import prepareResponse from '../utils/api-response';
import CompanySpecificDataService from '@/services/companySpecificData.service';
import { ensureString } from '@/utils/type-guards';

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
   * Update company specific data (privacy policy, terms, etc.)
   */
  updateCompanySpecificData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = ensureString(req.params.id);
      const updateData = req.body;

      const updatedData = await this.companySpecificDataService.updateCompanySpecificData(id, updateData);


      return res.json(prepareResponse(200, 'Datos específicos de la compañía actualizados correctamente', updatedData));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Upload a certificate partner logo (max 6)
   */
  uploadCertificateLogo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json(prepareResponse(400, 'Se requiere un archivo de imagen (campo: logoFile)'));
      }

      const updatedData = await this.companySpecificDataService.addCertificateLogo(id, file.buffer, file.originalname);
      return res.json(prepareResponse(200, 'Logo agregado exitosamente', updatedData));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('máximo de')) {
        return res.status(400).json(prepareResponse(400, message));
      }
      return next(error);
    }
  };

  /**
   * Remove a certificate partner logo by index
   */
  removeCertificateLogo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = ensureString(req.params.id);
    const logoIndex = parseInt(ensureString(req.params.index), 10);
    if (isNaN(logoIndex) || logoIndex < 0) {
      return res.status(400).json(prepareResponse(400, 'Índice de logo inválido'));
    }

    const updatedData = await this.companySpecificDataService.removeCertificateLogo(id, logoIndex);
    return res.json(prepareResponse(200, 'Logo eliminado exitosamente', updatedData));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Índice')) {
      return res.status(400).json(prepareResponse(400, message));
    }
    return next(error);
  }
};
}
