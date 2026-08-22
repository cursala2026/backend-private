import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireRole, Role } from '@/middlewares/role.middleware';
import { fileController } from '@/controllers';
import multer from 'multer';

// Configurar multer para usar memoria (no guardar en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  },
});

const router = Router();

// ==========================================
// ENDPOINTS DE LECTURA (GET) - PROFESOR y ADMIN
// ==========================================
router.get(
  '/file/:videoFileName/video', 
  authorize, 
  requireRole([Role.PROFESOR, Role.ADMIN]), 
  fileController.getFileVideo
);

router.get(
  '/file/:fileName/download', 
  authorize, 
  requireRole([Role.PROFESOR, Role.ADMIN]), 
  fileController.getFile
);

// ==========================================
// ENDPOINTS DE SUBIDA Y MUTACIÓN - SOLO ADMIN
// ==========================================
router.patch(
  '/direct', 
  authorize, 
  requireRole([Role.ADMIN]), 
  fileController.proxyDirectRequest
);

router.post(
  '/direct', 
  authorize, 
  requireRole([Role.ADMIN]), 
  fileController.proxyDirectRequest
);

router.put(
  '/direct', 
  authorize, 
  requireRole([Role.ADMIN]), 
  fileController.proxyDirectRequest
);


router.post(
  '/upload/profile-image', 
  authorize, 
  requireRole([Role.ADMIN]), 
  upload.single('image'), 
  fileController.uploadProfileImage
);

export default router;