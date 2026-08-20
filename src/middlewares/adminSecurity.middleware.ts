import { NextFunction, Request, Response } from 'express';
import { Types } from '@/models';
import jwt from 'jsonwebtoken';
import config from '@/config';
import { logger } from '../utils';
import { IUser } from '../models/user.model';
import { userRepository } from '@/repositories';
import { ensureString } from '@/utils/type-guards';

// Nombre del header donde el front enviará el token temporal recibido tras verify-code
const TEMP_AUTH_HEADER = 'x-admin-temp-auth';

interface TempAuthToken {
  userId: string;
  action: string;
  verifiedAt: number;
  expiresAt: number;
}

// Adaptador de tipos a cadena
function toUserIdString(user: IUser): string {
  // eslint-disable-next-line no-underscore-dangle
  const id = user._id as unknown as Types.ObjectId | string;
  return typeof id === 'string' ? id : id.toHexString();
}

/**
 * Normaliza las fuentes de rol del usuario (role escalar o roles array)
 * a una lista unificada de strings en mayúsculas.
 */
function extractUserRoles(user: any): string[] {
  if (!user) return [];

  const rolesList: string[] = [];

  // 1. Caso String escalar nativo de Cursala (user.role)
  if (typeof user.role === 'string' && user.role.trim()) {
    rolesList.push(user.role.trim().toUpperCase());
  }

  // 2. Caso Array (user.roles) ya sea de strings o de objetos { code: string }
  if (Array.isArray(user.roles)) {
    user.roles.forEach((r: any) => {
      if (typeof r === 'string' && r.trim()) {
        rolesList.push(r.trim().toUpperCase());
      } else if (typeof r === 'object' && r !== null && 'code' in r && typeof r.code === 'string') {
        rolesList.push(r.code.trim().toUpperCase());
      }
    });
  }

  return rolesList;
}

async function hasAdminRole(user: any): Promise<boolean> {
  if (!user) return false;
  try {
    // 1. Estándar Cursala: String único (user.role === 'ADMIN')
    if (typeof user.role === 'string' && user.role.trim().toUpperCase() === 'ADMIN') {
      return true;
    }

    // 2. Compatibilidad: Array de roles o códigos
    if (Array.isArray(user.roles)) {
      return user.roles.some((r: any) => {
        const code = typeof r === 'string' ? r : (r && r.code ? r.code : '');
        return String(code).trim().toUpperCase() === 'ADMIN';
      });
    }

    return false;
  } catch (err) {
    logger.error('Error checking admin role in hasAdminRole:', err);
    return false;
  }
}

async function hasVendedorRole(user: any): Promise<boolean> {
  if (!user) return false;
  try {
    if (typeof user.role === 'string' && user.role.trim().toUpperCase() === 'VENDEDOR') {
      return true;
    }

    if (Array.isArray(user.roles)) {
      return user.roles.some((r: any) => {
        const code = typeof r === 'string' ? r : (r && r.code ? r.code : '');
        return String(code).trim().toUpperCase() === 'VENDEDOR';
      });
    }

    return false;
  } catch (err) {
    logger.error('Error checking vendedor role in hasVendedorRole:', err);
    return false;
  }
}

async function hasVendedorRole(user: IUser | undefined): Promise<boolean> {
  if (!user) return false;
  try {
    const roles = extractUserRoles(user);
    return roles.includes('VENDEDOR');
  } catch (err) {
    logger.error('Error checking vendedor role in hasVendedorRole:', err);
    return false;
  }
}

