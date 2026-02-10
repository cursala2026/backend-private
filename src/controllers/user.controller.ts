import { NextFunction, Response, Request } from 'express';
import prepareResponse from '../utils/api-response';
import { logger } from '../utils';
import UserService from '@/services/user.service';
import BunnyService from '@/services/bunny.service';
import { UserStatus } from '@/models';
import { IUser } from '@/models/user.model';
import { uploadFiles, uploadDirSignatures } from '@/utils/fileUpload.util';
import fs from 'fs';
import path from 'path';

export default class UserController {
  private bunnyService: BunnyService;
  
  constructor(private readonly userService: UserService) {
    this.bunnyService = BunnyService.getInstance();
  }

  addCountriesToUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, newCountries } = req.body;

      const resp = await this.userService.addCountriesToUser(user, newCountries);
      return res.json(prepareResponse(200, 'Countries added successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.userService.getAllUsers();
      return res.json(prepareResponse(200, 'Users fetched successfully', users));
    } catch (error) {
      return next(error);
    }
  };

  getUsersPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sort, dir, search, role } = req.query;
      const rawCourseId = (req.query.courseId || req.query.course || req.query.course_id) as string | undefined;

      const result = await this.userService.getUsersPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        sort: (sort as string) || 'createdAt',
        dir: dir === 'ASC' ? 1 : -1,
        search: search as string,
        role: role as string,
        courseId: rawCourseId,
      });
      // Logear query y total para depuración desde frontend (sin usar curl)
      try {
        let total: number | null = null;
        if (result && result.pagination && typeof result.pagination.total === 'number') {
          total = result.pagination.total as number;
        } else if (result && typeof (result as any).total === 'number') {
          total = (result as any).total as number;
        }
        logger.debug('GET /api/v1/user - query: %o - pagination.total: %d', req.query, total ?? -1);
      } catch (logErr) {
        logger.warn('Failed to log users pagination result', { err: (logErr as Error).message });
      }

      // Evitar cacheo por parte de clientes/proxies para este endpoint
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json(prepareResponse(200, 'Users fetched successfully', result));
    } catch (error) {
      return next(error);
    }
  };

  getTeachers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teachers = await this.userService.getTeachers();
      return res.json(prepareResponse(200, 'Teachers fetched successfully', teachers));
    } catch (error) {
      return next(error);
    }
  };

  removeRoleFromUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, role } = req.body;

      const resp = await this.userService.removeRoleFromUser(user, role);
      return res.json(prepareResponse(200, 'Role removed successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  addRoleToUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, role } = req.body;

      const resp = await this.userService.addRoleToUser(user, role);
      return res.json(prepareResponse(200, 'Role added successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  changueStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, status } = req.body;

      if (!Object.values(UserStatus).includes(status)) {
        return res.status(400).json(prepareResponse(400, 'Invalid status value', null));
      }

      const resp = await this.userService.changueStatus(userId, status);
      return res.json(prepareResponse(200, 'Status changed successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.toggleUserStatus(userId);
      return res.json(prepareResponse(200, 'Status toggled successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.body;

      const resp = await this.userService.createUser(userData);
      return res.json(prepareResponse(201, 'User created successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  assignCourseToUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId, startDate, endDate } = req.body;

      const resp = await this.userService.assignCourseToUser(userId, courseId, startDate, endDate);
      return res.json(prepareResponse(200, 'Course assigned successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  removeCourseFromUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId } = req.body;

      const resp = await this.userService.removeCourseFromUser(userId, courseId);
      return res.json(prepareResponse(200, 'Course removed successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getAssignedCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.getAssignedCourses(userId);
      return res.json(prepareResponse(200, 'Assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getUnassignedCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.getUnassignedCourses(userId);
      return res.json(prepareResponse(200, 'Unassigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  isCourseAccessibleForUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated', null));
      }

      const resp = await this.userService.isCourseAccessibleForUser(user._id.toString(), courseId);

      // Devolver siempre 200, pero con data indicando si es accesible o no
      return res.json(prepareResponse(200, 'Course accessibility checked', resp));
    } catch (error) {
      return next(error);
    }
  };

  getCourseAccessInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated', null));
      }

      const resp = await this.userService.getCourseAccessInfo(user._id.toString(), courseId);
      return res.json(resp);
    } catch (error) {
      return next(error);
    }
  };


  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      // Obtener usuario antes de eliminarlo para borrar sus archivos de Bunny
      const user = await this.userService.getUserById(userId);
      if (!user) {
        return res.status(404).json(prepareResponse(404, 'Usuario no encontrado'));
      }

      // Eliminar usuario de la base de datos
      const resp = await this.userService.deleteUser(userId);
      
      // Solo si se eliminó correctamente de BD, eliminar archivos de Bunny
      if (resp) {
        // Eliminar foto de perfil si existe
        if (user.profilePhotoUrl && user.profilePhotoUrl.includes('b-cdn.net')) {
          try {
            await this.bunnyService.deleteFile(user.profilePhotoUrl);
            logger.info(`✅ Foto de perfil eliminada de Bunny: ${user.profilePhotoUrl}`);
          } catch (error) {
            logger.error(`❌ Error al eliminar foto de perfil de Bunny: ${(error as Error).message}`);
            // No falla la eliminación del usuario si falla borrar de Bunny
          }
        }

        // Eliminar firma profesional si existe
        if (user.professionalSignatureUrl && user.professionalSignatureUrl.includes('b-cdn.net')) {
          try {
            await this.bunnyService.deleteFile(user.professionalSignatureUrl);
            logger.info(`✅ Firma profesional eliminada de Bunny: ${user.professionalSignatureUrl}`);
          } catch (error) {
            logger.error(`❌ Error al eliminar firma de Bunny: ${(error as Error).message}`);
          }
        }
      }

      return res.json(prepareResponse(200, 'Usuario eliminado exitosamente', resp));
    } catch (error) {
      return next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.getUserById(userId);

      console.log('DEBUG getUserById - Response data:', {
        userId: resp?._id,
        email: resp?.email,
        firstName: resp?.firstName,
        lastName: resp?.lastName,
        profilePhotoUrl: resp?.profilePhotoUrl,
        professionalSignatureUrl: resp?.professionalSignatureUrl,
        hasSignature: !!resp?.professionalSignatureUrl
      });

      return res.json(prepareResponse(200, 'User fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  assignCourseToUserEdit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId } = req.body;

      const resp = await this.userService.assignCourseToUserEdit(userId, courseId);
      return res.json(prepareResponse(200, 'Course assigned successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getAssignedCoursesEdit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.getAssignedCoursesEdit(userId);
      return res.json(prepareResponse(200, 'Assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getUnassignedCoursesEdit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.getUnassignedCoursesEdit(userId);
      return res.json(prepareResponse(200, 'Unassigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  removeCourseFromUserEdit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId } = req.body;

      const resp = await this.userService.removeCourseFromUserEdit(userId, courseId);
      return res.json(prepareResponse(200, 'Course removed successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  updateLastConnection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const resp = await this.userService.updateLastConnection(userId);
      return res.json(prepareResponse(200, 'Last connection updated successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const userData = req.body;

      logger.info(`🔄 Updating user ${userId} with data:`, userData);

      const resp = await this.userService.updateUser(userId, userData);
      
      if (!resp) {
        logger.warn(`⚠️ User ${userId} not found`);
        return res.status(404).json(prepareResponse(404, 'User not found'));
      }

      logger.info(`✅ User ${userId} updated successfully`);
      return res.json(prepareResponse(200, 'User updated successfully', resp));
    } catch (error) {
      const err = error as Error;
      logger.error(`❌ Error updating user: ${err.message}`, { stack: err.stack });
      if (err.message === 'USERNAME_TAKEN') {
        return res.status(400).json(prepareResponse(400, 'El nombre de usuario ya está en uso', null));
      }
      return next(error);
    }
  };

  getUsersByAssignedCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;

      const resp = await this.userService.getUsersByAssignedCourses(courseId);
      return res.json(prepareResponse(200, 'Users by assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getStudentsByTeacherCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { teacherId } = req.params;

      const resp = await this.userService.getStudentsByTeacherCourses(teacherId);
      return res.json(prepareResponse(200, 'Students by teacher courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getAllStudentsFromAllCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resp = await this.userService.getAllStudentsFromAllCourses();
      return res.json(prepareResponse(200, 'All students from all courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  updateUserData = async (req: Request, res: Response, next: NextFunction) => {
    // debug logs removed
    // (Debug logs removed)
    try {
      const processUpdate = async (files: { [fieldname: string]: Express.Multer.File[] } | undefined) => {
        // (Debug logs removed)
        try {
          const { userId } = req.params;

          // Validar que el usuario exista
          const existingUser = await this.userService.getUserById(userId);
          if (!existingUser) {
            return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
          }

          // Preparar datos para actualizar
          const updateData: Partial<IUser> = {};

          // Agregar campos del body si existen
          if (req.body.firstName) updateData.firstName = req.body.firstName;
          if (req.body.lastName) updateData.lastName = req.body.lastName;
          if (req.body.email) updateData.email = req.body.email;
          if (req.body.username) updateData.username = req.body.username;
          if (req.body.phone) updateData.phone = req.body.phone;
          // Permitir borrar el DNI: si el cliente envía el campo `dni` (incluso vacío), aplicar el cambio.
          if (Object.prototype.hasOwnProperty.call(req.body, 'dni')) {
            updateData.dni = req.body.dni === '' ? null : req.body.dni;
          }
          if (req.body.birthDate) updateData.birthDate = new Date(req.body.birthDate);
          if (req.body.professionalDescription) updateData.professionalDescription = req.body.professionalDescription;
          if (req.body.roles) {
            try {
              updateData.roles = typeof req.body.roles === 'string' ? JSON.parse(req.body.roles) : req.body.roles;
            } catch {
              // ignore invalid roles payload
            }
          }

          // Validaciones y tamaño/tipo de archivos solo si se enviaron
          let profilePhotoUrl: string | undefined;
          if (files?.photo && files.photo[0]) {
            const photoFile = files.photo[0] as Express.Multer.File;
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(photoFile.mimetype)) {
              if (fs.existsSync(photoFile.path)) fs.unlinkSync(photoFile.path);
              return res.status(415).json(
                prepareResponse(415, 'Tipo de archivo no soportado para foto. Solo se permiten PNG, JPG, JPEG', null)
              );
            }
            const maxSize = 25 * 1024 * 1024;
            if (photoFile.size > maxSize) {
              if (fs.existsSync(photoFile.path)) fs.unlinkSync(photoFile.path);
              return res.status(413).json(prepareResponse(413, 'Foto demasiado grande. Máximo 25MB', null));
            }
          }

          let professionalSignatureUrl: string | undefined;
          if (files?.signatureFile && files.signatureFile[0]) {
            const signatureFile = files.signatureFile[0] as Express.Multer.File;
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(signatureFile.mimetype)) {
              if (files.photo?.[0] && fs.existsSync(files.photo[0].path)) fs.unlinkSync(files.photo[0].path);
              if (fs.existsSync(signatureFile.path)) fs.unlinkSync(signatureFile.path);
              return res.status(415).json(
                prepareResponse(415, 'Tipo de archivo no soportado para firma. Solo se permite PNG, JPG, JPEG', null)
              );
            }
            const maxSize = 25 * 1024 * 1024;
            if (signatureFile.size > maxSize) {
              if (files.photo?.[0] && fs.existsSync(files.photo[0].path)) fs.unlinkSync(files.photo[0].path);
              if (fs.existsSync(signatureFile.path)) fs.unlinkSync(signatureFile.path);
              return res.status(413).json(prepareResponse(413, 'Firma demasiado grande. Máximo 25MB', null));
            }
          }

          // 1. PRIMERO: Actualizar usuario en base de datos (sin URLs de archivos aún)
          logger.info(`📝 Actualizando usuario en BD: ${userId}`);
          const updatedUser = await this.userService.updateUser(userId, updateData);

          if (!updatedUser) {
            if (files?.photo?.[0] && fs.existsSync(files.photo[0].path)) fs.unlinkSync(files.photo[0].path);
            if (files?.signatureFile?.[0] && fs.existsSync(files.signatureFile[0].path)) fs.unlinkSync(files.signatureFile[0].path);
            return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
          }

          logger.info(`✅ Usuario actualizado en BD exitosamente`);

          // 2. SUBIR archivos solo si existen
          try {
            if (files?.photo && files.photo[0]) {
              const photoFile = files.photo[0];
              const fileBuffer = fs.readFileSync(photoFile.path);
              // Preserve original filename for profile photo
              profilePhotoUrl = await this.bunnyService.uploadFilePreserveOriginal(fileBuffer, photoFile.originalname, 'profile-images');
              fs.unlinkSync(photoFile.path);
              await this.userService.updateUser(userId, { profilePhotoUrl });
            }

            if (files?.signatureFile && files.signatureFile[0]) {
              const signatureFile = files.signatureFile[0];
              const fileBuffer = fs.readFileSync(signatureFile.path);
              professionalSignatureUrl = await this.bunnyService.uploadFilePreserveOriginal(fileBuffer, signatureFile.originalname, 'signatures');
              fs.unlinkSync(signatureFile.path);
              await this.userService.updateUser(userId, { professionalSignatureUrl });
            }
          } catch (uploadError) {
            logger.error(`❌ Error subiendo archivos a Bunny CDN: ${(uploadError as Error).message}`);
          }

          const finalUser = await this.userService.getUserById(userId);
          // (Debug log removed)
          return res.json(prepareResponse(200, 'Usuario actualizado correctamente', finalUser));
        } catch (serviceError) {
          const err = serviceError as Error;
          const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor';
          logger.error(`❌ Error en updateUserData: ${errorMessage}`);
          if (errorMessage === 'USERNAME_TAKEN') {
            return res.status(400).json(prepareResponse(400, 'El nombre de usuario ya está en uso', null));
          }
          return res.status(500).json(prepareResponse(500, errorMessage, null));
        }
      };

      // Si es multipart/form-data, dejar que multer procese archivos y body
      if (req.is('multipart/form-data')) {
        uploadFiles.fields([
          { name: 'photo', maxCount: 1 },
          { name: 'signatureFile', maxCount: 1 },
        ])(req, res, async (err: unknown) => {
          if (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return res.status(400).json(prepareResponse(400, errorMessage, null));
          }
          const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
          await processUpdate(files);
        });
      } else {
        // No es multipart: procesar directamente (sin archivos)
        await processUpdate(undefined);
      }
    } catch (error) {
      return next(error);
    }
  };

  // Endpoint de prueba simple
  testEndpoint = async (req: Request, res: Response, next: NextFunction) => {
    console.log('🧪 TEST ENDPOINT: Se ejecutó el endpoint de prueba');
    console.log('🧪 TEST ENDPOINT: Timestamp:', new Date().toISOString());
    console.log('🧪 TEST ENDPOINT: User-Agent:', req.headers['user-agent']);
    return res.json({ 
      message: 'Test endpoint working', 
      timestamp: new Date().toISOString(),
      logs: 'Check server console for debug messages'
    });
  };

  // Endpoint de diagnóstico temporal
  debugGetUserData = async (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 DEBUG: debugGetUserData called');
    try {
      const { userId } = req.params;
      console.log('🔍 DEBUG: userId received:', userId);
      const user = await this.userService.getUserById(userId);
      console.log('🔍 DEBUG: user found:', !!user);

      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const userSafe = user as unknown as { profilePhotoUrl?: string; professionalSignatureUrl?: string; professionalDescription?: string };
      const debugData = {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: userSafe.profilePhotoUrl,
        professionalSignatureUrl: userSafe.professionalSignatureUrl,
        professionalDescription: userSafe.professionalDescription ? 'Sí tiene' : 'No tiene',
      };

      console.log('🔍 DEBUG: debugData to return:', debugData);
      return res.json(debugData);
    } catch (error) {
      console.log('🔍 DEBUG: error in debugGetUserData:', error);
      return next(error);
    }
  };

  getUserProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageFileName } = req.params;
      if (!imageFileName) {
        return res.status(400).json(prepareResponse(400, 'Image file name required', null));
      }

      const fileBuffer = await this.userService.getUserProfileImage(imageFileName, req.ip);
      if (!fileBuffer) {
        return res.status(404).json(prepareResponse(404, 'Image not found', null));
      }

      const ext = path.extname(imageFileName).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      return res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };
}
