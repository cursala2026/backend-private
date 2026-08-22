import { Router } from 'express';
// Usamos el nombre original sin alias para evitar confusiones
import { authorize } from '../middlewares/auth.middleware'; 
import { requireRole, Role } from '@/middlewares/role.middleware';
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

// ==========================================
// 1. RUTAS PÚBLICAS (No requieren token)
// ==========================================

router.get('/system-stats-public', getSystemStatsPublic);

// ==========================================
// 2. BLINDAJE GLOBAL
// ==========================================
// A partir de esta línea, TODO requiere token válido Y ser ADMIN
router.use(authorize, requireRole([Role.ADMIN]));

// ==========================================
// 3. RUTAS PRIVADAS (Solo Admin)
// ==========================================
// Ya no hace falta repetir los middlewares en cada línea
router.post('/generate-code', generateVerificationCode);
router.post('/verify-code', verifyCode);
router.post('/validate-temp-auth', validateTempAuth);
router.get('/stats', getSecurityStats);
router.get('/system-stats', getSystemStats);
router.get('/admin-role', getAdminRole);
router.get('/roles', getRolesMap);
router.get('/chart-data', getChartData);

export default router;
