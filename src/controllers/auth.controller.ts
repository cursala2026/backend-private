import { NextFunction, Request, Response } from 'express';
import { IUser } from '../models/user.model';
import prepareResponse from '../utils/api-response';
import AuthService from '@/services/auth.service';

class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, password } = req.body;
      const { token, userInfo } = await this.authService.login(user, password);
      return res.json(prepareResponse(200, 'Successful operation', { token, userInfo }));
    } catch (error) {
      return next(error);
    }
  };

  initiateResetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expiresIn } = await this.authService.generateResetPasswordToken(req.body.email);
      return res.json(prepareResponse(200, 'Correo de restablecimiento de contraseña enviado.', { expiresIn }));
    } catch (error) {
      return next(error);
    }
  };

  completeResetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.resetPassword(req.body.token, req.body.newPassword);
      return res.json(prepareResponse(200, 'Contraseña restablecida con éxito.', {}));
    } catch (error) {
      return next(error);
    }
  };

  currentUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userInfo = await this.authService.getUserInfo(req.user as IUser);

      return res.json({ message: 'Valid Token', user: userInfo });
    } catch (error) {
      return next(error);
    }
  };

  registerUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.register(req.body);
      return res.json(prepareResponse(200, 'Successful operation'));
    } catch (error) {
      return next(error);
    }
  };
}

export default AuthController;
