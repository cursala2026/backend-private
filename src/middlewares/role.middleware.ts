import { Request, Response, NextFunction } from 'express';

export enum Role {
  ADMIN = 'ADMIN',
  PROFESOR = 'PROFESOR',
  ALUMNO = 'ALUMNO'
}

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as { roles?: string[] };

    const userRoles: string[] = Array.isArray(user?.roles)
      ? user.roles.map((r) => String(r).toUpperCase())
      : [];

    if (!user || userRoles.length === 0) {
      return res.status(401).json({ message: 'No autenticado o token inválido' });
    }

    const hasAllowedRole = allowedRoles.some((r) => userRoles.includes(r));

    if (!hasAllowedRole) {
      return res.status(403).json({
        message: 'Acceso denegado: No tienes los permisos necesarios para esta acción'
      });
    }

    next();
  };
};