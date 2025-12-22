/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { IUser } from '../models/user.model';
import { sendEmail } from '../utils/emailer';
import { IUserExtended } from '@/types/user.types';
import { Types, UserStatus } from '@/models';
import { deleteOldFile } from '@/utils/fileUpload.util';
import UserRepository from '@/repositories/user.repository';
import CourseRepository from '@/repositories/course.repository';
import logger from '@/utils/logger';

// Directorio remoto (desarrollo) - verificar si está montado
const remoteStaticDir = path.join(os.homedir(), 'cursala-remote-static');
const isRemoteMounted = fs.existsSync(remoteStaticDir);

// Directorios base para archivos estáticos
const staticBaseDir = isRemoteMounted ? remoteStaticDir : '/app/dist/src/static';

console.log('🔧 User service static directories:', {
  isRemoteMounted,
  remoteStaticDir,
  staticBaseDir
});

export default class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly courseRepository: CourseRepository
  ) { }

  async addCountriesToUser(userId: string, newCountries: string[] | []) {
    return this.userRepository.addCountriesToUser(userId, newCountries);
  }

  async getAllUsers() {
    return this.userRepository.getAllUsers();
  }

  async getUsersPaginated(params: {
    page: number;
    limit: number;
    sort: string;
    dir: number;
    search?: string;
  }) {
    return this.userRepository.getUsersPaginated(params);
  }

  async getTeachers() {
    return this.userRepository.getTeachers();
  }

  async createUser(userData: Partial<IUser>) {
    return this.userRepository.createUser(userData);
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return this.userRepository.removeRoleFromUser(userId, roleId);
  }

  async addRoleToUser(userId: string, roleId: string) {
    await this.userRepository.addRoleToUser(userId, roleId);

    // Get user data
    const user = await this.userRepository.getUserById(userId);

    // roleId is now a role code (ADMIN, PROFESOR, ALUMNO)
    const roleDisplayNames: Record<string, string> = {
      'ADMIN': 'Administrador',
      'PROFESOR': 'Profesor',
      'ALUMNO': 'Alumno'
    };

    const roleName = roleDisplayNames[roleId.toUpperCase()] || roleId;

    if (user) {
      try {
        await sendEmail({
          email: user.email,
          subject: 'Nuevo Rol Asignado - Cursala',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nuevo Rol Asignado</h2>
                <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
                  Hola <strong>${user.firstName || ''}</strong>,
                </p>
                <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
                  Se te ha asignado un nuevo rol: <strong>${roleName}</strong> en el sistema Cursala. Por favor, revisa tus permisos y funciones.
                </p>
                <div style="text-align: center; margin-top: 30px;">
                  <p style="color: #7f8c8d; font-size: 14px;">
                    <strong>Sistema de Notificaciones - Cursala</strong>
                  </p>
                </div>
              </div>
            </div>
            `,
        });
      } catch (emailError) {
        logger.error('Error sending role assignment email', { emailError, userId, roleId });
        // Don't throw the error so role assignment can still work
      }
    }
  }

  async changueStatus(userId: string, status: UserStatus) {
    return this.userRepository.changueStatus(userId, status);
  }

  async toggleUserStatus(userId: string) {
    return this.userRepository.toggleUserStatus(userId);
  }

  async assignCourseToUser(userId: string, courseId: string, startDate: Date, endDate: Date) {
    const result = await this.userRepository.assignCourseToUser(userId, courseId, startDate, endDate);
    // fetch user data
    const user = await this.userRepository.getUserById(userId);
    // fetch course data (may return object or [])
    const course =
      typeof this.courseRepository.findById === 'function' ? await this.courseRepository.findById(courseId) : null;
    let courseName = '';
    if (course && typeof course === 'object' && !Array.isArray(course)) {
      const c = course as { name?: string };
      courseName = c.name || '';
    }

    // Ensure startDate and endDate are Date objects
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    if (user) {
      await sendEmail({
        email: user.email,
        subject: 'Nuevo Curso Asignado - Cursala',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nuevo Curso Asignado</h2>
          <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
            Hola <strong>${user.firstName || ''}</strong>,
          </p>
          <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
            Se te ha asignado el curso <strong>${courseName}</strong> en el sistema Cursala.<br>
            <strong>Fecha de activación:</strong> ${start.toLocaleDateString('es-AR')}<br>
            <strong>Fecha de finalización:</strong> ${end.toLocaleDateString('es-AR')}
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #7f8c8d; font-size: 14px;">
          <strong>Sistema de Notificaciones - Cursala</strong>
            </p>
          </div>
        </div>
          </div>
        `,
      });
    }
    return result;
  }

  async removeCourseFromUser(userId: string, courseId: string) {
    return this.userRepository.removeCourseFromUser(userId, courseId);
  }

  async getAssignedCourses(userId: string) {
    return this.userRepository.getAssignedCourses(userId);
  }

  async getUnassignedCourses(userId: string) {
    return this.userRepository.getUnassignedCourses(userId);
  }

  async isCourseAccessibleForUser(userId: string, courseId: string) {
    return this.userRepository.isCourseAccessibleForUser(userId, courseId);
  }

  async getCourseAccessInfo(userId: string, courseId: string) {
    return this.userRepository.isCourseValidForUser(userId, courseId);
  }

  async deleteUser(userId: string) {
    return this.userRepository.deleteUser(userId);
  }

  async getUserById(userId: string) {
    return this.userRepository.getUserById(userId);
  }

  async assignCourseToUserEdit(userId: string, courseId: string) {
    const result = await this.userRepository.assignCourseToUserEdit(userId, courseId);
    // traer datos de usuario
    const user = await this.userRepository.getUserById(userId);
    // traer datos de curso (puede devolver objeto o [])
    const course = this.courseRepository.findById ? await this.courseRepository.findById(courseId) : null;
    let courseName = '';
    if (course && typeof course === 'object' && !Array.isArray(course)) {
      const c = course as unknown as { name?: string } | null;
      courseName = c?.name ?? '';
    }
    if (user) {
      await sendEmail({
        email: user.email,
        subject: 'Nuevo Curso Asignado como Profesor - Cursala',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nuevo Curso Asignado como Profesor</h2>
          <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
          Hola <strong>${user.firstName || ''}</strong>,
          </p>
          <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
          Se te ha asignado el curso <strong>${courseName}</strong> para que seas el profesor en el sistema Cursala. Por favor, revisa tus cursos asignados y gestiona el contenido correspondientes.
          </p>
          <div style="text-align: center; margin-top: 30px;">
          <p style="color: #7f8c8d; font-size: 14px;">
            <strong>Sistema de Notificaciones - Cursala</strong>
          </p>
          </div>
        </div>
        </div>
      `,
      });
    }
    return result;
  }

  async getAssignedCoursesEdit(userId: string) {
    return this.userRepository.getAssignedCoursesEdit(userId);
  }

  async getUnassignedCoursesEdit(userId: string) {
    return this.userRepository.getUnassignedCoursesEdit(userId);
  }

  async removeCourseFromUserEdit(userId: string, courseId: string) {
    return this.userRepository.removeCourseFromUserEdit(userId, courseId);
  }

  async updateLastConnection(userId: string) {
    return this.userRepository.updateLastConnection(userId);
  }

  async updateUser(userId: string, userData: Partial<IUser>) {
    return this.userRepository.updateUser(userId, userData);
  }

  async getUsersByAssignedCourses(courseId: string) {
    return this.userRepository.getUsersByAssignedCourses(courseId);
  }

  async updateUserData(
    userId: string,
    professionalDescription: string,
    profilePhotoUrl?: string,
    professionalSignatureUrl?: string
  ): Promise<IUserExtended | null> {
    console.log('DEBUG SERVICE: updateUserData called with:', {
      userId,
      professionalDescription: professionalDescription.substring(0, 50) + '...',
      profilePhotoUrl,
      professionalSignatureUrl
    });

    if (!professionalDescription || professionalDescription.trim().length < 100) {
      throw new Error('La descripción profesional debe tener al menos 100 caracteres.');
    }

    // Obtener usuario existente para guardar archivos anteriores
    const existingUser = await this.userRepository.getUserById(userId);
    console.log('DEBUG SERVICE: Usuario existente:', {
      _id: existingUser?._id,
      profilePhotoUrl: existingUser?.profilePhotoUrl,
      professionalSignatureUrl: existingUser?.professionalSignatureUrl
    });

    // Si se proporciona una nueva imagen, obtener la imagen anterior para eliminarla
    let oldImageToDelete: string | null = null;
    if (profilePhotoUrl && existingUser?.profilePhotoUrl) {
      oldImageToDelete = existingUser.profilePhotoUrl;
    }

    // Si se proporciona una nueva firma, obtener la firma anterior para eliminarla
    let oldSignatureToDelete: string | null = null;
    if (professionalSignatureUrl && existingUser?.professionalSignatureUrl) {
      oldSignatureToDelete = existingUser.professionalSignatureUrl || null;
    }

    console.log('DEBUG SERVICE: Archivos a eliminar:', {
      oldImageToDelete,
      oldSignatureToDelete
    });

    // Actualizar los datos del usuario
    const updatedUser = await this.userRepository.updateUserProfessionalData(
      userId,
      professionalDescription.trim(),
      profilePhotoUrl,
      professionalSignatureUrl
    );

    console.log('DEBUG SERVICE: Usuario actualizado por repositorio:', {
      _id: updatedUser?._id,
      profilePhotoUrl: updatedUser?.profilePhotoUrl,
      professionalSignatureUrl: updatedUser?.professionalSignatureUrl
    });

    // Eliminar la imagen anterior solo después de que la actualización sea exitosa
    if (oldImageToDelete && profilePhotoUrl && updatedUser) {
      try {
        deleteOldFile(oldImageToDelete, 'profile-images');
      } catch (error) {
        // Log error silently - image deletion failure shouldn't break the main operation
      }
    }

    // Eliminar la firma anterior solo después de que la actualización sea exitosa
    if (oldSignatureToDelete && professionalSignatureUrl && updatedUser) {
      try {
        deleteOldFile(oldSignatureToDelete, 'signatures');
      } catch (error) {
        // Log error silently - signature deletion failure shouldn't break the main operation
      }
    }

    return updatedUser;
  }

  async getUserProfileImage(imageFileName: string, requestIP?: string): Promise<Buffer | null> {
    try {
      // Validar y sanitizar el nombre del archivo
      const sanitizationResult = this.sanitizeFileName(imageFileName);

      if (!sanitizationResult.isValid || !sanitizationResult.fileName) {
        // Logging de intento de ataque
        logger.warn('Path traversal attempt detected', {
          fileName: imageFileName,
          reason: sanitizationResult.reason,
          ip: requestIP || 'unknown',
          timestamp: new Date().toISOString(),
          severity: 'HIGH',
          category: 'SECURITY',
        });

        throw new Error('Invalid file name');
      }

      const sanitizedFileName = sanitizationResult.fileName;

      // Directorios permitidos
      const allowedDirectories = [
        path.resolve(staticBaseDir, 'profile-images'),
        path.resolve(staticBaseDir, 'signatures'),
      ];

      // Determinar el directorio basado en el prefijo del archivo
      let filePath: string;
      if (sanitizedFileName.startsWith('signature-')) {
        filePath = path.resolve(staticBaseDir, 'signatures', sanitizedFileName);
        console.log('DEBUG SERVICE: Buscando firma en:', filePath);
        console.log('DEBUG SERVICE: Archivo existe:', fs.existsSync(filePath));
        console.log('DEBUG SERVICE: Directorio existe:', fs.existsSync(path.dirname(filePath)));
        try {
          console.log('DEBUG SERVICE: Contenido del directorio:', fs.readdirSync(path.dirname(filePath)));
        } catch (dirError) {
          console.log('DEBUG SERVICE: Error leyendo directorio:', dirError);
        }
        console.log('DEBUG SERVICE: Permisos del directorio:', fs.statSync(path.dirname(filePath)).mode);
        if (fs.existsSync(filePath)) {
          console.log('DEBUG SERVICE: Tamaño del archivo:', fs.statSync(filePath).size);
        }
      } else {
        filePath = path.resolve(staticBaseDir, 'profile-images', sanitizedFileName);
      }

      // Verificar que el archivo está dentro del directorio permitido
      if (!this.isPathInAllowedDirectories(filePath, allowedDirectories)) {
        logger.warn('Directory traversal attempt detected', {
          fileName: imageFileName,
          sanitizedFileName,
          attemptedPath: filePath,
          ip: requestIP || 'unknown',
          timestamp: new Date().toISOString(),
          severity: 'CRITICAL',
          category: 'SECURITY',
        });

        throw new Error('Access denied: Path traversal attempt detected');
      }

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading user image: ${error.message}`);
      }
      throw new Error('Unknown error reading user image');
    }
  }

  /**
   * Sanitiza el nombre del archivo para prevenir path traversal
   * @param fileName Nombre del archivo a sanitizar
   * @returns Objeto con resultado de sanitización
   */
  private sanitizeFileName(fileName: string): { isValid: boolean; fileName?: string; reason?: string } {
    if (!fileName || typeof fileName !== 'string') {
      return { isValid: false, reason: 'Missing or invalid file name type' };
    }

    // Validar que no contenga secuencias de path traversal o caracteres peligrosos
    const dangerousPatterns: Array<{ pattern: RegExp; reason: string }> = [
      { pattern: /\.\./, reason: 'Path traversal sequence (..)' },
      { pattern: /\.\\/, reason: 'Path traversal sequence (.\\)' },
      { pattern: /\/\//, reason: 'Double slash (//)' },
      { pattern: /\\\\/, reason: 'Double backslash (\\\\)' },
      { pattern: /^\/+/, reason: 'Absolute path (starts with /)' },
      { pattern: /^\\+/, reason: 'Absolute path (starts with \\)' },
      { pattern: /:/, reason: 'Colon character (drive letter)' },
      { pattern: /[<>"|?*]/, reason: 'Invalid characters in filename' },
      // eslint-disable-next-line no-control-regex
      { pattern: /\x00/, reason: 'Null byte' },
      { pattern: /\0/, reason: 'Null byte (\\0)' },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(fileName)) {
        return { isValid: false, reason };
      }
    }

    // Validar extensión de archivo permitida
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const extension = path.extname(fileName).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { isValid: false, reason: `Invalid file extension: ${extension || 'none'}` };
    }

    // Extraer solo el nombre base del archivo (sin directorios)
    const baseName = path.basename(fileName);

    return { isValid: true, fileName: baseName };
  }

  /**
   * Verifica que una ruta esté dentro de los directorios permitidos
   * @param filePath Ruta del archivo a verificar
   * @param allowedDirectories Array de directorios permitidos
   * @returns true si la ruta está permitida, false en caso contrario
   */
  private isPathInAllowedDirectories(filePath: string, allowedDirectories: string[]): boolean {
    const resolvedPath = path.resolve(filePath);

    return allowedDirectories.some(allowedDir => {
      const resolvedAllowedDir = path.resolve(allowedDir);
      return resolvedPath.startsWith(resolvedAllowedDir + path.sep) || resolvedPath === resolvedAllowedDir;
    });
  }

  /**
   * Obtiene todos los alumnos asignados a los cursos de un profesor
   * @param teacherId ID del profesor
   * @returns Array de alumnos con información del curso al que están asignados
   */
  async getStudentsByTeacherCourses(teacherId: string) {
    // Primero obtener los cursos del profesor
    const courses = await this.courseRepository.findByTeacherId(teacherId);
    
    if (!courses || courses.length === 0) {
      return [];
    }

    // Extraer los IDs de los cursos
    const courseIds = courses.map(course => new Types.ObjectId(course._id.toString()));

    // Obtener los alumnos de esos cursos
    return this.userRepository.getStudentsByTeacherCourses(courseIds);
  }
}
