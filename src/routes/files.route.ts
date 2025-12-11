import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { fileController } from '@/controllers';

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

export default router;
