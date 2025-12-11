import { sendEmail, logger, maskSensitiveFields } from '../utils';
import MercadoPagoRepository from '@/repositories/mercadoPago.repository';
import UserRepository from '@/repositories/user.repository';
import CourseRepository from '@/repositories/course.repository';
import { IMercadoPagoPayment, MercadoPagoPaymentStatus } from '@/models/mongo/mercadoPago.model';
import generalConnection from '@/config/databases';
import * as MercadoPagoService from '@/services/mercadoPago.service';
import config from '@/config';

export default class MercadoPagoPaymentService {
  private readonly userRepository: UserRepository;

  private readonly courseRepository: CourseRepository;

  constructor(private readonly mercadoPagoRepository: MercadoPagoRepository) {
    this.userRepository = new UserRepository(generalConnection);
    this.courseRepository = new CourseRepository(generalConnection);
  }

  /**
   * Registra un pago exitoso de MercadoPago en la base de datos
   */
  async registerSuccessfulPayment(paymentData: {
    paymentId: string;
    courseId: string;
    studentEmail: string;
    amount: number;
    externalReference: string;
  }): Promise<IMercadoPagoPayment> {
    try {
  logger.info('Registering successful MercadoPago payment', maskSensitiveFields(paymentData));

      // Verificar si el pago ya existe
      const existingPayment = await this.mercadoPagoRepository.findByPaymentId(paymentData.paymentId);
      if (existingPayment) {
        logger.info('Payment already exists in database', { paymentId: paymentData.paymentId });
        return existingPayment;
      }

      // Obtener información completa del pago desde MercadoPago
      const paymentInfo = await MercadoPagoService.getPaymentInfo(paymentData.paymentId);

      if (paymentInfo.status !== 'approved') {
        throw new Error(`Payment is not approved. Status: ${paymentInfo.status}`);
      }

      // Extraer información del curso desde external_reference
      const externalRefParts = paymentData.externalReference.split('_');
      const courseId = externalRefParts[1] || paymentData.courseId;

      // Obtener el nombre real del curso
      let courseName = `Curso ID: ${courseId}`; // Fallback por defecto
      try {
        const course = await this.courseRepository.findOneById(courseId);
        if (course) {
          courseName = course.name;
        }
      } catch (error) {
        logger.warn('Error getting course name, using fallback', {
          courseId,
          error: (error as Error).message,
        });
      }

      // Asignar dateApproved antes de crear el objeto
      let dateApproved: Date;
      if (paymentInfo.date_approved) {
        dateApproved = new Date(paymentInfo.date_approved);
      } else if (paymentInfo.date_created) {
        dateApproved = new Date(paymentInfo.date_created);
      } else {
        dateApproved = new Date();
      }

      // Crear registro en la base de datos
      const paymentRecord = await this.mercadoPagoRepository.createPayment({
        paymentId: paymentData.paymentId,
        externalReference: paymentData.externalReference,
        status: MercadoPagoPaymentStatus.APPROVED,
        statusDetail: paymentInfo.status_detail,
        transactionAmount: paymentInfo.transaction_amount,
        currencyId: paymentInfo.currency_id || 'ARS',
        courseId,
        courseName,
        studentEmail: paymentData.studentEmail,
        studentFirstName: paymentInfo.payer?.first_name,
        studentLastName: paymentInfo.payer?.last_name,
        payerEmail: paymentInfo.payer?.email,
        payerId: paymentInfo.payer?.id,
        paymentMethodId: paymentInfo.payment_method_id,
        paymentTypeId: paymentInfo.payment_type_id,
        dateCreated: paymentInfo.date_created ? new Date(paymentInfo.date_created) : new Date(),
        dateApproved,
        dateProcessed: new Date(),
        installments: paymentInfo.installments,
        isProcessed: true,
        accessGranted: true,
        accessGrantedAt: new Date(),
      });

      // Asignar curso automáticamente al usuario
      await this.assignCourseToUser(paymentData.studentEmail, courseId, new Date());

      // Enviar emails de confirmación
      await this.sendPaymentConfirmationEmails(paymentRecord);

      logger.info('MercadoPago payment registered successfully', {
        paymentId: paymentData.paymentId,
        amount: paymentInfo.transaction_amount,
        studentEmail: paymentData.studentEmail,
        courseAssigned: true,
      });

      return paymentRecord;
    } catch (error) {
      logger.error('Error registering successful payment', {
        error: (error as Error).message,
        paymentData: maskSensitiveFields(paymentData),
      });
      throw error;
    }
  }

