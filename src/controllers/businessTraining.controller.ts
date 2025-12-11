import { Request, Response, NextFunction } from 'express';
import prepareResponse from '../utils/api-response';
import BusinessTrainingService from '@/services/businessTraining.service';

export default class BusinessTrainingController {
  constructor(private readonly businessTrainingService: BusinessTrainingService) {}

  getAllBusinessTrainings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.businessTrainingService.getAllBusinessTrainings();
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  getBusinessTrainingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.businessTrainingService.getBusinessTrainingById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  createBusinessTraining = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.businessTrainingService.createBusinessTraining(req.body);
      return res.status(201).json(prepareResponse(201, 'Resource created successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  updateBusinessTrainingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.businessTrainingService.updateBusinessTrainingById(id, req.body);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource updated successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  deleteBusinessTrainingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.businessTrainingService.deleteBusinessTrainingById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource deleted successfully', null));
    } catch (error) {
      return next(error);
    }
  };
}
