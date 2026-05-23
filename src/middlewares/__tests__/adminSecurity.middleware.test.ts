import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  requireAdmin,
  requireAdminOrVendedor,
  requireAdminVerification,
  requireAdminOrSelf,
  requireAdminOrCourseOwner,
  hasAdminRole,
} from '../adminSecurity.middleware';
import { userRepository } from '@/repositories';
import { logger } from '@/utils';
import config from '@/config';

jest.mock('@/repositories', () => ({
  userRepository: {
    getUserById: jest.fn(),
  },
}));

jest.mock('@/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('Admin Security Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const runAsyncMiddleware = (middleware: any, request: any, response: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      const originalJson = response.json;
      response.json = jest.fn().mockImplementation((...args: any[]) => {
        originalJson(...args);
        resolve();
      });
      const nextFn = (err?: any) => {
        if (err) reject(err);
        else resolve();
      };
      middleware(request, response, nextFn);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, params: {}, query: {}, method: 'GET', baseUrl: '/api', path: '/users', header: jest.fn() };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    config.JWT_SECRET = 'secret';
  });

  describe('hasAdminRole helper', () => {
    it('should return true if user has admin code string', async () => {
      const user = { roles: ['ADMIN', 'STUDENT'] } as any;
      expect(await hasAdminRole(user)).toBe(true);
    });

    it('should return true if user has admin object', async () => {
      const user = { roles: [{ code: 'admin' }] } as any;
      expect(await hasAdminRole(user)).toBe(true);
    });

    it('should return false if user does not have admin role', async () => {
      const user = { roles: ['STUDENT'] } as any;
      expect(await hasAdminRole(user)).toBe(false);
    });

    it('should return false if roles is malformed', async () => {
      const user = { roles: [{ id: 123 }] } as any;
      expect(await hasAdminRole(user)).toBe(false);
    });

    it('should return false if user is undefined', async () => {
      expect(await hasAdminRole(undefined as any)).toBe(false);
    });
  });

  describe('requireAdmin', () => {
    it('should call next if user is already admin', async () => {
      req.user = { roles: ['ADMIN'] } as any;
      await requireAdmin(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if unauthenticated', async () => {
      await requireAdmin(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should query DB and call next if DB user is admin', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ roles: ['ADMIN'] });
      
      await requireAdmin(req as Request, res as Response, next);
      
      expect(userRepository.getUserById).toHaveBeenCalledWith('123');
      expect(req.user).toEqual({ roles: ['ADMIN'] });
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if DB user is not admin', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ roles: ['USER'] });
      
      await requireAdmin(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if user has no _id', async () => {
      req.user = { roles: ['USER'] } as any; // missing _id
      await requireAdmin(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdminOrVendedor', () => {
    it('should call next if user is admin', async () => {
      req.user = { roles: ['ADMIN'] } as any;
      await requireAdminOrVendedor(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next if user is vendedor', async () => {
      req.user = { roles: ['VENDEDOR'] } as any;
      await requireAdminOrVendedor(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should query DB and call next if DB user is vendedor', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ roles: ['VENDEDOR'] });
      
      await requireAdminOrVendedor(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if neither', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ roles: ['USER'] });
      
      await requireAdminOrVendedor(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdminVerification', () => {
    const middleware = requireAdminVerification();
    
    it('should call next if valid admin and valid token', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      (req.header as jest.Mock).mockReturnValue('valid-token');
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: '123',
        action: 'GET:/api/users',
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      await new Promise<void>((resolve) => {
        middleware(req as Request, res as Response, ((err: any) => {
          next(err);
          resolve();
        }) as NextFunction);
      });

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user is not admin', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      
      await runAsyncMiddleware(middleware, req, res);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if token in query', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      req.query = { tempAuthToken: 'token' };

      await runAsyncMiddleware(middleware, req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 if token is invalid or missing', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      (req.header as jest.Mock).mockReturnValue(undefined);

      await runAsyncMiddleware(middleware, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if token userId mismatch', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      (req.header as jest.Mock).mockReturnValue('token');
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: '999', // mismatch
        action: 'GET:/api/users',
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      await runAsyncMiddleware(middleware, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if token action mismatch', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      (req.header as jest.Mock).mockReturnValue('token');
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: '123',
        action: 'POST:/other', // mismatch
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      await runAsyncMiddleware(middleware, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if token expired', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      (req.header as jest.Mock).mockReturnValue('token');
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: '123',
        action: 'GET:/api/users',
        verifiedAt: Date.now(),
        expiresAt: Date.now() - 10000, // expired
      });

      await runAsyncMiddleware(middleware, req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdminOrSelf', () => {
    it('should call next if admin', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      await runAsyncMiddleware(requireAdminOrSelf, req, res);
      // It calls next, but runAsyncMiddleware resolves correctly on next()
      // We expect res.status not to be called for 403
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should call next if userId matches targetUserId', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      req.params = { userId: '123' };
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ _id: '123', roles: ['USER'] });

      await runAsyncMiddleware(requireAdminOrSelf, req, res);
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should return 403 if userId does not match targetUserId', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      req.params = { userId: '456' };
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ _id: '123', roles: ['USER'] });

      await runAsyncMiddleware(requireAdminOrSelf, req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireAdminOrCourseOwner', () => {
    const mockCourseRepo = {
      findOneById: jest.fn(),
    };
    const middleware = requireAdminOrCourseOwner(mockCourseRepo);

    it('should call next if admin', async () => {
      req.user = { _id: '123', roles: ['ADMIN'] } as any;
      await middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next if user is a teacher in the course', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      req.params = { courseId: 'c1' };
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ _id: '123', roles: ['USER'] });
      mockCourseRepo.findOneById.mockResolvedValue({ teachers: ['123', '456'] });

      await middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if user is not a teacher', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      req.params = { courseId: 'c1' };
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ _id: '123', roles: ['USER'] });
      mockCourseRepo.findOneById.mockResolvedValue({ teachers: ['456'] });

      await middleware(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 if course not found', async () => {
      req.user = { _id: '123', roles: ['USER'] } as any;
      req.params = { courseId: 'c1' };
      (userRepository.getUserById as jest.Mock).mockResolvedValue({ _id: '123', roles: ['USER'] });
      mockCourseRepo.findOneById.mockResolvedValue(null);

      await middleware(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
