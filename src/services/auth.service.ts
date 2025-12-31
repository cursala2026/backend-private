import bcrypt from 'bcryptjs';
import ms from 'ms';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '../models/user.model';
import { UserRoles } from '@/models';
import { sendEmail } from '../utils/emailer';
import fs from 'fs';
import path from 'path';
import config from '@/config';
import errors from '@/config/errors';
import { logger } from '../utils';
import UserRepository from '@/repositories/user.repository';

/**
 * AuthService - Simplified for fixed roles (ADMIN, PROFESOR, ALUMNO)
 * No dynamic role/permission management - roles are stored as string codes
 */
class AuthService {
  constructor(
    private readonly userRepository: UserRepository
  ) { }

  /**
   * Validates a user's credentials.
   * @param user - The username or email of the user.
   * @param plainTextPassword - The password to validate.
   * @returns The user document if validation is successful.
   */
  async validateUser(user: string, plainTextPassword: string): Promise<IUser> {
    const userDoc: IUser | null = await this.userRepository.findOne(user);
    if (!userDoc) {
      throw errors.login.users.not_found;
    }
    const isMatch = await bcrypt.compare(plainTextPassword, userDoc.password);
    if (!isMatch) {
      throw errors.login.accounts.unauthorized;
    }
    return userDoc;
  }

  /**
   * Logs in a user, returning a token and user info if successful.
   * @param user - The username or email of the user to log in.
   * @param plainTextPassword - The password of the user.
   * @returns The login token and user info.
   */
  async login(user: string, plainTextPassword: string) {
    const userDoc = await this.validateUser(user, plainTextPassword);
    // Obtener la versión completa y actualizada del usuario desde la BD
    // Esto asegura que `roles` venga en el formato real almacenado (ObjectId[] o string[])
    // y evita problemas de casting/inferencia de Mongoose en documentos parciales.
    const fullUserDoc = await this.userRepository.getUserById(String(userDoc._id));
    const rolesSource = fullUserDoc && Array.isArray(fullUserDoc.roles) ? fullUserDoc.roles : userDoc.roles;
    const jwtSecret = config.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not configured');
    const expiresIn = String(config.EXPIRE_TIME_TOKEN_USER_LOGGED ?? '1h');

    const signFn = jwt.sign as unknown as (payload: unknown, secret: jwt.Secret, options?: any) => string;
    const userId = String(userDoc._id);
    const token = signFn({ _id: userId }, jwtSecret as jwt.Secret, { expiresIn });

    let resolvedRoles = await this.resolveRoleCodes(rolesSource);
    // Si la resolución no devuelve roles pero el documento indica isAdmin o contiene 'ADMIN', forzar ADMIN
    try {
      if ((!Array.isArray(resolvedRoles) || resolvedRoles.length === 0) && fullUserDoc) {
        const rolesRaw = (fullUserDoc as any).roles;
        const isAdminFlag = Boolean((fullUserDoc as any).isAdmin);
        const hasAdminString = Array.isArray(rolesRaw) && rolesRaw.map((r: any) => String(r).toUpperCase()).includes('ADMIN');
        if (isAdminFlag || hasAdminString) {
          resolvedRoles = ['ADMIN'];
        }
      }
    } catch (e) {
      // ignore
    }

    const userInfo = {
      _id: userDoc._id,
      email: userDoc.email,
      username: userDoc.username,
      // Normalize roles to role codes for frontend convenience (e.g. ['ADMIN','ALUMNO'])
      roles: resolvedRoles,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      phone: userDoc.phone,
      birthDate: userDoc.birthDate,
      dni: userDoc.dni,
      professionalDescription: userDoc.professionalDescription,
      profilePhotoUrl: userDoc.profilePhotoUrl,
      professionalSignatureUrl: userDoc.professionalSignatureUrl,
    };

    return { token, userInfo };
  }

  /**
   * Normalize roles to uppercase string codes (ADMIN, PROFESOR, ALUMNO)
   * Handles both string codes and legacy ObjectId formats
   */
  private async resolveRoleCodes(roles: unknown): Promise<string[]> {
    try {
      if (!Array.isArray(roles) || roles.length === 0) return [];

      // Convert all roles to uppercase strings
      // Filters out any invalid/empty values
      const asStrings = roles
        .map((r: any) => String(r).toUpperCase())
        .filter(Boolean);

      return Array.from(new Set(asStrings));
    } catch (err) {
      return [];
    }
  }

