import { NextFunction, Request, Response, Express } from 'express';
import Error from './error.model';
import { GeneralError } from './general-error.model';

const createUnhandledError = (key: string, message: string): Error => {
  const err: Error = new Error(message, key);
  return err;
};

const handleNotFound = (req: Request, res: Response) => {
  const general: GeneralError = {
    errors: [createUnhandledError('not.found', 'Not found')],
    status: 404,
    message: `${req.path} not found`,
  };
  res.status(404).json(general);
};

const createGeneralError = (err: any) => {
  if (err.status) {
    return {
      status: err.status,
      errors: [new Error(err.message, err.key)],
      message: err.message,
    };
  }
  return {
    status: 500,
    errors: [err],
  };
};

const handleUnhandledError = (err: any, res: Response) => {
  if (err.errors) {
    return res.status(err.status || 500).json(err);
  }
  const generalError = createGeneralError(err);
  return res.status(generalError.status).json(generalError);
};

const handleErrors = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => handleUnhandledError(err, res);

const handle = (app: Express) => {
  app.use(handleNotFound);
  app.use(handleErrors);
};

export default handle;
