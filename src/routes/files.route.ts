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

/**
 * @route GET /file/:videoFileName/video
 * @description Obtiene el video de un archivo.
 * @access Private (requiere autorización)
 */
router.get('/file/:videoFileName/video', authorize, fileController.getFileVideo);

/**
 * @route GET /file/:fileName/download
 * @description Descarga un archivo.
 * @access Private (requiere autorización)
 */
router.get('/file/:fileName/download', authorize, fileController.getFile);

/**
 * @route PATCH /direct
 * @description Proxy para operaciones PATCH usando el parámetro path
 * @access Private (requiere autorización)
 * @query path - Ruta de la API (ej: /updateUserData/userId)
 */
router.patch('/direct', authorize, fileController.proxyDirectRequest);

/**
 * @route POST /direct
 * @description Proxy para operaciones POST usando el parámetro path
 * @access Private (requiere autorización)
 * @query path - Ruta de la API (ej: /addRoleToUser)
 */
router.post('/direct', authorize, fileController.proxyDirectRequest);

/**
 * @route PUT /direct
 * @description Proxy para operaciones PUT usando el parámetro path
 * @access Private (requiere autorización)
 * @query path - Ruta de la API (ej: /updateUser/userId)
 */
router.put('/direct', authorize, fileController.proxyDirectRequest);

/**
 * @route POST /upload/profile-image
 * @description Sube una imagen de perfil a Bunny CDN
 * @access Private (requiere autorización)
 */
router.post('/upload/profile-image', authorize, upload.single('image'), fileController.uploadProfileImage);

export default router;
