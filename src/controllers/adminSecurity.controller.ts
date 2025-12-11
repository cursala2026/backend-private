import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from '@/models';
import { IUser } from '../models/user.model';
import { logger } from '../utils';
import config from '../config';
import adminSecurityService from '../services/adminSecurity.service';
import { userRepository, courseRepository, categoryRepository } from '../repositories';

// Roles are now fixed codes: ADMIN, PROFESOR, ALUMNO

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

/**
 * Verifica si el usuario es administrador
 * Roles are now simple string codes (ADMIN, PROFESOR, ALUMNO)
 */
const verifyAdminRole = (user: AuthenticatedRequest['user']): boolean => {
  if (!user || !user.roles) {
    return false;
  }

  try {
    // Check if user has ADMIN role (as string code)
    if (Array.isArray(user.roles) && user.roles.some((r: any) => String(r).toUpperCase() === 'ADMIN')) {
      return true;
    }

    // Fallback: check isAdmin flag
    if ((user as any).isAdmin) return true;

    return false;
  } catch (error) {
    logger.error('Error verifying admin role:', error);
    return false;
  }
};

/**
 * Genera y envía un código de verificación por email
 * POST /api/admin-security/generate-code
 */
export const generateVerificationCode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, metadata } = req.body;
    const { user } = req;

    // Verificar autenticación
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
    }

    // Verificar que es administrador
    if (!verifyAdminRole(user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.',
      });
    }

    // Validar parámetros requeridos
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro "action" es requerido',
      });
    }

    // Verificar si ya hay un código reciente para esta acción (prevenir spam)
    const uid = String(user._id);
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }
    const hasRecentCode = await adminSecurityService.hasRecentCode(uid, action);
    if (hasRecentCode) {
      return res.status(429).json({
        success: false,
        message: 'Ya se envió un código recientemente. Espera 2 minutos antes de solicitar otro.',
      });
    }

    // Obtener información del request para metadata
    const requestMetadata = {
      ...metadata,
    };

    // Generar y enviar código
      const result = await adminSecurityService.generateAndSendCode({
      userId: String(uid),
      action,
      userData: {
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      metadata: requestMetadata,
    });

    if (result.success) {
      logger.info(`Admin verification code requested by user ${String(user._id)} for action: ${action}`);
      return res.status(200).json(result);
    }
    return res.status(500).json(result);
  } catch (error) {
    logger.error('Error in generateVerificationCode:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Verifica un código de verificación
 * POST /api/admin-security/verify-code
 */
export const verifyCode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, action } = req.body;
    const { user } = req;

    // Verificar autenticación
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
    }

    // Verificar que es administrador
    if (!verifyAdminRole(user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.',
      });
    }

    // Validar parámetros requeridos
    if (!code || !action) {
      return res.status(400).json({
        success: false,
        message: 'Los parámetros "code" y "action" son requeridos',
      });
    }

    // Verificar código
    const uid2 = String(user._id);
    if (!uid2) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }
    const result = await adminSecurityService.verifyCode({
      userId: uid2,
      code,
      action,
    });

    if (result.success) {
      logger.info(`Admin verification code verified successfully for user ${user._id}, action: ${action}`);

      // Crear token de sesión temporal para autorizar la acción (válido por 30 minutos)
      const ttl = 30 * 60 * 1000; // 30 minutos en ms
      const tempToken = jwt.sign(
        {
          userId: String(user._id),
          action,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + ttl,
        },
        config.JWT_SECRET as jwt.Secret,
        { expiresIn: '30m' }
      );

      return res.status(200).json({
        ...result,
        data: {
          ...result.data,
          tempAuthToken: tempToken,
        },
      });
    }
    return res.status(400).json(result);
  } catch (error) {
    logger.error('Error in verifyCode:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Valida un token temporal de autorización
 * POST /api/admin-security/validate-temp-auth
 */
export const validateTempAuth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tempAuthToken, action } = req.body;
    const { user } = req;

    // Verificar autenticación
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
    }

    // Verificar que es administrador
    if (!verifyAdminRole(user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.',
      });
    }

    if (!tempAuthToken || !action) {
      return res.status(400).json({
        success: false,
        message: 'Los parámetros "tempAuthToken" y "action" son requeridos',
      });
    }

    try {
      // Decodificar y validar el token temporal usando JWT
      const tokenData = jwt.verify(tempAuthToken, config.JWT_SECRET) as jwt.JwtPayload & {
        userId: string;
        action: string;
        verifiedAt: number;
        expiresAt: number;
      };

      // Verificar que corresponde al usuario actual
      const uid3 = String(user._id);
      if (!uid3) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }
      if (tokenData.userId !== uid3) {
        return res.status(403).json({
          success: false,
          message: 'Token inválido para este usuario',
        });
      }

      // Verificar que corresponde a la acción solicitada
      if (tokenData.action !== action) {
        return res.status(403).json({
          success: false,
          message: 'Token inválido para esta acción',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Token válido',
        data: {
          validUntil: new Date(tokenData.expiresAt),
          remainingMinutes: Math.round((tokenData.expiresAt - Date.now()) / 60000),
        },
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(403).json({
          success: false,
          message: 'Token expirado. Solicita un nuevo código de verificación.',
        });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o corrupto',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Token inválido o corrupto',
      });
    }
  } catch (error) {
    logger.error('Error in validateTempAuth:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Obtiene estadísticas de códigos de verificación (para debugging/monitoring)
 * GET /api/admin-security/stats
 */
export const getSecurityStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;

    // Verificar autenticación y permisos de administrador
    if (!user || !verifyAdminRole(user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado',
      });
    }

    // Aquí podrías agregar lógica para obtener estadísticas de la base de datos
    // Por ejemplo, códigos generados en las últimas 24h, acciones más frecuentes, etc.

    return res.status(200).json({
      success: true,
      message: 'Estadísticas obtenidas correctamente',
      data: {
        // Estadísticas placeholder - implementar según necesidades
        message: 'Sistema de seguridad administrativa activo',
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error in getSecurityStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Obtiene datos para gráficos del dashboard de administración
 */
export const getChartData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if (!verifyAdminRole(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requiere rol de administrador.',
      });
    }

    // Por ahora devolver datos mock para evitar problemas con agregaciones
    // TODO: Implementar consultas reales de agregación cuando se estabilice la BD
    const mockData = {
      series: [
        {
          name: 'Usuarios',
          data: [12, 19, 3, 5, 2, 3],
        },
        {
          name: 'Cursos',
          data: [2, 3, 1, 2, 1, 1],
        },
      ],
      categories: ['Mes -5', 'Mes -4', 'Mes -3', 'Mes -2', 'Mes -1', 'Mes actual'],
    };

    logger.info('Returning mock chart data');

    return res.status(200).json({
      success: true,
      data: mockData,
    });
  } catch (error) {
    logger.error('Error in getChartData:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};
export const getSystemStatsPublic = async (req: Request, res: Response) => {
  try {
    // Importar modelos necesarios
    const { PromotionalCode } = await import('@/models/mongo/promotionalCode.model');

    // Obtener estadísticas
    const [
      totalUsers,
      totalCourses,
      totalCategories,
      totalPromotionalCodes,
      activePromotionalCodes,
    ] = await Promise.all([
      userRepository.countUsers(),
      courseRepository.countCourses(),
      categoryRepository.countCategories(),
      PromotionalCode.countDocuments({ status: { $ne: 'DELETED' } }),
      PromotionalCode.countDocuments({ status: 'ACTIVE' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCourses,
        totalCategories,
        totalPromotionalCodes,
        activePromotionalCodes,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error in getSystemStatsPublic:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Obtiene estadísticas generales del sistema para el panel de administración
 */
export const getSystemStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar que el usuario sea admin
    if (!verifyAdminRole(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requiere rol de administrador.',
      });
    }

    // Importar modelos necesarios
    const { PromotionalCode } = await import('@/models/mongo/promotionalCode.model');

    // Obtener estadísticas
    const [
      totalUsers,
      totalCourses,
      totalCategories,
      totalPromotionalCodes,
      activePromotionalCodes,
    ] = await Promise.all([
      userRepository.countUsers(),
      courseRepository.countCourses(),
      categoryRepository.countCategories(),
      PromotionalCode.countDocuments({ status: { $ne: 'DELETED' } }),
      PromotionalCode.countDocuments({ status: 'ACTIVE' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCourses,
        totalCategories,
        totalPromotionalCodes,
        activePromotionalCodes,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error in getSystemStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Returns fixed role codes (ADMIN, PROFESOR, ALUMNO)
 * GET /api/adminSecurity/admin-role
 */
export const getAdminRole = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({ success: true, adminRoleCode: 'ADMIN' });
  } catch (error) {
    logger.error('Error getting admin role:', error);
    return res.status(500).json({ success: false, message: 'Error getting admin role' });
  }
};

/**
 * Returns fixed role codes mapping
 * GET /api/adminSecurity/roles
 */
export const getRolesMap = async (req: Request, res: Response) => {
  try {
    const roles = {
      'ADMIN': 'ADMIN',
      'PROFESOR': 'PROFESOR',
      'ALUMNO': 'ALUMNO'
    };

    return res.status(200).json({ success: true, roles });
  } catch (error) {
    logger.error('Error getting roles map:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener roles' });
  }
};
