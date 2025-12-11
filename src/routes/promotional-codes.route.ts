import { Router } from 'express';
import { promotionalCodeController } from '@/controllers';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';

const router = Router();

// 🟠 ALTO: Gestión de códigos promocionales requiere admin
router.post('/', authorize, requireAdmin, promotionalCodeController.createPromotionalCode);
router.get('/', authorize, requireAdmin, promotionalCodeController.getAllPromotionalCodes);
router.get('/stats', authorize, requireAdmin, promotionalCodeController.getPromotionalCodeStats);
router.get('/:id', authorize, requireAdmin, promotionalCodeController.getPromotionalCodeById);
router.put('/:id', authorize, requireAdmin, promotionalCodeController.updatePromotionalCode);
router.delete('/:id', authorize, requireAdmin, promotionalCodeController.deletePromotionalCode);

// 🟠 ALTO: Activar/pausar códigos promocionales requiere admin
router.patch('/:id/pause', authorize, requireAdmin, promotionalCodeController.pausePromotionalCode);
router.patch('/:id/activate', authorize, requireAdmin, promotionalCodeController.activatePromotionalCode);

export default router;
