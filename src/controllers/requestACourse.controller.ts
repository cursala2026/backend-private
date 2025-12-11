import { Request, Response, NextFunction } from 'express';
import prepareResponse from '../utils/api-response';
import RequestACourseService from '@/services/requestACourse.service';

export default class RequestACourseController {
  constructor(private readonly requestACourseService: RequestACourseService) {}

  getAllRequestACourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.requestACourseService.getAllRequestACourse();
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  getRequestACourseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.requestACourseService.getRequestACourseById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Data fetched successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  createRequestACourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.requestACourseService.createRequestACourse(req.body);
      return res.json(prepareResponse(201, 'Resource created successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  updateRequestACourseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.requestACourseService.updateRequestACourseById(id, req.body);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource updated successfully', data));
    } catch (error) {
      return next(error);
    }
  };

  deleteRequestACourseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = await this.requestACourseService.deleteRequestACourseById(id);
      if (!data) {
        return res.status(404).json(prepareResponse(404, 'Resource not found', null));
      }
      return res.json(prepareResponse(200, 'Resource deleted successfully', null));
    } catch (error) {
      return next(error);
    }
  };
}