  /**
   * Generates a reset password token for a user.
   * @param email - The email of the user to generate a token for.
   * @returns The reset token and its expiration date.
   */
  async generateResetPasswordToken(email: string): Promise<{ token: string; expiresIn: number; tokenForDev?: string; resetUrlForDev?: string }> {
    let user = await this.userRepository.findOneByEmail(email);

    if (!user) {
      throw errors.login.users.unregistered;
    }

    const jwtSecret = config.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not configured');
    const expiresInReset = String(config.EXPIRE_TIME_TOKEN_RESET_PASSWORD ?? '1h');
    const signFnLocal = jwt.sign as unknown as (payload: unknown, secret: jwt.Secret, options?: any) => string;
    const token = signFnLocal({ userId: user._id }, jwtSecret as jwt.Secret, { expiresIn: expiresInReset });
    user.resetPasswordToken = token;

    user = await this.userRepository.updatePasswordResetToken(String(user._id), token);

    const resetUrl = `${config.FRONTEND_DOMAIN}${config.RESET_PASSWORD_FRONTEND_PATH}?token=${token}`;

    // Leer la plantilla HTML
    let htmlTemplate = '';
    try {
      const templatePath = path.resolve(process.cwd(), 'src', 'static', 'password-recovery-email.html');
      if (!fs.existsSync(templatePath)) {
        // Intentar desde backend-cursala/src/static/
        const altTemplatePath = path.resolve(process.cwd(), 'backend-cursala', 'src', 'static', 'password-recovery-email.html');
        if (fs.existsSync(altTemplatePath)) {
          htmlTemplate = fs.readFileSync(altTemplatePath, 'utf8');
        }
      } else {
        htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      }
    } catch (error) {
      console.warn('Error reading password recovery template, using fallback HTML:', error);
    }

    // Si no se pudo leer la plantilla, usar HTML básico
    let htmlContent = htmlTemplate;
    if (!htmlTemplate) {
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Recuperar contraseña - Cursala</h2>
          <p>Hola,</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p>
          <p><a href="${resetUrl}" style="background-color: #0090d8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a></p>
          <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          <p>Este enlace expirará en 1 hora.</p>
          <br>
          <p>Saludos,<br>El equipo de Cursala</p>
        </div>
      `;
    } else {
      // Reemplazar placeholders en la plantilla
      htmlContent = htmlTemplate
        .replace(/\{\{resetUrl\}\}/g, resetUrl)
        .replace(/\{\{supportEmail\}\}/g, config.SUPPORT_EMAIL || 'soporte@cursala.com.ar')
        .replace(/https:\/\/todo-gestion\.com\/static\/Imagenes\/Logo\.png/g, '/images/logo/logo-02-A-white.svg');
    }

    // Intentar enviar el email, pero no fallar si estamos en desarrollo
    const isDevelopment = config.NODE_ENV === 'development';
    let emailSent = false;
    
    try {
      await sendEmail({
        email,
        subject: 'Restablecimiento de contraseña - Cursala',
        html: htmlContent,
      });
      emailSent = true;
      logger.info(`Email de restablecimiento de contraseña enviado a ${email}`);
    } catch (emailError) {
      if (isDevelopment) {
        // En desarrollo, loguear el error pero continuar
        // Esto permite probar el flujo sin tener SMTP configurado
        logger.warn(`⚠️ Error al enviar email de restablecimiento (desarrollo):`, emailError);
        logger.info(`📧 Token de restablecimiento generado para ${email}: ${token}`);
        logger.info(`🔗 URL de restablecimiento: ${resetUrl}`);
      } else {
        // En producción, lanzar error más específico
        logger.error(`❌ Error al enviar email de restablecimiento:`, emailError);
        // Loguear el token en caso de que el admin necesite dárselo manualmente al usuario
        logger.error(`Token generado (por si el admin necesita darlo manualmente): ${token}`);
        throw new Error('No se pudo enviar el correo de restablecimiento de contraseña. Por favor, contacta al administrador.');
      }
    }

    // Asegurar tipos: `ms` recibe string y retorna number
    const expiresInMilliseconds = Number(
      ms(String(config.EXPIRE_TIME_TOKEN_RESET_PASSWORD ?? '1h') as unknown as import('ms').StringValue) as unknown as number
    );

    // En desarrollo, incluir el token en la respuesta para facilitar las pruebas
    // Esto permite probar manualmente sin necesidad de email
    const response: { token: string; expiresIn: number; tokenForDev?: string; resetUrlForDev?: string } = { 
      token, 
      expiresIn: expiresInMilliseconds 
    };
    
    // Solo incluir el token en desarrollo para que puedan usarlo manualmente
    if (isDevelopment && !emailSent) {
      response.tokenForDev = token;
      response.resetUrlForDev = resetUrl;
    }

    return response;
  }

  async resetPassword(token: string, newPassword: string): Promise<IUser> {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET as jwt.Secret) as JwtPayload & { userId: string };
      this.validatePassword(newPassword);
      const user = await this.userRepository.findOneById(decoded.userId);
      if (!user) {
        throw errors.login.users.not_found;
      }
      if (user.resetPasswordToken !== token) {
        throw errors.password_reset.token_invalid;
      }

      user.password = await this.hashPassword(newPassword);
      await this.userRepository.save(user);
      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw errors.password_reset.token_expired;
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw errors.password_reset.token_invalid;
      }
      throw error;
    }
  }

  /**
   * Validates a password against specific criteria.
   * @param password - The password to validate.
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw errors.password_reset.password_too_short;
    }
  }

  /**
   * Hashes a password.
   * @param password - The password to hash.
   * @returns The hashed password.
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Retrieves user information excluding the password.
   * Roles are returned as string codes (ADMIN, PROFESOR, ALUMNO)
   * @param user - The user object to extract information from.
   */
  async getUserInfo(user: IUser) {
    // Get complete user from database with all updated fields
    const fullUserDoc = await this.userRepository.getUserById(String(user._id));

    if (!fullUserDoc) {
      throw errors.login.users.not_found;
    }

    // Convert Mongoose document to plain object if needed
    type MaybeDocument<T> = { toObject?: () => T } & T;
    const maybeDoc = fullUserDoc as MaybeDocument<IUser>;
    const userObject = typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : { ...maybeDoc };

    // Remove password from response
    const { password, ...userInfoWithoutPassword } = userObject;

    return userInfoWithoutPassword;
  }

  /**
   * Register a new user in the system
   * @param user  - The user object gotten of the body param
   */
  async register(user: Partial<IUser>) {
    const userFound = await this.userRepository.findOneByEmail(user.email as string);
    if (userFound) {
      throw errors.register.users.already_exists;
    }
    // Check username uniqueness as well
    const userByUsername = await this.userRepository.findOne(user.username as string);
    if (userByUsername) {
      throw errors.register.users.already_exists;
    }
    let birthDateValue: Date | undefined;
    if (user.birthDate) {
      if (typeof user.birthDate === 'string') {
        birthDateValue = new Date(user.birthDate);
      } else {
        birthDateValue = user.birthDate;
      }
    } else {
      birthDateValue = undefined;
    }

    // Asignar rol por defecto si no se proporciona. Usar enum estático (no dinámico).
    // Roles válidos: UserRoles.ADMIN | UserRoles.PROFESOR | UserRoles.ALUMNO
    let userRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [UserRoles.ALUMNO];

    const usernameValue = user.firstName
      ? String(user.firstName)
      : (user.email ? String(user.email).split('@')[0] : '');

    const newUser = {
      username: usernameValue,
      password: await this.hashPassword(user.password as string),
      email: user.email as string,
      phone: user.phone as string,
      firstName: user.firstName as string,
      lastName: user.lastName as string,
      birthDate: birthDateValue,
      dni: user.dni as string,
      roles: userRoles,
      status: 'ACTIVE', // Siempre crear usuarios con estado activo
    } as IUser;
    const created = await this.userRepository.createUser(newUser);

    // Enviar email de bienvenida. Si el envío falla (p. ej. en dev sin SMTP),
    // no debemos hacer que el registro falle por completo. Logueamos el error
    // y devolvemos el usuario creado.
    try {
      await sendEmail({
        email: newUser.email,
        subject: 'Bienvenido a Cursala',
        html: `
        <h2>¡Bienvenido a Cursala!</h2>
        <p>Hola ${newUser.firstName},</p>
        <p>Te damos la bienvenida a <strong>Cursala</strong>, la plataforma educativa que te ayudará a alcanzar tus objetivos de aprendizaje.</p>
        <p>Tu cuenta ha sido creada exitosamente. Ahora puedes:</p>
        <ul>
          <li>Explorar nuestros cursos disponibles</li>
          <li>Acceder a contenido educativo de calidad</li>
        </ul>
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        <p>¡Que disfrutes tu experiencia de aprendizaje!</p>
        <br>
        <p>Saludos,<br>El equipo de Cursala</p>
      `,
      });
    } catch (emailErr) {
      logger.error('Error sending welcome email for user ' + newUser.email, emailErr as any);
    }

    return created;
  }

}

export default AuthService;
