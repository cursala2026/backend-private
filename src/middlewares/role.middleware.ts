import { Request, Response, NextFunction } from 'express';

// Define los roles permitidos basados en los roles según tu configuración de entorno
export enum Role {
  ADMIN = 'ADMIN',
  PROFESOR = 'PROFESOR',
  ALUMNO = 'ALUMNO'
}

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Asumiendo que Passport inyecta el payload del JWT decodificado en req.user
    const user = req.user as { roles?: string[] }; 

    if (!user || !user.roles || user.roles.length === 0) {
      return res.status(401).json({ message: 'No autenticado o token inválido' });
    }

    // Verifica si el rol del usuario está en la lista de permitidos
    const hasRole = user.roles.some((r: string) => allowedRoles.includes(r as Role));
    if (!hasRole) {
      return res.status(403).json({ 
        message: 'Acceso denegado: No tienes los permisos necesarios para esta acción' 
      });
    }

    next(); // Pasa la validación, continúa al controlador
  };
};