import { Router } from 'express';
import { authorize as authMiddleware } from '../middlewares/auth.middleware';
import {
  generateVerificationCode,
  verifyCode,
  validateTempAuth,
  getSecurityStats,
  getSystemStats,
  getSystemStatsPublic,
  getChartData,
  getAdminRole,
  getRolesMap,
} from '../controllers/adminSecurity.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     GenerateCodeRequest:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum:
 *             - edit_bank_account
 *             - edit_user_data
 *             - edit_company_data
 *             - edit_roles
 *             - edit_permissions
 *             - delete_user
 *             - critical_settings
 *           description: Tipo de acción que requiere verificación
 *         metadata:
 *           type: object
 *           properties:
 *             formType:
 *               type: string
 *               description: Tipo de formulario
 *             targetId:
 *               type: string
 *               description: ID del objetivo (usuario, cuenta, etc.)
 *           description: Metadatos adicionales para contexto
 *
 *     VerifyCodeRequest:
 *       type: object
 *       required:
 *         - code
 *         - action
 *       properties:
 *         code:
 *           type: string
 *           pattern: '^[0-9]{6}$'
 *           description: Código de verificación de 6 dígitos
 *         action:
 *           type: string
 *           description: Tipo de acción para verificar
 *
 *     SecurityResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 */

/**
 * @swagger
 * /api/v1/admin-security/generate-code:
 *   post:
 *     summary: Genera y envía un código de verificación por email
 *     description: Solo administradores pueden solicitar códigos de verificación
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateCodeRequest'
 *     responses:
 *       200:
 *         description: Código enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SecurityResponse'
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado (no es administrador)
 *       429:
 *         description: Código enviado recientemente (rate limiting)
 *       500:
 *         description: Error del servidor
 */
router.post('/generate-code', authMiddleware, generateVerificationCode);

/**
 * @swagger
 * /api/v1/admin-security/verify-code:
 *   post:
 *     summary: Verifica un código de verificación
 *     description: Verifica el código y retorna un token temporal para autorizar la acción
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyCodeRequest'
 *     responses:
 *       200:
 *         description: Código verificado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SecurityResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         tempAuthToken:
 *                           type: string
 *                           description: Token temporal para autorizar la acción (válido 30 min)
 *                         verifiedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Código inválido o parámetros incorrectos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 */
router.post('/verify-code', authMiddleware, verifyCode);

/**
 * @swagger
 * /api/v1/admin-security/validate-temp-auth:
 *   post:
 *     summary: Valida un token temporal de autorización
 *     description: Verifica si el token temporal sigue siendo válido para realizar la acción
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tempAuthToken
 *               - action
 *             properties:
 *               tempAuthToken:
 *                 type: string
 *                 description: Token temporal obtenido al verificar el código
 *               action:
 *                 type: string
 *                 description: Acción para la cual se quiere validar el token
 *     responses:
 *       200:
 *         description: Token válido
 *       400:
 *         description: Token inválido o parámetros incorrectos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Token expirado o no autorizado
 */
router.post('/validate-temp-auth', authMiddleware, validateTempAuth);

/**
 * @swagger
 * /api/v1/admin-security/stats:
 *   get:
 *     summary: Obtiene estadísticas del sistema de seguridad
 *     description: Solo para administradores - información de debugging/monitoring
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas
 *       403:
 *         description: No autorizado
 */
router.get('/stats', authMiddleware, getSecurityStats);

/**
 * @swagger
 * /admin-security/system-stats-public:
 *   get:
 *     summary: Obtiene estadísticas generales del sistema (público para testing)
 *     tags: [Admin Security]
 *     responses:
 *       200:
 *         description: Estadísticas del sistema obtenidas
 */
router.get('/system-stats-public', getSystemStatsPublic);

/**
 * @swagger
 * /admin-security/system-stats:
 *   get:
 *     summary: Obtiene estadísticas generales del sistema (requiere autenticación)
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema obtenidas
 *       403:
 *         description: No autorizado
 */
router.get('/system-stats', authMiddleware, getSystemStats);

// Endpoint público que devuelve el ID del rol administrador (resuelto por código)
router.get('/admin-role', getAdminRole);

// Endpoint público: devuelve un mapa { code: id } con los roles existentes
router.get('/roles', getRolesMap);

/**
 * @swagger
 * /admin-security/system-stats:
 *   get:
 *     summary: Obtiene estadísticas generales del sistema
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema obtenidas
 *       403:
 *         description: No autorizado
 */
/**
 * @swagger
 * /admin-security/chart-data:
 *   get:
 *     summary: Obtiene datos para gráficos del dashboard
 *     tags: [Admin Security]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Datos de gráficos obtenidos
 *       403:
 *         description: No autorizado
 */
router.get('/chart-data', authMiddleware, getChartData);

export default router;