function decodeTempToken(token: string | undefined): TempAuthToken | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET as jwt.Secret) as jwt.JwtPayload;

    if (
      typeof payload.userId === 'string' &&
      typeof payload.action === 'string' &&
      typeof payload.verifiedAt === 'number' &&
      typeof payload.expiresAt === 'number'
    ) {
      return {
        userId: payload.userId,
        action: payload.action,
        verifiedAt: Number(payload.verifiedAt),
        expiresAt: Number(payload.expiresAt),
      } as TempAuthToken;
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware básico que solo verifica si el usuario tiene rol de administrador.
 * NO requiere verificación de email adicional.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    if (await hasAdminRole(user)) {
      return next();
    }

    const userId = (user as any)._id;
    let userIdString: string;

    if (!userId) {
      logger.warn('requireAdmin: user._id is undefined or null', { user });
      return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
    }

    if (typeof userId === 'object' && userId !== null && typeof userId.toHexString === 'function') {
      userIdString = userId.toHexString();
    } else if (typeof userId === 'object' && userId !== null && typeof userId.toString === 'function') {
      userIdString = userId.toString();
    } else {
      userIdString = String(userId);
    }

    const fullUser = await userRepository.getUserById(userIdString);
    if (fullUser && (await hasAdminRole(fullUser as IUser))) {
      req.user = fullUser as any;
      return next();
    }

    return res.status(403).json({ success: false, message: 'Acceso denegado. Requiere rol administrador.' });
  } catch (err) {
    logger.error('Error comprobando rol admin en requireAdmin:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

/**
 * Middleware que permite acceso a admin o vendedor.
 */
export async function requireAdminOrVendedor(req: Request, res: Response, next: NextFunction) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  try {
    if ((await hasAdminRole(user)) || (await hasVendedorRole(user))) {
      return next();
    }

    const userId = (user as any)._id;
    let userIdString: string;

    if (!userId) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
    }

    if (typeof userId === 'object' && userId !== null && typeof userId.toHexString === 'function') {
      userIdString = userId.toHexString();
    } else if (typeof userId === 'object' && userId !== null && typeof userId.toString === 'function') {
      userIdString = userId.toString();
    } else {
      userIdString = String(userId);
    }

    const fullUser = await userRepository.getUserById(userIdString);
    if (fullUser && ((await hasAdminRole(fullUser as IUser)) || (await hasVendedorRole(fullUser as IUser)))) {
      req.user = fullUser as any;
      return next();
    }

    return res.status(403).json({ success: false, message: 'Acceso denegado. Requiere rol administrador o vendedor.' });
  } catch (err) {
    logger.error('Error comprobando rol admin/vendedor en requireAdminOrVendedor:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

/**
 * Middleware de guardia administrativa por ruta.
 * Requiere rol de admin + verificación de email con código de seguridad.
 */
export function requireAdminVerification(requiredActionId?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      const { user } = req;

      if (!user) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      if (!(await hasAdminRole(user))) {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Requiere rol administrador.' });
      }

      const routePath = (req as Request & { route?: { path?: string } }).route?.path ?? req.path;
      const derivedAction = `${req.method}:${req.baseUrl}${routePath}`;
      const actionId = requiredActionId ?? derivedAction;

      const tempToken = req.header(TEMP_AUTH_HEADER);

      const queryToken = req.query.tempAuthToken as string | undefined;
      if (queryToken) {
        logger.error('🚨 SECURITY VIOLATION: Attempt to pass tempAuthToken in query string');
        return res.status(400).json({
          success: false,
          message: 'Token debe ser enviado en el header x-admin-temp-auth, no en query string',
          requiredAction: actionId,
        });
      }

      const payload = decodeTempToken(tempToken);

      if (!payload) {
        return res.status(403).json({
          success: false,
          message: 'Se requiere verificación de seguridad para esta ruta.',
          requiredAction: actionId,
        });
      }

      if (payload.userId !== toUserIdString(user)) {
        return res
          .status(403)
          .json({ success: false, message: 'Token inválido para este usuario.', requiredAction: actionId });
      }

      if (Date.now() > payload.expiresAt) {
        return res.status(403).json({ success: false, message: 'Token temporal expirado.', requiredAction: actionId });
      }

      if (payload.action !== actionId) {
        return res
          .status(403)
          .json({ success: false, message: 'Token no autorizado para esta ruta.', requiredAction: actionId });
      }

      return next();
    })().catch((err) => {
      logger.error('Error in requireAdminVerification inner handler:', err);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    });
  };
}

export default requireAdminVerification;
export { hasAdminRole, hasVendedorRole, extractUserRoles };

/**
 * Middleware que permite acceso a admins O al usuario actualizando su propio perfil.
 */
export function requireAdminOrSelf(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    try {
      if (await hasAdminRole(user)) {
        return next();
      }

      const userId = (user as any)._id;
      let userIdString: string;

      if (!userId) {
        logger.warn('requireAdminOrSelf: user._id is undefined or null', { user });
        return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
      }

      if (typeof userId === 'object' && userId !== null && typeof userId.toHexString === 'function') {
        userIdString = userId.toHexString();
      } else if (typeof userId === 'object' && userId !== null && typeof userId.toString === 'function') {
        userIdString = userId.toString();
      } else {
        userIdString = String(userId);
      }

      const fullUser = await userRepository.getUserById(userIdString);
      if (fullUser && (await hasAdminRole(fullUser as IUser))) {
        req.user = fullUser as any;
        return next();
      }

      const targetUserId = ensureString(req.params.userId);
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'ID de usuario no especificado' });
      }

      const targetUserIdString = String(targetUserId);

      if (userIdString === targetUserIdString) {
        return next();
      }

      logger.warn(`requireAdminOrSelf: Authorization failed`, {
        authenticatedUserId: userIdString,
        targetUserId: targetUserIdString,
        roles: extractUserRoles(user)
      });

      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo puedes actualizar tu propio perfil o necesitas ser administrador.',
      });
    } catch (err) {
      logger.error('Error en requireAdminOrSelf:', err);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  })().catch((err) => {
    logger.error('Error en requireAdminOrSelf catch:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  });
}

/**
 * Middleware que permite acceso a admins O al profesor propietario del curso.
 */
export function requireAdminOrCourseOwner(courseRepository: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    try {
      if (await hasAdminRole(user)) {
        return next();
      }

      const userIdObj = (user as any)._id;
      let userIdString: string;

      if (!userIdObj) {
        logger.warn('requireAdminOrCourseOwner: user._id is undefined or null', { user });
        return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
      }

      if (typeof userIdObj === 'object' && userIdObj !== null && typeof userIdObj.toHexString === 'function') {
        userIdString = userIdObj.toHexString();
      } else if (typeof userIdObj === 'object' && userIdObj !== null && typeof userIdObj.toString === 'function') {
        userIdString = userIdObj.toString();
      } else {
        userIdString = String(userIdObj);
      }

      const fullUser = await userRepository.getUserById(userIdString);
      if (fullUser && (await hasAdminRole(fullUser as IUser))) {
        req.user = fullUser as any;
        return next();
      }

      const courseId = ensureString(req.params.courseId);
      if (!courseId) {
        return res.status(400).json({ success: false, message: 'ID de curso no especificado' });
      }

      const course = await courseRepository.findOneById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Curso no encontrado' });
      }

      const userId = userIdString;
      const teachers = course.teachers || [];
      const teacherIds = teachers.map((t: any) => String(t));
      const isTeacher = teacherIds.includes(userId);

      logger.info('requireAdminOrCourseOwner - Verification:', {
        userId,
        teacherIds,
        courseId,
        isTeacher,
      });

      if (isTeacher) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo el administrador o uno de los profesores del curso pueden realizar esta acción.',
        debug: { userId, teacherIds, courseId },
      });
    } catch (err) {
      logger.error('Error en requireAdminOrCourseOwner:', err);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };
}