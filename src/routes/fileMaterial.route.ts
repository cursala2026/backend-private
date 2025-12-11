import { Router } from 'express';
import fileMaterialController from '@/controllers/fileMaterial.controller';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: File Materials
 *   description: Gestión de materiales y plantillas de archivo
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FileMaterial:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único del material
 *         name:
 *           type: string
 *           description: Nombre del material
 *         description:
 *           type: string
 *           description: Descripción del material
 *         fileName:
 *           type: string
 *           description: Nombre del archivo en el servidor
 *         originalFileName:
 *           type: string
 *           description: Nombre original del archivo
 *         fileUrl:
 *           type: string
 *           description: URL del archivo
 *         fileSize:
 *           type: number
 *           description: Tamaño del archivo en bytes
 *         mimeType:
 *           type: string
 *           description: Tipo MIME del archivo
 *         type:
 *           type: string
 *           enum: [template, educational_material, support_document]
 *           description: Tipo de material
 *         category:
 *           type: string
 *           enum: [word, excel, pdf, powerpoint, image, other]
 *           description: Categoría del archivo
 *         isPublic:
 *           type: boolean
 *           description: Si el material es público
 *         downloadCount:
 *           type: number
 *           description: Número de descargas
 *         uploadedBy:
 *           type: string
 *           description: ID del usuario que subió el archivo
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Estado del material
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/file-materials:
 *   post:
 *     summary: Subir nuevo material o plantilla
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - materialFile
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre del material
 *               description:
 *                 type: string
 *                 description: Descripción del material
 *               type:
 *                 type: string
 *                 enum: [template, educational_material, support_document]
 *                 description: Tipo de material
 *               category:
 *                 type: string
 *                 enum: [word, excel, pdf, powerpoint, image, other]
 *                 description: Categoría del archivo
 *               isPublic:
 *                 type: boolean
 *                 description: Si el material es público
 *               materialFile:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir
 *     responses:
 *       201:
 *         description: Material subido exitosamente
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autorizado
 */
router.post('/file-materials', authorize, fileMaterialController.uploadMaterial);

/**
 * @swagger
 * /api/file-materials:
 *   get:
 *     summary: Obtener materiales con filtros
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [template, educational_material, support_document]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [word, excel, pdf, powerpoint, image, other]
 *         description: Filtrar por categoría
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *         description: Filtrar por materiales públicos
 *       - in: query
 *         name: uploadedBy
 *         schema:
 *           type: string
 *         description: Filtrar por usuario que subió
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos por página
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Ordenamiento
 *     responses:
 *       200:
 *         description: Materiales obtenidos exitosamente
 */
router.get('/file-materials', authorize, fileMaterialController.getMaterials);

/**
 * @swagger
 * /api/file-materials/public:
 *   get:
 *     summary: Obtener materiales públicos
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [template, educational_material, support_document]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [word, excel, pdf, powerpoint, image, other]
 *         description: Filtrar por categoría
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos por página
 *     responses:
 *       200:
 *         description: Materiales públicos obtenidos exitosamente
 */
router.get('/file-materials/public', authorize, fileMaterialController.getPublicMaterials);

/**
 * @swagger
 * /api/file-materials/my-materials:
 *   get:
 *     summary: Obtener mis materiales
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos por página
 *     responses:
 *       200:
 *         description: Mis materiales obtenidos exitosamente
 */
router.get('/file-materials/my-materials', authorize, fileMaterialController.getMyMaterials);

/**
 * @swagger
 * /api/file-materials/stats:
 *   get:
 *     summary: Obtener estadísticas de materiales
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 */
router.get('/file-materials/stats', authorize, fileMaterialController.getMaterialStats);

/**
 * @swagger
 * /api/file-materials/{id}:
 *   get:
 *     summary: Obtener material por ID
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del material
 *     responses:
 *       200:
 *         description: Material obtenido exitosamente
 *       404:
 *         description: Material no encontrado
 */
router.get('/file-materials/:id', authorize, fileMaterialController.getMaterialById);

/**
 * @swagger
 * /api/file-materials/{id}/download:
 *   get:
 *     summary: Descargar material
 *     tags: [File Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del material
 *     responses:
 *       200:
 *         description: Archivo descargado exitosamente
 *       403:
 *         description: Sin permisos para descargar
 *       404:
 *         description: Material no encontrado
 */
router.get('/file-materials/:id/download', authorize, fileMaterialController.downloadMaterial);

// Endpoints de gestión
router.patch('/file-materials/:id', authorize, fileMaterialController.updateMaterial);
router.delete('/file-materials/:id', authorize, fileMaterialController.deleteMaterial);

export default router;
