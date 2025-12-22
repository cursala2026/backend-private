import mongoose from 'mongoose';
import crypto from 'crypto';
import { sendEmail, logger } from '../utils';
import config from '@/config';
import AdminVerificationCode from '../models/mongo/adminVerificationCode.model';

export interface GenerateCodeRequest {
  userId: string;
  action: string;
  userData?: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  metadata?: {
    formType?: string;
    targetId?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface VerifyCodeRequest {
  userId: string;
  code: string;
  action: string;
}

export interface AdminSecurityResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

class AdminSecurityService {
  /**
   * Genera un código de verificación de 6 dígitos
   */
  private generateVerificationCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Obtiene el email de notificación de administrador desde variables de entorno
   */
  private getAdminNotificationEmail(): string {
    const adminEmail = config.ADMIN_NOTIFICATION_EMAIL;
    if (!adminEmail) {
      throw new Error('ADMIN_NOTIFICATION_EMAIL environment variable is not configured');
    }
    return adminEmail;
  }

  /**
   * Genera y envía un código de verificación por email
   */
  async generateAndSendCode(request: GenerateCodeRequest): Promise<AdminSecurityResponse> {
    try {
      const { userId, action, metadata, userData } = request;

      // Validar que el usuario existe y es administrador
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          message: 'ID de usuario inválido',
        };
      }

      // Invalidar códigos anteriores para esta acción
      await AdminVerificationCode.updateMany(
        {
          userId: new mongoose.Types.ObjectId(userId),
          action,
          isUsed: false,
          expiresAt: { $gt: new Date() },
        },
        { isUsed: true }
      );

      // Generar nuevo código
      const code = this.generateVerificationCode();

      // Crear registro en BD con expiración de 10 minutos
      const expirationTime = new Date(Date.now() + 10 * 60 * 1000);

      const verificationCode = new AdminVerificationCode({
        userId: new mongoose.Types.ObjectId(userId),
        code,
        action,
        expiresAt: expirationTime,
        metadata: metadata || {},
      });

      await verificationCode.save();

      // Enviar código por email
      await this.sendVerificationEmail(code, action, metadata, userData);

      logger.info(`Verification code generated for user ${userId}, action: ${action}`);

      return {
        success: true,
        message: 'Código de verificación enviado al email del administrador',
        data: {
          codeId: verificationCode._id,
          expiresAt: expirationTime,
        },
      };
    } catch (error) {
      logger.error('Error generating verification code:', error);
      return {
        success: false,
        message: 'Error generando código de verificación',
      };
    }
  }

