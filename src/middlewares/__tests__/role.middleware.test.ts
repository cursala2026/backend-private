import { Request, Response, NextFunction } from 'express';
import { requireRole, Role } from '../role.middleware';

describe('role.middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('requireRole', () => {
    it('debe llamar a next si el usuario tiene el rol permitido (roles array)', () => {
      req.user = { roles: ['ADMIN'] } as any;

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('debe permitir acceso si el usuario tiene uno de varios roles permitidos', () => {
      req.user = { roles: ['PROFESOR'] } as any;

      requireRole([Role.PROFESOR, Role.ADMIN])(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('debe devolver 401 si no hay usuario', () => {
      req.user = undefined;

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('debe devolver 401 si el usuario no tiene el campo roles', () => {
      req.user = { _id: 'user-1' } as any;

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('debe devolver 403 si el usuario tiene roles pero ninguno permitido', () => {
      req.user = { roles: ['ALUMNO'] } as any;

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('debe ser insensible a mayúsculas/minúsculas en los roles', () => {
      req.user = { roles: ['admin'] } as any;

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    // Este test específicamente cubre la regresión del bug original:
    // el middleware NO debía depender de un campo `role` (string) inexistente
    it('NO debe autorizar basándose en un campo role (string) suelto, solo roles (array)', () => {
      req.user = { role: 'ADMIN' } as any; // formato viejo/incorrecto, sin roles[]

      requireRole([Role.ADMIN])(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});