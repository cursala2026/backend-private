import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { fileController } from '@/controllers';
import multer from 'multer';

// Configurar multer para usar memoria (no guardar en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
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

router.get('/file/:videoFileName/video', authorize, fileController.getFileVideo);
router.get('/file/:fileName/download', authorize, fileController.getFile);
router.patch('/direct', authorize, fileController.proxyDirectRequest);
router.post('/direct', authorize, fileController.proxyDirectRequest);
router.put('/direct', authorize, fileController.proxyDirectRequest);
router.post('/upload/profile-image', authorize, upload.single('image'), fileController.uploadProfileImage);

export default router;
