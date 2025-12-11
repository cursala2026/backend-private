import { NextFunction, Response, Request } from 'express';
import prepareResponse from '../utils/api-response';
import { hasAdminRole } from '../middlewares/adminSecurity.middleware';
import CertificateService from '@/services/certificate.service';

export default class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  /**
   * Genera un certificado para un estudiante
   */
  generateCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, teacherId } = req.body;
      const authUser = (req as Request & { user?: { id?: string; _id?: string } }).user;
      const generatedBy = authUser?.id || authUser?._id;

      // Validar datos requeridos
      if (!studentId || !courseId || !teacherId) {
        return res.status(400).json(prepareResponse(400, 'Faltan datos requeridos: studentId, courseId, teacherId'));
      }

      if (!generatedBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const certificate = await this.certificateService.generateCertificate(
        studentId,
        courseId,
        teacherId,
        generatedBy
      );

      return res.status(201).json(prepareResponse(201, 'Certificado generado exitosamente', certificate));
    } catch (error: unknown) {
      const errUnknown = error as unknown;
      const message = errUnknown instanceof Error ? errUnknown.message : String(errUnknown);
      // Manejo específico de errores del servicio
      if (message.includes('no encontrado')) {
        return res.status(404).json(prepareResponse(404, message));
      }

      if (message.includes('Ya existe un certificado')) {
        return res.status(409).json(prepareResponse(409, message));
      }

      if (message.includes('no está inscrito')) {
        return res.status(403).json(prepareResponse(403, message));
      }

      return next(error as Error);
    }
  };

  /**
   * Valida un certificado usando el código de verificación
   */
  validateCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verificationCode } = req.params;

      if (!verificationCode) {
        return res.status(400).json(prepareResponse(400, 'Código de verificación requerido'));
      }

      const result = await this.certificateService.validateCertificate(verificationCode);

      if (!result.isValid) {
        return res.status(404).json(prepareResponse(404, result.message || 'Certificado no válido'));
      }

      return res.json(prepareResponse(200, 'Certificado validado exitosamente', result));
    } catch (error: unknown) {
      const errUnknown = error as unknown;
      const message = errUnknown instanceof Error ? errUnknown.message : String(errUnknown);
      if (message.includes('inválido')) {
        return res.status(404).json(prepareResponse(404, 'Código de verificación inválido'));
      }

      return next(error as Error);
    }
  };

  /**
   * Verifica si existe un certificado para un estudiante-curso específico
   */
  checkCertificateExists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId } = req.params;

      if (!studentId || !courseId) {
        return res.status(400).json(prepareResponse(400, 'studentId y courseId son requeridos'));
      }

      const certificate = await this.certificateService.checkCertificateExists(studentId, courseId);

      return res.json(
        prepareResponse(200, 'Verificación completada', {
          exists: !!certificate,
          certificate: certificate || null,
        })
      );
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Lista todos los certificados para debug (temporal)
   */
  debugListAllCertificates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const certificates = await this.certificateService.debugListAllCertificates();

      return res.json(prepareResponse(200, 'Debug: Lista de certificados', certificates));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtiene certificados por curso
   */
  getCertificatesByCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'ID del curso requerido'));
      }

      const certificates = await this.certificateService.getCertificatesByCourse(courseId);

      return res.json(prepareResponse(200, 'Certificados obtenidos exitosamente', certificates));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtiene certificados por estudiante
   */
  getCertificatesByStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json(prepareResponse(400, 'ID del estudiante requerido'));
      }

      const certificates = await this.certificateService.getCertificatesByStudent(studentId);

      return res.json(prepareResponse(200, 'Certificados obtenidos exitosamente', certificates));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Elimina un certificado (soft delete)
   */
  deleteCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateId } = req.params;
      const authUser = (req as Request & { user?: { id?: string; _id?: string } }).user;
      const userId = authUser?.id || authUser?._id;

      if (!certificateId) {
        return res.status(400).json(prepareResponse(400, 'ID del certificado requerido'));
      }

      if (!userId) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const result = await this.certificateService.deleteCertificate(certificateId);

      return res.json(prepareResponse(200, 'Certificado eliminado exitosamente', result));
    } catch (error: unknown) {
      const errUnknown = error as unknown;
      const message = errUnknown instanceof Error ? errUnknown.message : String(errUnknown);
      if (message.includes('no encontrado')) {
        return res.status(404).json(prepareResponse(404, message));
      }

      return next(error as Error);
    }
  };

  /**
   * Regenera un certificado existente
   */
  regenerateCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateId } = req.params;
      const authUser = (req as Request & { user?: { id?: string; _id?: string } }).user;
      const userId = authUser?.id || authUser?._id;

      if (!certificateId) {
        return res.status(400).json(prepareResponse(400, 'ID del certificado requerido'));
      }

      if (!userId) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      // Obtener el certificado existente
      const existingCertificate = await this.certificateService.checkCertificateExistsById(certificateId);

      if (!existingCertificate) {
        return res.status(404).json(prepareResponse(404, 'Certificado no encontrado'));
      }

      // Verificar que el usuario tenga permisos para regenerar este certificado
      // (puede ser el generador original o un administrador)
      const isAdmin = hasAdminRole(req.user);
      const isOriginalGenerator = existingCertificate.generatedBy.toString() === userId;

      if (!isAdmin && !isOriginalGenerator) {
        return res.status(403).json(prepareResponse(403, 'No tienes permisos para regenerar este certificado. Solo el generador original o un administrador pueden hacerlo.'));
      }

      // Regenerar el certificado usando los mismos datos pero actualizando la fecha
      const regeneratedCertificate = await this.certificateService.regenerateCertificate(
        certificateId,
        userId // Usuario que está regenerando
      );

      return res.status(200).json(prepareResponse(200, 'Certificado regenerado exitosamente', regeneratedCertificate));
    } catch (error: unknown) {
      const errUnknown = error as unknown;
      const message = errUnknown instanceof Error ? errUnknown.message : String(errUnknown);
      if (message.includes('no encontrado')) {
        return res.status(404).json(prepareResponse(404, message));
      }

      if (message.includes('permisos')) {
        return res.status(403).json(prepareResponse(403, message));
      }

      return next(error as Error);
    }
  };

  /**
   * Descarga un certificado en formato PDF
   */
  downloadCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verificationCode } = req.params;

      if (!verificationCode) {
        return res.status(400).json(prepareResponse(400, 'Código de verificación requerido'));
      }

      // El código de verificación debe estar en formato iv:encrypted
      // No necesitamos dividir por certificateId ya que se guarda directamente como iv:encrypted
      const pdfBuffer = await this.certificateService.downloadCertificate(verificationCode);

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="certificado.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Enviar el PDF
      res.send(pdfBuffer);
    } catch (error: unknown) {
      const errUnknown = error as unknown;
      const message = errUnknown instanceof Error ? errUnknown.message : String(errUnknown);
      const stack = errUnknown instanceof Error ? (errUnknown.stack || '') : '';
      console.error('=== DOWNLOAD CERTIFICATE ERROR ===');
      console.error('Error message:', message);
      console.error('Error stack:', stack);
      console.error('Error details:', errUnknown);
      
      // Devolver siempre JSON válido para errores
      try {
        if (message.includes('no válido') || message.includes('no encontrado') || message.includes('expirado')) {
          return res.status(404).json(prepareResponse(404, message));
        }
        
        if (message.includes('incompletos')) {
          return res.status(400).json(prepareResponse(400, message));
        }

        // Para cualquier otro error, devolver 500 con mensaje
        return res.status(500).json(prepareResponse(500, message || 'Error interno del servidor'));
      } catch (jsonError) {
        console.error('Error creating JSON response:', jsonError);
        // Si no podemos crear JSON, devolver texto plano
        return res.status(500).send('Error interno del servidor: ' + (message || ''));
      }
    }
  };
}
