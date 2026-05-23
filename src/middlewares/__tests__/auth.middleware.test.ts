import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as JwtStrategy } from 'passport-jwt';
import { userRepository } from '@/repositories';
import { logger } from '@/utils';

jest.mock('@/repositories', () => ({
  userRepository: {
    findById: jest.fn(),
  },
}));

jest.mock('@/utils', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('passport-jwt', () => ({
  Strategy: jest.fn().mockImplementation(() => ({ name: 'jwt' })),
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn().mockReturnValue(() => 'mock-token'),
  },
}));

jest.mock('passport', () => ({
  use: jest.fn(),
  authenticate: jest.fn(),
}));

import { authorize } from '../auth.middleware';

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  
  // Extract verifyCallback right after import, before any clearAllMocks
  const verifyCallback: Function = (JwtStrategy as jest.Mock).mock.calls[0][1];

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('JWT Strategy verify callback', () => {
    it('should call done with user if user exists in db', async () => {
      const mockUser = { _id: 'user-1' };
      (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      const done = jest.fn();

      await verifyCallback({ _id: 'user-1' }, done);

      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(done).toHaveBeenCalledWith(null, mockUser);
    });

    it('should call done with fake user if user does not exist and NODE_ENV !== production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      (userRepository.findById as jest.Mock).mockResolvedValue(null);
      const done = jest.fn();

      await verifyCallback({ _id: 'user-1', email: 'test@test.com' }, done);

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({
        _id: 'user-1',
        email: 'test@test.com',
        username: 'test@test.com',
      }));

      process.env.NODE_ENV = originalEnv;
    });

    it('should call done with false if user does not exist and NODE_ENV === production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      (userRepository.findById as jest.Mock).mockResolvedValue(null);
      const done = jest.fn();

      await verifyCallback({ _id: 'user-1' }, done);

      expect(done).toHaveBeenCalledWith(null, false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should call done with error if repository throws', async () => {
      const error = new Error('DB Error');
      (userRepository.findById as jest.Mock).mockRejectedValue(error);
      const done = jest.fn();

      await verifyCallback({ _id: 'user-1' }, done);

      expect(logger.error).toHaveBeenCalled();
      expect(done).toHaveBeenCalledWith(error, false);
    });
  });

  describe('authorize middleware', () => {
    it('should call next if user is authenticated', () => {
      const mockUser = { _id: 'user-1' };
      (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
        return (request: any, response: any, nextFn: any) => {
          callback(null, mockUser, {});
        };
      });

      authorize(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 500 if passport throws an error', () => {
      const error = new Error('Passport error');
      (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
        return (request: any, response: any, nextFn: any) => {
          callback(error, null, {});
        };
      });

      authorize(req as Request, res as Response, next);

      expect(logger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });

    it('should return 401 if token expired', () => {
      (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
        return (request: any, response: any, nextFn: any) => {
          callback(null, false, { name: 'TokenExpiredError' });
        };
      });

      authorize(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'token expired' });
    });

    it('should return 401 if invalid signature', () => {
      (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
        return (request: any, response: any, nextFn: any) => {
          callback(null, false, { name: 'JsonWebTokenError' });
        };
      });

      authorize(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'invalid signature' });
    });

    it('should return 401 for generic unauthorized', () => {
      (passport.authenticate as jest.Mock).mockImplementation((strategy, options, callback) => {
        return (request: any, response: any, nextFn: any) => {
          callback(null, false, { name: 'SomeOtherError' });
        };
      });

      authorize(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
  });
});
