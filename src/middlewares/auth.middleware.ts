/* eslint-disable no-underscore-dangle */
import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { IUser } from '../models/user.model';
import { logger } from '../utils';
import config from '@/config';
import { userRepository } from '@/repositories';

/**
 * Extracts JWT token from Authorization header or query parameter.
 * @param req  Request object
 * @returns JWT token string or null if not found
 */
const jwtExtractor = (req: Request) => {
  const authHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (authHeader) {
    return authHeader;
  }
  const tokenFromQuery = req.query.token as string | undefined;
  if (tokenFromQuery) {
    return tokenFromQuery;
  }
  return null;
};

/**
 * Passport JWT Strategy configuration
 */
const options = {
  jwtFromRequest: jwtExtractor,
  secretOrKey: config.JWT_SECRET,
};

/**
 * JWT Strategy for Passport
 */
passport.use(
  new JwtStrategy(options, async (jwtPayload, done) => {
    try {
        const user = await userRepository.findById(jwtPayload._id);
        if (user) {
          return done(null, user);
        }

        // En desarrollo, permitir usar el payload del JWT como usuario si no existe en BD
        if (process.env.NODE_ENV !== 'production') {
          try {
            const fakeUser = {
              _id: jwtPayload._id,
              username: (jwtPayload as any).username || (jwtPayload as any).email || 'dev.user',
              email: (jwtPayload as any).email,
              firstName: (jwtPayload as any).firstName || '',
              lastName: (jwtPayload as any).lastName || '',
              roles: (jwtPayload as any).roles || [],
              status: 'ACTIVE'
            } as any;
            return done(null, fakeUser);
          } catch (e) {
            logger.warn('Failed to construct fake user from JWT payload', { error: e });
          }
        }

        return done(null, false);
    } catch (error) {
      logger.error(`JWT Strategy error:`, error);
      return done(error, false);
    }
  })
);

export default passport;

/**
 *  Handles authentication errors based on info object.
 * @param info  Info object from Passport
 * @returns  Object containing status and message
 */
const handleAuthError = (info: Record<string, string>) => {
  if (info && info.name === 'TokenExpiredError') {
    return { status: 401, message: 'token expired' };
  }
  if (info && info.name === 'JsonWebTokenError') {
    return { status: 401, message: 'invalid signature' };
  }
  return { status: 401, message: 'Unauthorized' };
};

/**
 * Middleware to authorize requests using JWT authentication.
 * @param req  Request object
 * @param res  Response object
 * @param next  Next function
 */
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
