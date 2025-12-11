import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { companySpecificDataController } from '@/controllers';

const router = Router();

// 🟠 ALTO: Ver datos de la compañía requiere admin
router.get('/company-specific-data', authorize, requireAdmin, companySpecificDataController.getAllCompanySpecificData);
// 🟠 ALTO: Modificar datos de la compañía requiere admin (sin verificación adicional para desarrollo)
router.patch('/company-specific-data/:id', authorize, requireAdmin, companySpecificDataController.updateCompanySpecificData);

export default router;
