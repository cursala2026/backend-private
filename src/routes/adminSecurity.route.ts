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

router.post('/generate-code', authMiddleware, generateVerificationCode);
router.post('/verify-code', authMiddleware, verifyCode);
router.post('/validate-temp-auth', authMiddleware, validateTempAuth);
router.get('/stats', authMiddleware, getSecurityStats);
router.get('/system-stats-public', getSystemStatsPublic);
router.get('/system-stats', authMiddleware, getSystemStats);
router.get('/admin-role', getAdminRole);
router.get('/roles', getRolesMap);
router.get('/chart-data', authMiddleware, getChartData);

export default router;
