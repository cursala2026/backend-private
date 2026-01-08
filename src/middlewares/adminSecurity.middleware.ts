import { NextFunction, Request, Response } from 'express';
import { Types } from '@/models';
import jwt from 'jsonwebtoken';
import config from '@/config';
import { logger } from '../utils';
import { IUser } from '../models/user.model';
import { userRepository } from '@/repositories';

// Cache para el rol de admin (evita consultas repetidas a la BD)
// Antes el código resolvía el _id de ADMIN y lo comparaba contra los roles de usuario.
// Tras la migración a `roles` como `code` en `users.roles`, ya no necesitamos
// resolver ni comparar ObjectId. Mantenemos la cache y la resolución de id
// solo por compatibilidad en código, pero la lógica de comprobación se simplifica
// para aceptar únicamente `code` (string) o objetos con `code`.

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

async function hasAdminRole(user: IUser | undefined): Promise<boolean> {
  if (!user || !Array.isArray(user.roles)) return false;
  try {
    // Accept explicit string codes (recommended) or objects with `.code`.
    if (user.roles.every((r) => typeof r === 'string' || (typeof r === 'object' && r !== null && 'code' in r))) {
      return (user.roles as any[]).some((r) => {
        const code = typeof r === 'string' ? r : (r && r.code ? r.code : '');
        return String(code).toUpperCase() === 'ADMIN';
      });
    }

    // If roles have an unexpected format, do not grant admin by fallback to id.
    // This avoids implicit privileges when roles are malformed.
    return false;
  } catch (err) {
    logger.error('Error checking admin role in hasAdminRole:', err);
    return false;
  }
}

function decodeTempToken(token: string | undefined): TempAuthToken | null {
  if (!token) return null;
  try {
    // The controller sets a signed JWT as tempAuthToken. Verify signature with JWT_SECRET.
    const payload = jwt.verify(token, config.JWT_SECRET as jwt.Secret) as jwt.JwtPayload;

    // Validate expected payload shape
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
    // Token invalid or signature invalid
    return null;
  }
}

/**
 * Middleware básico que solo verifica si el usuario tiene rol de administrador.
 * NO requiere verificación de email adicional.
 * Usar para operaciones administrativas de nivel medio.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  // Primero intentamos con el objeto `user` provisto por passport.
  // Si no tiene roles (o vienen en formato inesperado), consultamos la BD
  // para leer el documento crudo y volver a evaluar.
  try {
    if (await hasAdminRole(user)) {
      return next();
    }

    // Intentar obtener la versión completa desde la base de datos y reintentar
    // Extraer el _id de forma segura, manejando tanto ObjectId como strings
    const userId = (user as any)._id;
    let userIdString: string;
    
    logger.info('requireAdmin: raw user._id inspection', { 
      userId, 
      type: typeof userId,
      hasToHexString: userId && typeof userId.toHexString === 'function',
      hasToString: userId && typeof userId.toString === 'function',
      stringValue: userId ? String(userId) : 'null/undefined'
    });
    
    if (!userId) {
      logger.warn('requireAdmin: user._id is undefined or null', { user });
      return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
    }
    
    // Si es un ObjectId de Mongoose, convertirlo a string usando toHexString
    if (typeof userId === 'object' && userId !== null && typeof userId.toHexString === 'function') {
      userIdString = userId.toHexString();
    } else if (typeof userId === 'object' && userId !== null && typeof userId.toString === 'function') {
      userIdString = userId.toString();
    } else {
      userIdString = String(userId);
    }
    
    
    
    const fullUser = await userRepository.getUserById(userIdString);
    if (fullUser && (await hasAdminRole(fullUser as IUser))) {
      // reemplazar req.user con la versión completa para middlewares posteriores
      req.user = fullUser as any;
      return next();
    }

    return res.status(403).json({ success: false, message: 'Acceso denegado. Requiere rol administrador.' });
  } catch (err) {
    logger.error('Error comprobando rol admin en requireAdmin:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }

  return next();
}

/**
 * Middleware de guardia administrativa por ruta.
 * Requiere rol de admin + verificación de email con código de seguridad.
 * Usar para operaciones CRÍTICAS como editar roles, eliminar usuarios, etc.
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

    // Derivar identificador de acción por ruta si no se especifica
    const routePath = (req as Request & { route?: { path?: string } }).route?.path ?? req.path;
    const derivedAction = `${req.method}:${req.baseUrl}${routePath}`;
    const actionId = requiredActionId ?? derivedAction;

    // SECURITY FIX: Only accept tokens from headers, never from query string
    // Query strings are logged in server logs, proxy logs, and browser history
    const tempToken = req.header(TEMP_AUTH_HEADER);

    // Explicitly reject tokens in query string to prevent accidental exposure
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

export { hasAdminRole };

/**
 * Middleware que permite acceso a admins O al usuario actualizando su propio perfil.
 * Busca el userId en req.params (como 'userId' o 'id').
 * Si el usuario es admin, pasa. Si no, verifica que esté actualizando su propio perfil.
 */
export function requireAdminOrSelf(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    try {
      // Si es admin, permitir acceso
      if (await hasAdminRole(user)) {
        return next();
      }

      // Intentar obtener la versión completa del usuario
      // Extraer el _id de forma segura, manejando tanto ObjectId como strings
      const userId = (user as any)._id;
      let userIdString: string;
      
      if (!userId) {
        logger.warn('requireAdminOrSelf: user._id is undefined or null', { user });
        return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
      }
      
      // Si es un ObjectId de Mongoose, convertirlo a string usando toHexString
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

      // No es admin, verificar si está actualizando su propio perfil
      const targetUserId = req.params.userId || req.params.id;
      if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'ID de usuario no especificado' });
      }

      const targetUserIdString = String(targetUserId);

      if (userIdString === targetUserIdString) {
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Solo puedes actualizar tu propio perfil o necesitas ser administrador.' 
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
 * Busca el courseId en req.params (como 'id' o 'courseId').
 * Si el usuario es admin, pasa. Si no, verifica que sea uno de los profesores del curso.
 */
export function requireAdminOrCourseOwner(courseRepository: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    try {
      // Si es admin, permitir acceso
      if (await hasAdminRole(user)) {
        return next();
      }

      // Intentar obtener la versión completa del usuario
      // Extraer el _id de forma segura, manejando tanto ObjectId como strings
      const userIdObj = (user as any)._id;
      let userIdString: string;
      
      if (!userIdObj) {
        logger.warn('requireAdminOrCourseOwner: user._id is undefined or null', { user });
        return res.status(403).json({ success: false, message: 'Acceso denegado. Usuario no válido.' });
      }
      
      // Si es un ObjectId de Mongoose, convertirlo a string usando toHexString
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

      // No es admin, verificar si es uno de los profesores del curso
      const courseId = req.params.id || req.params.courseId;
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
        isTeacher
      });

      if (isTeacher) {
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Solo el administrador o uno de los profesores del curso pueden realizar esta acción.',
        debug: { userId, teacherIds, courseId }
      });
    } catch (err) {
      logger.error('Error en requireAdminOrCourseOwner:', err);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };
}
