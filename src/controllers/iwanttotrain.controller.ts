import { Request, Response, NextFunction } from 'express';
import prepareResponse from '../utils/api-response';
import IWantToTrainService from '@/services/iwanttotrain.service';

export default class IWantToTrainController {
  constructor(private readonly iwantToTrainService: IWantToTrainService) {}

  getAllIWantToTrain = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.iwantToTrainService.getAllIWantToTrain();
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  getIWantToTrainById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.iwantToTrainService.getIWantToTrainById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  createIWantToTrain = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.iwantToTrainService.createIWantToTrain(req.body);
      return res.json(prepareResponse(201, 'Resource created successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  updateIWantToTrainById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.iwantToTrainService.updateIWantToTrainById(id, req.body);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource updated successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  deleteIWantToTrainById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.iwantToTrainService.deleteIWantToTrainById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource deleted successfully', null));
    } catch (error) {
      return next(error);
    }
  };
}