  /**
   * Procesa una notificación de webhook de MercadoPago
   */
  async processWebhookNotification(webhookData: unknown): Promise<IMercadoPagoPayment | null> {
    try {
      const webhook = webhookData as { type?: string; data?: { id?: string } };
        logger.info('Processing MercadoPago webhook notification', maskSensitiveFields(webhookData as unknown));

      if (webhook.type !== 'payment') {
        logger.info('Webhook is not a payment notification, skipping');
        return null;
      }

      const paymentId = webhook.data?.id;
      if (!paymentId) {
        throw new Error('Payment ID not found in webhook data');
      }

      // Obtener información del pago desde MercadoPago
      const paymentInfo = await MercadoPagoService.getPaymentInfo(paymentId);

      // Buscar si el pago ya existe en nuestra base de datos
      let paymentRecord = await this.mercadoPagoRepository.findByPaymentId(paymentId);

      if (paymentRecord) {
        // Actualizar estado del pago existente
        paymentRecord = await this.mercadoPagoRepository.updatePaymentStatus(
          paymentId,
          paymentInfo.status as MercadoPagoPaymentStatus,
          {
            statusDetail: paymentInfo.status_detail,
            webhookReceived: true,
            webhookProcessedAt: new Date(),
          }
        );
        return paymentRecord;
      }

      // Crear nuevo registro si es un pago aprobado
      if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
        // Extraer información del external_reference
        const externalRefParts = paymentInfo.external_reference.split('_');
        const courseId = externalRefParts[1];

        // Obtener el nombre real del curso
        let courseName = `Curso ID: ${courseId}`; // Fallback por defecto
        try {
          const course = await this.courseRepository.findOneById(courseId);
          if (course) {
            courseName = course.name;
          }
        } catch (error) {
          logger.warn('Error getting course name in webhook, using fallback', {
            courseId,
            error: (error as Error).message,
          });
        }

        let dateApproved: Date;
        if (paymentInfo.date_approved) {
          dateApproved = new Date(paymentInfo.date_approved);
        } else if (paymentInfo.date_created) {
          dateApproved = new Date(paymentInfo.date_created);
        } else {
          dateApproved = new Date();
        }

        paymentRecord = await this.mercadoPagoRepository.createPayment({
          paymentId,
          externalReference: paymentInfo.external_reference,
          status: MercadoPagoPaymentStatus.APPROVED,
          statusDetail: paymentInfo.status_detail,
          transactionAmount: paymentInfo.transaction_amount,
          currencyId: paymentInfo.currency_id || 'ARS',
          courseId,
          courseName,
          studentEmail: paymentInfo.payer?.email || 'unknown@email.com',
          studentFirstName: paymentInfo.payer?.first_name,
          studentLastName: paymentInfo.payer?.last_name,
          payerEmail: paymentInfo.payer?.email,
          payerId: paymentInfo.payer?.id,
          paymentMethodId: paymentInfo.payment_method_id,
          paymentTypeId: paymentInfo.payment_type_id,
          dateCreated: paymentInfo.date_created ? new Date(paymentInfo.date_created) : new Date(),
          dateApproved,
          dateProcessed: new Date(),
          installments: paymentInfo.installments,
          isProcessed: true,
          accessGranted: true,
          accessGrantedAt: new Date(),
          webhookReceived: true,
          webhookProcessedAt: new Date(),
        });

        // Asignar curso automáticamente al usuario
        await this.assignCourseToUser(paymentInfo.payer?.email || 'unknown@email.com', courseId, new Date());

        // Enviar emails de confirmación solo para pagos nuevos aprobados
        await this.sendPaymentConfirmationEmails(paymentRecord);
        return paymentRecord;
      }

      return paymentRecord;
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error processing webhook notification', {
        error: err.message,
        webhookData: maskSensitiveFields(webhookData as unknown),
      });
      throw error;
    }
  }

  /**
   * Envía emails de confirmación de pago
   */
  private async sendPaymentConfirmationEmails(paymentRecord: IMercadoPagoPayment): Promise<void> {
    try {
      // Primero intentar obtener el nombre del usuario de la base de datos
      let studentName = 'Usuario'; // Fallback por defecto

      try {
        const user = await this.userRepository.findOneByEmail(paymentRecord.studentEmail);
        if (user && user.firstName) {
          // Usar firstName del usuario en la base de datos
          studentName = user.firstName;
        } else if (paymentRecord.studentFirstName && paymentRecord.studentLastName) {
          // Fallback: usar datos de MercadoPago
          studentName = `${paymentRecord.studentFirstName} ${paymentRecord.studentLastName}`;
        } else if (paymentRecord.studentFirstName) {
          // Fallback: usar solo firstName de MercadoPago
          studentName = paymentRecord.studentFirstName;
        }
      } catch (error) {
        logger.warn('Error getting user name from database, using MercadoPago data', {
          email: paymentRecord.studentEmail,
          error: (error as Error).message,
        });

        // Fallback: usar datos de MercadoPago
        if (paymentRecord.studentFirstName && paymentRecord.studentLastName) {
          studentName = `${paymentRecord.studentFirstName} ${paymentRecord.studentLastName}`;
        } else if (paymentRecord.studentFirstName) {
          studentName = paymentRecord.studentFirstName;
        }
      }

      // Email al estudiante
      await this.sendStudentConfirmationEmail(paymentRecord, studentName);

      // Email a administración
      await this.sendAdminNotificationEmail(paymentRecord, studentName);

      logger.info('Payment confirmation emails sent successfully', {
        paymentId: paymentRecord.paymentId,
        studentEmail: paymentRecord.studentEmail,
        studentName,
      });
    } catch (error) {
      logger.error('Error sending payment confirmation emails', {
        error: (error as Error).message,
        paymentId: paymentRecord.paymentId,
      });
      // No lanzar error aquí para no afectar el registro del pago
    }
  }

  /**
   * Envía email de confirmación al estudiante
   */
  private async sendStudentConfirmationEmail(paymentRecord: IMercadoPagoPayment, studentName: string): Promise<void> {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #417FBE; font-size: 28px; margin: 0;">¡Pago Confirmado!</h1>
          </div>
          
          <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
            Hola <strong>${studentName}</strong>,
          </p>
          
          <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
            ¡Excelente noticia! Tu pago ha sido procesado exitosamente y ya tienes acceso completo a tu curso.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #417FBE;">
            <h3 style="color: #2c3e50; margin-top: 0; margin-bottom: 15px;">Detalles del Pago:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 40%;">ID de Pago:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Curso:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.courseName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Monto:</td>
                <td style="padding: 8px 0; color: #34495e;">$${paymentRecord.transactionAmount.toLocaleString('es-AR')} ${paymentRecord.currencyId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.dateApproved?.toLocaleDateString('es-AR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Estado:</td>
                <td style="padding: 8px 0; color: #27ae60; font-weight: bold;">✅ Aprobado</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #27ae60; margin-top: 0; margin-bottom: 15px;">🎉 ¡Ya puedes acceder a tu curso!</h3>
            <p style="color: #2c3e50; margin-bottom: 15px;">
              Tu curso ha sido asignado automáticamente a tu cuenta. Tienes acceso completo durante <strong>3 meses</strong> a partir de hoy.
            </p>
            <div style="background-color: #fff; padding: 15px; border-radius: 5px; border-left: 3px solid #27ae60;">
              <p style="margin: 0; color: #2c3e50; font-size: 14px;">
                <strong>📅 Período de acceso:</strong><br>
                Desde: <strong>${paymentRecord.dateApproved?.toLocaleDateString('es-AR') || 'Fecha no disponible'}</strong><br>
                Hasta: <strong>${paymentRecord.dateApproved ? new Date(paymentRecord.dateApproved.getTime() + 3 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR') : 'Fecha no disponible'}</strong>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="https://cursala.com.ar/mycourses" style="background-color: #417FBE; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Acceder a Mis Cursos
            </a>
          </div>
          
          <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
            Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
            <p style="margin: 0; color: #34495e;">
              📧 Email: <a href="mailto:${config.ADMINISTRATION_EMAIL}" style="color: #417FBE;">${config.ADMINISTRATION_EMAIL}</a><br>
              📱 WhatsApp: <a href="https://wa.me/5492612380499" style="color: #417FBE;">+54 9 261 238-0499</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #7f8c8d; font-size: 14px; margin: 0;">
              Gracias por confiar en Cursala<br>
              <strong>¡Que disfrutes tu aprendizaje!</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      email: paymentRecord.studentEmail,
      subject: '🎉 ¡Pago Confirmado! Ya tienes acceso a tu curso - Cursala',
      html: emailHtml,
    });
  }

  /**
   * Envía email de notificación a administración
   */
  private async sendAdminNotificationEmail(paymentRecord: IMercadoPagoPayment, studentName: string): Promise<void> {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">💳 Nuevo Pago MercadoPago Recibido</h2>
          
          <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
            Se ha procesado exitosamente un nuevo pago a través de MercadoPago:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">ID de Pago:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Estudiante:</td>
                <td style="padding: 8px 0; color: #34495e;">${studentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.studentEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Curso:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.courseName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Monto:</td>
                <td style="padding: 8px 0; color: #34495e;">$${paymentRecord.transactionAmount.toLocaleString('es-AR')} ${paymentRecord.currencyId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Método:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.paymentMethodId || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px 0; color: #34495e;">${paymentRecord.dateApproved?.toLocaleString('es-AR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Estado:</td>
                <td style="padding: 8px 0; color: #27ae60; font-weight: bold;">✅ Aprobado y Procesado</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Referencia:</td>
                <td style="padding: 8px 0; color: #34495e; font-family: monospace; font-size: 12px;">${paymentRecord.externalReference}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #2c3e50;">
              ✅ <strong>Acciones Completadas Automáticamente:</strong><br>
              • Pago registrado en base de datos<br>
              • Curso asignado al usuario (acceso por 3 meses)<br>
              • Acceso desde: ${paymentRecord.dateApproved?.toLocaleDateString('es-AR') || 'Fecha no disponible'}<br>
              • Acceso hasta: ${paymentRecord.dateApproved ? new Date(paymentRecord.dateApproved.getTime() + 3 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR') : 'Fecha no disponible'}<br>
              • Email de confirmación enviado al usuario
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #7f8c8d; font-size: 14px;">
              <strong>Sistema de Notificaciones - Cursala</strong><br>
              Pago procesado automáticamente vía MercadoPago
            </p>
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      email: config.ADMINISTRATION_EMAIL!,
      subject: `💳 Nuevo Pago MercadoPago: $${paymentRecord.transactionAmount.toLocaleString('es-AR')} - ${studentName}`,
      html: emailHtml,
    });
  }

  /**
   * Obtiene el historial de pagos de un estudiante
   */
  async getStudentPayments(studentEmail: string): Promise<IMercadoPagoPayment[]> {
    return this.mercadoPagoRepository.getPaymentsByStudent(studentEmail);
  }

  /**
   * Obtiene las estadísticas de pagos
   */
  async getPaymentStats() {
    return this.mercadoPagoRepository.getPaymentStats();
  }

  /**
   * Asigna un curso automáticamente al usuario cuando realiza un pago exitoso
   * Fecha de inicio: fecha del pago
   * Fecha de fin: fecha del pago + 3 meses
   */
  private async assignCourseToUser(studentEmail: string, courseId: string, paymentDate: Date): Promise<void> {
    try {
      logger.info('Assigning course to user after successful payment', maskSensitiveFields({ studentEmail, courseId, paymentDate }));

      // Buscar usuario por email
      const user = await this.userRepository.findOneByEmail(studentEmail);
      if (!user) {
  logger.warn('User not found for course assignment', maskSensitiveFields({ studentEmail }));
        return;
      }

      // Calcular fechas: inicio = fecha de pago, fin = fecha de pago + 3 meses
      const startDate = new Date(paymentDate);
      const endDate = new Date(paymentDate);
      endDate.setMonth(endDate.getMonth() + 3);

      // Asignar curso al usuario
      const updatedUser = await this.userRepository.assignCourseToUser(
        user._id.toString(),
        courseId,
        startDate,
        endDate
      );

      if (updatedUser) {
        logger.info('Course assigned successfully to user', maskSensitiveFields({
          userId: user._id,
          studentEmail,
          courseId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          accessDuration: '3 months',
        }));
      } else {
        logger.warn('Course assignment failed - course may already be assigned', maskSensitiveFields({
          userId: user._id,
          studentEmail,
          courseId,
        }));
      }
    } catch (error) {
      logger.error('Error assigning course to user', {
        error: (error as Error).message,
        details: maskSensitiveFields({ studentEmail, courseId, paymentDate }),
      });
      // No lanzar error para no afectar el procesamiento del pago
    }
  }
}
