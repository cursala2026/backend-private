import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { companySpecificDataController } from '@/controllers';
import multer from 'multer';

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes PNG o JPG'));
    }
  },
});

const router = Router();

// 🟠 ALTO: Ver datos de la compañía requiere admin
router.get('/company-specific-data', authorize, requireAdmin, companySpecificDataController.getAllCompanySpecificData);
// 🟠 ALTO: Modificar datos de la compañía requiere admin
router.patch('/company-specific-data/:id', authorize, requireAdmin, companySpecificDataController.updateCompanySpecificData);
// 🟠 ALTO: Logos institucionales del certificado
router.post('/company-specific-data/:id/certificate-logos', authorize, requireAdmin, logoUpload.single('logoFile'), companySpecificDataController.uploadCertificateLogo);
router.delete('/company-specific-data/:id/certificate-logos/:index', authorize, requireAdmin, companySpecificDataController.removeCertificateLogo);

export default router;
