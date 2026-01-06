import { NextFunction, Request, Response } from 'express';
import { paginate, sortBy } from '@/utils';

/**
 * Middleware to handle pagination and sorting of query results.
 * @param req  Request object
 * @param res  Response object
 * @param next  Next function
 */
const pagination = (req: Request, res: Response, next: NextFunction) => {
  Object.assign(req.query, { ...paginate(req.query), ...sortBy(req.query) });
  next();
};

export default pagination;
