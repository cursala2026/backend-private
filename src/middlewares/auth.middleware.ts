/* eslint-disable no-underscore-dangle */
import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { IUser } from '../models/user.model';
import { logger } from '../utils';
import config from '@/config';
import { userRepository } from '@/repositories';

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.JWT_SECRET,
};

passport.use(
  new JwtStrategy(options, async (jwtPayload, done) => {
    try {
      const user = await userRepository.findById(jwtPayload._id);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      logger.error(error);
      return done(error, false);
    }
  })
);

export default passport;

const handleAuthError = (info: Record<string, string>) => {
  if (info && info.name === 'TokenExpiredError') {
    return { status: 401, message: 'Token expired' };
  }
  if (info && info.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Unauthorized' };
  }
  return { status: 401, message: 'Unauthorized' };
};

export const authorize = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: Error, user: IUser, info: Record<string, string>) => {
    if (err) {
      logger.error(`AUTHORIZE error:`, err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    if (!user) {
      logger.warn(`AUTHORIZE no user, info:`, info);
      const errorResponse = handleAuthError(info);
      return res.status(errorResponse.status).json({ message: errorResponse.message });
    }
    req.user = user;
    return next();
  })(req, res, next);
};
