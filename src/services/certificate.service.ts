/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import mongoose from 'mongoose';
import { sendEmail } from '../utils/emailer';
import { logger } from '../utils';
import config from '@/config';
import UserRepository from '@/repositories/user.repository';
import CourseRepository from '@/repositories/course.repository';
import CertificateRepository from '@/repositories/certificate.repository';
import { generateCertificatePDF } from './certificate-pdf.service';

export default class CertificateService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly courseRepository: CourseRepository,
    private readonly certificateRepository: CertificateRepository
  ) { }

  /**
   * Helper para string de fechas estilo "27 y 28 de marzo de 2024" o "del 3 al 7 de abril de 2025"
   */
  private buildDatesString(startDate?: Date | string, endDate?: Date | string): string {
    if (!startDate && !endDate) return '';
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    if (s && e && !Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      if (s.toDateString() === e.toDateString()) {
        return s.toLocaleDateString('es-ES', opts);
      }
      if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
        // mismo mes
        const monthYear = s.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return `${s.getDate()} y ${e.getDate()} de ${monthYear}`;
      }
      // distinto mes o año
      const startStr = s.toLocaleDateString('es-ES', opts);
      const endStr = e.toLocaleDateString('es-ES', opts);
      return `del ${startStr} al ${endStr}`;
    }
    const only = (s || e)!;
    return new Date(only).toLocaleDateString('es-ES', opts);
  }

  /**
   * Genera un código de verificación encriptado
   */
  private generateVerificationCode(certificateData: any): string {
    const data = JSON.stringify({
      certificateId: certificateData.certificateId,
      studentId: certificateData.studentId,
      courseId: certificateData.courseId,
      generatedAt: certificateData.generatedAt,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Expira en 1 año
    });

    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      process.env.CERTIFICATE_ENCRYPTION_KEY || 'default-key-32-characters-long!!',
      'salt',
      32
    );
    // En producción, exigir que se configure CERTIFICATE_ENCRYPTION_KEY
    if (config.NODE_ENV === 'production' && !process.env.CERTIFICATE_ENCRYPTION_KEY) {
      throw new Error('CERTIFICATE_ENCRYPTION_KEY must be defined in production');
    }
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Combinar IV y texto encriptado
    const result = `${iv.toString('hex')}:${encrypted}`;
    return result;
  }

  /**
   * Desencripta un código de verificación
   */
  private decryptVerificationCode(encryptedCode: string): any {
    // Intentar primero con la clave del entorno
    try {
      const algorithm = 'aes-256-cbc';
      const envKey = process.env.CERTIFICATE_ENCRYPTION_KEY;
      if (envKey) {
        const key = crypto.scryptSync(envKey, 'salt', 32);
        const [ivHex, encryptedText] = encryptedCode.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
      }
    } catch (envError) {
      // Si falla con la clave del entorno, intentar con la clave por defecto
      logger.warn('Failed to decrypt with environment key, trying default key', envError);
    }

    // Intentar con la clave por defecto
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync('default-key-32-characters-long!!', 'salt', 32);
      const [ivHex, encryptedText] = encryptedCode.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (defaultError) {
      logger.error('Failed to decrypt with default key', defaultError);
      throw new Error('Código de verificación inválido');
    }
  }

  /**
   * Genera un PDF del certificado usando el servicio de PDF dedicado
   */
  private async generateCertificatePDFInternal(certificateData: any): Promise<Buffer> {
    logger.info('Generando certificado PDF');
    return generateCertificatePDF(certificateData);
  }

  /**
   * Genera un certificado para un estudiante
   */
  async generateCertificate(studentId: string, courseId: string, generatedBy: string) {
    // Obtener información del estudiante y curso
    const [student, course] = await Promise.all([
      this.userRepository.getUserById(studentId),
      this.courseRepository.findById(courseId),
    ]);

    if (!student) {
      throw new Error('Estudiante no encontrado');
    }

    if (!course) {
      throw new Error('Curso no encontrado');
    }

    // Obtener el teacherId del curso (primer profesor del array)
    const courseSafe = course as unknown as { teachers?: any[] };
    const teacherId = courseSafe.teachers && courseSafe.teachers.length > 0 ? courseSafe.teachers[0].toString() : null;
    
    if (!teacherId) {
      throw new Error('El curso no tiene profesor asignado');
    }

    // Obtener información del profesor
    const teacher = await this.userRepository.getUserById(teacherId);

    if (!teacher) {
      throw new Error('Profesor no encontrado');
    }

    // Normalizear shapes locales para evitar `as any` repetidos
    const studentSafe = student as unknown as { dni?: string; company?: string; companyName?: string; firstName?: string; lastName?: string; email?: string };
    const courseTyped = course as unknown as { endDate?: Date; location?: string; duration?: number; startDate?: Date };
    const teacherSafe = teacher as unknown as { profilePhotoUrl?: string; professionalSignatureUrl?: string; professionalDescription?: string; firstName?: string; lastName?: string; email?: string; _id?: unknown };

    // Verificar que el estudiante esté inscrito en el curso
    const isEnrolled = await this.userRepository.isUserEnrolledInCourse(studentId, courseId);
    if (!isEnrolled) {
      throw new Error('El estudiante no está inscrito en este curso');
    }

    // Buscar si ya existe un certificado para este estudiante-curso
    let savedCertificate: any;
    let verificationCode: string;
    const existingCertificate = await this.certificateRepository.findExistingCertificate(studentId, courseId);
    if (existingCertificate) {
      // Actualizar el certificado existente
      verificationCode = this.generateVerificationCode({
        certificateId: existingCertificate.certificateId,
        studentId,
        courseId,
        generatedAt: new Date(),
      });
      const updateData = {
        teacherId: new mongoose.Types.ObjectId(teacherId) as unknown as mongoose.Types.ObjectId,
        generatedBy: new mongoose.Types.ObjectId(generatedBy) as unknown as mongoose.Types.ObjectId,
        verificationCode,
        generatedAt: new Date(),
      } as unknown as Partial<import('@/models').ICertificate>;
      savedCertificate = await this.certificateRepository.update(existingCertificate._id.toString(), updateData);
    } else {
      // Crear nuevo certificado
      verificationCode = this.generateVerificationCode({
        certificateId: `CERT-${Date.now()}`,
        studentId,
        courseId,
        generatedAt: new Date(),
      });
      const certificateData = {
        studentId,
        courseId,
        teacherId,
        generatedBy,
        verificationCode,
        generatedAt: new Date(),
      } as unknown as Omit<import('@/models').ICertificate, 'certificateId'>;
      savedCertificate = await this.certificateRepository.create(certificateData);
    }

    // Preparar datos para el PDF / HTML
    if (!savedCertificate) throw new Error('No se pudo crear o actualizar el certificado');
    const certificateForPdf = {
      certificateId: savedCertificate.certificateId,
      verificationCode,
      generatedAt: savedCertificate.generatedAt,
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        dni: studentSafe.dni || '',
        company: studentSafe.company || studentSafe.companyName || '',
      },
      course: {
        name: course.name,
        description: course.description,
        startDate: course.startDate,
        endDate: courseSafe.endDate || new Date(),
        location: courseSafe.location || '',
        dates: this.buildDatesString(course.startDate, courseSafe.endDate || new Date()),
      },
      teacher: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        professionalDescription: teacher.professionalDescription,
        professionalSignatureUrl: teacherSafe.professionalSignatureUrl,
      },
    };

    // Generar PDF usando la configuración establecida
    logger.info('Generando certificado PDF');

    const pdfBuffer: Buffer = await this.generateCertificatePDFInternal({
      ...certificateForPdf,
      verificationCode,
    });

    logger.info('Certificado generado exitosamente');

    // Enviar por email
    await this.sendCertificateByEmail(student.email, certificateForPdf, pdfBuffer);

    // Retornar datos del certificado
    return {
      certificateId: savedCertificate.certificateId,
      verificationCode,
      qrCodeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/certificate/${verificationCode}`,
      studentName: `${student.firstName} ${student.lastName}`,
      courseName: course.name,
      generatedAt: savedCertificate.generatedAt,
      generatedBy,
    };
  }

  /**
   * Envía el certificado por email como adjunto
   */
  private async sendCertificateByEmail(studentEmail: string, certificateData: any, pdfBuffer: Buffer) {
    const subject = `Certificado de Finalización - ${certificateData.course.name}`;

    const html = `
      <div style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f4f8;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px;max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
                <!-- HEADER -->
                <tr>
                  <td style="padding:0;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(90deg,#003c70,#006eab 55%,#0090d8);color:#ffffff;">
                      <tr>
                        <td style="padding:20px 32px;font-size:28px;font-weight:700;letter-spacing:.5px;font-family:Arial,Helvetica,sans-serif;">CURSALA</td>
                        <td align="right" style="padding:20px 32px;font-size:16px;font-weight:600;font-style:italic;">Certificado de <span style="font-weight:700;">APROBACIÓN</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- HERO / TITULO -->
                <tr>
                  <td style="padding:40px 48px 10px 48px;text-align:center;">
                    <h2 style="margin:0;font-size:26px;line-height:32px;color:#24313d;font-weight:700;">¡Felicitaciones!</h2>
                    <p style="margin:14px 0 0 0;font-size:16px;color:#006eab;font-weight:600;">Has completado exitosamente el curso</p>
                    <p style="margin:18px 0 0 0;font-size:24px;line-height:30px;color:#24313d;font-weight:700;">"${certificateData.course.name}"</p>
                  </td>
                </tr>
                <!-- DETALLES -->
                <tr>
                  <td style="padding:24px 48px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f9fc;border:1px solid #e2e8f0;border-radius:12px;">
                      <tr>
                        <td style="padding:22px 28px;">
                          <h4 style="margin:0 0 12px 0;font-size:16px;color:#24313d;font-weight:700;">Detalles del Certificado</h4>
                          <p style="margin:4px 0;font-size:14px;color:#24313d;"><strong>Estudiante:</strong> ${certificateData.student.firstName} ${certificateData.student.lastName}</p>
                          <p style="margin:4px 0;font-size:14px;color:#24313d;"><strong>Curso:</strong> ${certificateData.course.name}</p>
                          <p style="margin:4px 0;font-size:14px;color:#24313d;"><strong>Profesor:</strong> ${certificateData.teacher.firstName} ${certificateData.teacher.lastName}</p>
                          <p style="margin:4px 0;font-size:14px;color:#24313d;"><strong>Fecha de generación:</strong> ${new Date(certificateData.generatedAt).toLocaleDateString('es-ES')}</p>
                          <p style="margin:4px 0;font-size:14px;color:#24313d;"><strong>Certificado N°:</strong> ${certificateData.certificateId}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- VERIFICACION -->
                <tr>
                  <td style="padding:0 48px 16px 48px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#e3f3fb;border:1px solid #c8e5f3;border-radius:12px;">
                      <tr>
                        <td style="padding:22px 28px;">
                          <h4 style="margin:0 0 12px 0;font-size:16px;color:#123c56;font-weight:700;">Verificación del Certificado</h4>
                          <p style="margin:0 0 16px 0;font-size:14px;line-height:20px;color:#123c56;">Tu certificado está adjunto en formato PDF. También podés verificar su autenticidad online:</p>
                          <p style="margin:0;text-align:center;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/certificate/${certificateData.verificationCode}" style="background:linear-gradient(90deg,#006eab,#0090d8);color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:50px;font-size:14px;font-weight:700;display:inline-block;">Verificar Certificado</a>
                          </p>
                          <p style="margin:18px 0 0 0;font-size:11px;color:#335d74;letter-spacing:.5px;text-align:center;">Código de verificación: <span style="font-family:monospace;">${certificateData.verificationCode}</span></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- NOTA -->
                <tr>
                  <td style="padding:8px 48px 40px 48px;text-align:center;">
                    <p style="margin:0;font-size:13px;line-height:19px;color:#4a5d67;">Este certificado fue generado automáticamente por el sistema Cursala y es válido según nuestros registros.</p>
                    <p style="margin:14px 0 0 0;font-size:11px;color:#7a8b96;">Si no solicitaste este certificado escribinos a <a href="mailto:${config.SUPPORT_EMAIL}" style="color:#7a8b96;">${config.SUPPORT_EMAIL}</a></p>
                  </td>
                </tr>
                <!-- FOOTER -->
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(90deg,#003c70,#006eab 55%,#0090d8);color:#ffffff;">
                      <tr>
                        <td style="padding:14px 32px;font-size:13px;font-weight:600;letter-spacing:.5px;text-align:right;">www.cursala.com.ar</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const attachments = [
      {
        filename: `Certificado_${certificateData.course.name.replace(/[^a-zA-Z0-9]/g, '_')}_${certificateData.student.firstName}_${certificateData.student.lastName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    // Solo enviar email en producción
    if (config.NODE_ENV === 'production') {
      try {
        await sendEmail({
          email: studentEmail,
          subject,
          html,
          attachments,
        });
      } catch (emailError) {
        console.error(`Error enviando email a ${studentEmail}:`, emailError);
        throw emailError; // Re-lanzar el error para que se capture en regenerateCertificate
      }
    } else {
      logger.info(`Email omitido en ${config.NODE_ENV}: ${studentEmail}`);
    }
  }

  /**
   * Valida un certificado usando el código de verificación
   */
  async validateCertificate(verificationCode: string) {
    try {
      // Desencriptar el código
      const decryptedData = this.decryptVerificationCode(verificationCode);

      // Verificar expiración
      if (decryptedData.expiresAt && new Date() > new Date(decryptedData.expiresAt)) {
        return { isValid: false, message: 'El certificado ha expirado' };
      }

      // Buscar el certificado en la base de datos usando el repositorio
      const certificate = await this.certificateRepository.validateCertificate(verificationCode);

      if (!certificate) {
        return { isValid: false, message: 'Certificado no encontrado' };
      }

      // Obtener datos completos del estudiante, curso y profesor
      const [student, course, teacher] = await Promise.all([
        this.userRepository.getUserById(certificate.studentId.toString()),
        this.courseRepository.findById(certificate.courseId.toString()),
        certificate.teacherId ? this.userRepository.getUserById(certificate.teacherId.toString()) : Promise.resolve(null),
      ]);

      if (!student || !course) {
        return { isValid: false, message: 'Datos del certificado incompletos' };
      }

      return {
        isValid: true,
        student: {
          _id: student._id.toString(),
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          username: student.username,
          dni: (student as unknown as { dni?: string }).dni || '',
        },
        course: {
          _id: course._id.toString(),
          name: course.name,
          description: course.description,
          startDate: course.startDate,
          endDate: (course as unknown as { endDate?: Date }).endDate || new Date(),
          duration: (course as unknown as { duration?: number }).duration || null,
        },
        teacher: teacher ? {
          _id: teacher._id.toString(),
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          professionalDescription: teacher.professionalDescription,
          professionalSignatureUrl: (teacher as unknown as { professionalSignatureUrl?: string }).professionalSignatureUrl,
        } : null,
        certificateInfo: {
          generatedAt: certificate.generatedAt,
          generatedBy: certificate.generatedBy,
          certificateId: certificate.certificateId,
        },
      };
    } catch (error: unknown) {
      return { isValid: false, message: 'Código de verificación inválido' };
    }
  }

  /**
   * Verifica si existe un certificado para un estudiante-curso específico
   */
  async checkCertificateExists(studentId: string, courseId: string) {
    return this.certificateRepository.findExistingCertificate(studentId, courseId);
  }

  /**
   * Lista todos los certificados para debug (temporal)
   */
  async debugListAllCertificates() {
    return this.certificateRepository.findAll();
  }

  /**
   * Obtiene certificados por curso
   */
  async getCertificatesByCourse(courseId: string) {
    return this.certificateRepository.findByCourse(courseId);
  }

  /**
   * Obtiene certificados por estudiante
   */
  async getCertificatesByStudent(studentId: string) {
    return this.certificateRepository.findByStudent(studentId);
  }

  /**
   * Verifica si existe un certificado por ID
   */
  async checkCertificateExistsById(certificateId: string) {
    return this.certificateRepository.findOneById(certificateId);
  }

  /**
   * Regenera un certificado existente (actualiza fecha de generación y reenvía por email)
   */
  async regenerateCertificate(certificateId: string, regeneratedBy: string) {
    // Obtener el certificado existente
    const existingCertificate = await this.certificateRepository.findOneById(certificateId);

    if (!existingCertificate) {
      throw new Error('Certificado no encontrado');
    }

    // Generar nuevo código de verificación con fecha actualizada
    const verificationCode = this.generateVerificationCode({
      certificateId: existingCertificate.certificateId,
      studentId: existingCertificate.studentId.toString(),
      courseId: existingCertificate.courseId.toString(),
      generatedAt: new Date(),
    });

    // Actualizar el certificado con nueva fecha y código
    const updateData = {
      verificationCode,
      generatedAt: new Date(),
    };

    const updatedCertificate = await this.certificateRepository.update(certificateId, updateData);

    if (!updatedCertificate) {
      throw new Error('Error al actualizar el certificado');
    }

    // Obtener datos completos para generar PDF
    const [student, course, teacher] = await Promise.all([
      this.userRepository.getUserById(existingCertificate.studentId.toString()),
      this.courseRepository.findById(existingCertificate.courseId.toString()),
      this.userRepository.getUserById(existingCertificate.teacherId.toString()),
    ]);

    if (!student || !course || !teacher) {
      throw new Error('Datos del certificado incompletos');
    }

    const studentSafe = student as unknown as { dni?: string; company?: string; companyName?: string; firstName?: string; lastName?: string; email?: string };
    const courseSafe = course as unknown as { endDate?: Date; location?: string; duration?: number; startDate?: Date };
    const teacherSafe = teacher as unknown as { profilePhotoUrl?: string; professionalSignatureUrl?: string; professionalDescription?: string; firstName?: string; lastName?: string; email?: string; _id?: unknown };

    // Preparar datos para el PDF
    const certificateForPdf = {
      certificateId: updatedCertificate.certificateId,
      verificationCode,
      generatedAt: updatedCertificate.generatedAt,
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        dni: studentSafe.dni || '',
        company: studentSafe.company || studentSafe.companyName || '',
      },
      course: {
        name: course.name,
        description: course.description,
        startDate: course.startDate,
        endDate: courseSafe.endDate || new Date(),
        location: courseSafe.location || '',
        dates: this.buildDatesString(course.startDate, courseSafe.endDate || new Date()),
      },
      teacher: {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        professionalDescription: teacher.professionalDescription,
        professionalSignatureUrl: teacherSafe.professionalSignatureUrl,
      },
    };

    // Generar nuevo PDF
    const pdfBuffer: Buffer = await this.generateCertificatePDFInternal({
      ...certificateForPdf,
      verificationCode,
    });

    try {
      // Reenviar por email
      await this.sendCertificateByEmail(student.email, certificateForPdf, pdfBuffer);
    } catch (emailError) {
      console.error('Error al enviar certificado por email:', emailError);
      // No lanzamos error aquí para que la regeneración sea exitosa aunque falle el email
      // Pero podríamos querer notificar al administrador o al usuario de alguna manera
    }

    // Retornar datos del certificado regenerado
    return {
      certificateId: updatedCertificate.certificateId,
      verificationCode,
      qrCodeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/certificate/${verificationCode}`,
      studentName: `${student.firstName} ${student.lastName}`,
      courseName: course.name,
      generatedAt: updatedCertificate.generatedAt,
      regeneratedBy,
      emailSent: true, // Indicamos que se intentó enviar el email
    };
  }

  /**
   * Elimina un certificado (soft delete)
   */
  async deleteCertificate(certificateId: string) {
    const certificate = await this.certificateRepository.softDelete(certificateId);
    if (!certificate) {
      throw new Error('Certificado no encontrado');
    }

    return { message: 'Certificado eliminado correctamente' };
  }

  /**
   * Descarga un certificado en formato PDF usando el código de verificación
   */
  async downloadCertificate(verificationCode: string): Promise<Buffer> {
    // Validar el código de verificación
    const validationResult = await this.validateCertificate(verificationCode);

    if (!validationResult.isValid) {
      throw new Error('Certificado no válido o expirado');
    }

    const { student, course, teacher, certificateInfo } = validationResult;

    if (!student || !course) {
      throw new Error('Datos del certificado incompletos');
    }

    const studentSafe = student as unknown as { dni?: string; company?: string; companyName?: string };
    const courseSafe = course as unknown as { location?: string; endDate?: Date };
    const teacherSafe = teacher as unknown as { professionalSignatureUrl?: string };

    const certificateForPdf = {
      certificateId: certificateInfo.certificateId,
      verificationCode,
      generatedAt: certificateInfo.generatedAt,
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        dni: studentSafe.dni || '',
        company: studentSafe.company || studentSafe.companyName || '',
      },
      course: {
        name: course.name,
        description: course.description,
        startDate: course.startDate,
        endDate: course.endDate || new Date(),
        location: courseSafe.location || '',
        dates: this.buildDatesString(course.startDate, courseSafe.endDate || new Date()),
      },
      teacher: teacher ? {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        professionalDescription: teacher.professionalDescription,
        professionalSignatureUrl: teacherSafe.professionalSignatureUrl,
      } : null,
    };

    // Generar el PDF
    const pdfBuffer = await this.generateCertificatePDFInternal({
      ...certificateForPdf,
      verificationCode,
    });

    return pdfBuffer;
  }
}