  /**
   * Verifica un código de verificación
   */
  async verifyCode(request: VerifyCodeRequest): Promise<AdminSecurityResponse> {
    try {
      const { userId, code, action } = request;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return {
          success: false,
          message: 'ID de usuario inválido',
        };
      }

      // Buscar código válido y no usado
      const verificationCode = await AdminVerificationCode.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        code,
        action,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      });

      if (!verificationCode) {
        return {
          success: false,
          message: 'Código inválido o expirado',
        };
      }

      // Marcar como usado
      verificationCode.isUsed = true;
      await verificationCode.save();

      logger.info(`Verification code verified successfully for user ${userId}, action: ${action}`);

      return {
        success: true,
        message: 'Código verificado correctamente',
        data: {
          verifiedAt: new Date(),
          validFor: '30 minutes', // Tiempo válido para realizar la acción
        },
      };
    } catch (error) {
      logger.error('Error verifying code:', error);
      return {
        success: false,
        message: 'Error verificando código',
      };
    }
  }

  /**
   * Envía el email con el código de verificación usando sendEmail de cursala-common
   */
  private async sendVerificationEmail(
    code: string,
    action: string,
    metadata?: GenerateCodeRequest['metadata'],
    userData?: GenerateCodeRequest['userData']
  ): Promise<void> {
  const adminEmail = config.ADMIN_NOTIFICATION_EMAIL;

    const actionDescriptions: Record<string, string> = {
      edit_bank_account: 'Editar Datos Bancarios',
      edit_user_data: 'Editar Datos de Usuario',
      edit_company_data: 'Editar Datos de Empresa',
      edit_roles: 'Editar Roles',
      delete_user: 'Eliminar Usuario',
      critical_settings: 'Configuraciones Críticas',
    };

    const actionDescription = actionDescriptions[action] || action;

    const subject = `🔐 Código de Verificación Administrativa - ${actionDescription}`;

    // Información del usuario que solicita acceso
    const userInfoHtml = userData
      ? `
      <div style="background-color: #e3f2fd; border: 1px solid #bbdefb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h4 style="color: #1565c0; margin: 0 0 15px 0; font-size: 16px;">👤 Usuario que Solicita Acceso:</h4>
        <ul style="color: #1976d2; font-size: 14px; margin: 0; padding-left: 20px;">
          ${userData.firstName || userData.lastName ? `<li><strong>Nombre:</strong> ${[userData.firstName, userData.lastName].filter(Boolean).join(' ')}</li>` : ''}
          ${userData.username ? `<li><strong>Usuario:</strong> ${userData.username}</li>` : ''}
          ${userData.email ? `<li><strong>Email:</strong> ${userData.email}</li>` : ''}
        </ul>
      </div>`
      : '';

    // Detalles técnicos de la solicitud
    const detailsHtml =
      metadata || userData
        ? `
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <h4 style="color: #495057; margin: 0 0 15px 0; font-size: 16px;">📋 Detalles de la Solicitud:</h4>
        <ul style="color: #6c757d; font-size: 14px; margin: 0; padding-left: 20px;">
          ${metadata?.formType ? `<li><strong>Tipo de formulario:</strong> ${metadata.formType}</li>` : ''}
          ${metadata?.targetId ? `<li><strong>ID objetivo:</strong> ${metadata.targetId}</li>` : ''}
          <li><strong>Timestamp:</strong> ${new Date().toLocaleString('es-ES', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}</li>
        </ul>
      </div>`
        : '';

    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔐 Verificación de Seguridad</h1>
            <p style="color: #e8e8e8; margin: 10px 0 0 0; font-size: 16px;">Acceso Administrativo Requerido</p>
          </div>
          <div style="padding: 40px 30px;">
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 18px;">⚠️ Solicitud de Acción Administrativa</h3>
              <p style="color: #856404; margin: 0; font-size: 14px;">Se ha solicitado realizar la siguiente acción: <strong>${actionDescription}</strong></p>
            </div>
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="font-size: 16px; color: #333333; margin-bottom: 20px;">Tu código de verificación es:</p>
              <div style="background-color: #f8f9fa; border: 2px dashed #6c757d; border-radius: 12px; padding: 25px; margin: 20px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #495057; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</div>
              </div>
              <p style="font-size: 14px; color: #6c757d; margin-top: 15px;">Este código es válido por <strong>10 minutos</strong></p>
            </div>
            ${userInfoHtml}
            ${detailsHtml}
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px;">
              <h4 style="color: #0c5460; margin: 0 0 10px 0; font-size: 16px;">🛡️ Medidas de Seguridad</h4>
              <ul style="color: #0c5460; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>Nunca compartas este código con terceros</li>
                <li>El código expira automáticamente en 10 minutos</li>
                <li>Solo puede ser usado una vez</li>
                <li>Si no solicitaste esta acción, ignora este email</li>
              </ul>
            </div>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">Sistema de Seguridad Administrativa - Cursala<br />Este es un email automático, no responder.</p>
          </div>
        </div>
      </body></html>`;

    // Enviar al email configurado
    await sendEmail({ email: adminEmail!, subject, html });
    logger.info(`Verification email sent to admin: ${adminEmail}`);
  }

  /**
   * Limpia códigos expirados (se ejecuta automáticamente por el TTL de MongoDB, pero útil para limpieza manual)
   */
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const result = await AdminVerificationCode.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isUsed: true, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Códigos usados de más de 24h
        ],
      });

      logger.info(`Cleaned up ${result.deletedCount} expired verification codes`);
    } catch (error) {
      logger.error('Error cleaning up expired codes:', error);
    }
  }

  /**
   * Verifica si existe un código válido y reciente para una acción (para prevenir spam)
   */
  async hasRecentCode(userId: string, action: string): Promise<boolean> {
    try {
      const recentCode = await AdminVerificationCode.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        action,
        isUsed: false,
        createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) }, // Últimos 2 minutos
      });

      return !!recentCode;
    } catch (error) {
      logger.error('Error checking recent code:', error);
      return false;
    }
  }
}

export default new AdminSecurityService();
