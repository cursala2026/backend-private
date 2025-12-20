import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { classController } from '@/controllers';
import { uploadFiles } from '@/controllers/class.controller';

const router = Router();

/**
 * @route GET /:imageFileName/image
 * @description Obtiene la imagen de una clase.
 * @access Public (sin autenticación para permitir carga en navegador)
 */
router.get('/:imageFileName/image', classController.getClassImage);

/**
 * @route GET /:videoFileName/video
 * @description Obtiene el video de una clase.
 * @access Private (requiere autorización)
 */
router.get('/:videoFileName/video', authorize, classController.getClassVideo);

/**
 * @route GET /:classId
 * @description Obtiene una clase por su ID.
 * @access Private (requiere autorización)
 */
router.get('/:classId', authorize, classController.findOneById);

/**
 * @route POST /
 * @description Crea una nueva clase con una imagen obligatoria.
 * @access Private (requiere autorización)
 * @note Ahora maneja tanto archivos normales como archivos ensamblados por chunks
 */
router.post('/', authorize, uploadFiles, classController.create);

// 🆕 ========== NUEVAS RUTAS PARA SISTEMA DE CHUNKS ==========

/**
 * @route POST /upload-chunk
 * @description Sube un chunk individual de un archivo grande (>90MB).
 * @access Private (requiere autorización)
 * @body {FormData} chunk - El fragmento del archivo
 * @body {string} uploadId - ID único del upload generado en frontend
 * @body {number} chunkIndex - Índice del chunk (0, 1, 2, ...)
 * @body {number} totalChunks - Número total de chunks esperados
 * @body {string} fileName - Nombre original del archivo
 * @body {string} fieldName - Tipo de campo (imageFile, videoFile, supportMaterials)
 * @returns {object} { success: boolean, message: string, uploadId: string }
 * @example
 * // Frontend envía:
 * // FormData: chunk=<blob>, uploadId="1735617297000-abc123", chunkIndex=0,
 * // totalChunks=6, fileName="video.mp4", fieldName="videoFile"
 */
router.post('/upload-chunk', authorize, classController.uploadChunk);

/**
 * @route POST /finalize-upload
 * @description Ensambla todos los chunks en un archivo final y lo almacena.
 * @access Private (requiere autorización)
 * @body {string} uploadId - ID único del upload
 * @body {string} fileName - Nombre original del archivo
 * @body {string} fieldName - Tipo de campo (imageFile, videoFile, supportMaterials)
 * @returns {object} { success: boolean, fileName: string, uploadId: string }
 * @note Este endpoint debe llamarse después de subir todos los chunks
 * @example
 * // Request body:
 * // { "uploadId": "1735617297000-abc123", "fileName": "video.mp4", "fieldName": "videoFile" }
 */
router.post('/finalize-upload', authorize, classController.finalizeUpload);

/**
 * @route DELETE /cleanup-chunks/:uploadId
 * @description Limpia chunks huérfanos en caso de uploads fallidos o cancelados.
 * @access Private (requiere autorización)
 * @param {string} uploadId - ID del upload a limpiar
 * @returns {object} { success: boolean, message: string, uploadId: string }
 * @note Útil para limpiar espacio en disco cuando un upload falla
 * @example
 * // DELETE /cleanup-chunks/1735617297000-abc123
 */
router.delete('/cleanup-chunks/:uploadId', authorize, classController.cleanupChunks);

// ========== RUTAS EXISTENTES (SIN CAMBIOS) ==========

/**
 * @route DELETE /:classId/delete
 * @description Elimina una clase por su ID.
 * @access Private (requiere autorización)
 */
router.delete('/:classId/delete', authorize, classController.delete);

/**
 * @route GET /course/:courseId/classes
 * @description Obtiene todas las clases asociadas a un curso específico.
 * @access Private (requiere autorización)
 */
router.get('/course/:courseId/classes', authorize, classController.findAllByCourse);

/**
 * @route PATCH /:classId/status
 * @description Cambia el estado de una clase (ACTIVE, INACTIVE, etc.).
 * @access Private (requiere autorización)
 */
router.patch('/:classId/status', authorize, classController.changeStatus);

/**
 * @route PATCH /:classId/up
 * @description Mueve una clase hacia arriba en el orden dentro del mismo curso.
 * @access Private (requiere autorización)
 */
router.patch('/:classId/up', authorize, classController.moveUpOrder);

/**
 * @route PATCH /:classId/down
 * @description Mueve una clase hacia abajo en el orden dentro del mismo curso.
 * @access Private (requiere autorización)
 */
router.patch('/:classId/down', authorize, classController.moveDownOrder);

/**
 * @route PATCH /:classId
 * @description Actualiza una clase existente, permitiendo cambiar la imagen.
 * @access Private (requiere autorización)
 */
router.patch('/:classId', authorize, uploadFiles, classController.update);

// ========== RUTAS DE CONFIGURACIÓN DE EXAMEN ==========

/**
 * @route PATCH /:classId/exam-config
 * @description Actualiza la configuración del examen para una clase específica.
 * @access Private (requiere autorización)
 * @body Para activar: { examLink: string, examVisible: true, examStartDate: string, examEndDate: string }
 * @body Para desactivar: { examVisible: false }
 * @returns La clase actualizada con la nueva configuración del examen
 * @note Si examVisible=false, solo desactiva el examen. Si examVisible=true o no se especifica, requiere todos los datos.
 */
router.patch('/:classId/exam-config', authorize, classController.updateExamConfig);

/**
 * @route GET /:classId/exam-config
 * @description Obtiene la configuración del examen de una clase específica.
 * @access Private (requiere autorización)
 * @returns La configuración del examen (examLink, examVisible, examStartDate, examEndDate)
 */
router.get('/:classId/exam-config', authorize, classController.getExamConfig);

/**
 * @route DELETE /:classId/media/:mediaType/:fileName
 * @description Elimina archivos multimedia específicos de una clase (con nombre de archivo).
 * @access Private (requiere autorización)
 * @param {string} classId - ID de la clase
 * @param {string} mediaType - Tipo de media (image, video, supportMaterial)
 * @param {string} fileName - Nombre del archivo
 * @returns Confirmación de eliminación
 * @example DELETE /class/123/media/supportMaterial/archivo.pdf - Elimina un archivo de soporte específico
 */
router.delete('/:classId/media/:mediaType/:fileName', authorize, classController.deleteClassMedia);

/**
 * @route DELETE /:classId/media/:mediaType
 * @description Elimina archivos multimedia específicos de una clase (sin nombre de archivo).
 * @access Private (requiere autorización)
 * @param {string} classId - ID de la clase
 * @param {string} mediaType - Tipo de media (image, video, supportMaterial)
 * @returns Confirmación de eliminación
 * @example DELETE /class/123/media/image - Elimina la imagen de la clase
 * @example DELETE /class/123/media/video - Elimina el video de la clase
 */
router.delete('/:classId/media/:mediaType', authorize, classController.deleteClassMedia);

export default router;
