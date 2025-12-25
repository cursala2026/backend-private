import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { certificateController } from '@/controllers';

const router = Router();

/**
 * @route GET /validate/:verificationCode
 * @desc Valida un certificado usando el código de verificación (público)
 * @access Public (no requiere autenticación)
 */
router.get('/validate/:verificationCode', certificateController.validateCertificate);

/**
 * @route GET /check/:studentId/:courseId
 * @desc Verifica si existe un certificado para un estudiante-curso
 * @access Private (requiere autenticación)
 */
router.get('/check/:studentId/:courseId', authorize, certificateController.checkCertificateExists);

/**
 * @route GET /debug/all
 * @desc Lista todos los certificados en la base de datos (temporal para debug)
 * @access Private (requiere autenticación)
 */
router.get('/debug/all', authorize, certificateController.debugListAllCertificates);

/**
 * @route GET /course/:courseId
 * @desc Obtiene todos los certificados generados para un curso específico
 * @access Private (requiere autenticación)
 */
router.get('/course/:courseId', authorize, certificateController.getCertificatesByCourse);

/**
 * @route GET /student/:studentId
 * @desc Obtiene todos los certificados de un estudiante específico
 * @access Private (requiere autenticación)
 */
router.get('/student/:studentId', authorize, certificateController.getCertificatesByStudent);

/**
 * @route GET /download/:verificationCode
 * @desc Descarga un certificado en formato PDF usando el código de verificación
 * @access Private (requiere autenticación)
 */
router.get('/download/:verificationCode', authorize, certificateController.downloadCertificate);

// POST routes
/**
 * @route POST /generate
 * @desc Genera un nuevo certificado para un estudiante
 * @access Private (requiere autenticación)
 * @body { studentId: string, courseId: string, teacherId: string }
 */
router.post('/generate', authorize, certificateController.generateCertificate);

// PATCH routes
/**
 * @route PATCH /regenerate/:certificateId
 * @desc Regenera un certificado existente (actualiza fecha de generación)
 * @access Private (requiere autenticación)
 */
router.patch('/regenerate/:certificateId', authorize, certificateController.regenerateCertificate);

// DELETE routes
/**
 * @route DELETE /delete/:certificateId
 * @desc Elimina un certificado (soft delete)
 * @access Private (requiere autenticación - solo administradores)
 */
router.delete('/delete/:certificateId', authorize, certificateController.deleteCertificate);

export default router;
