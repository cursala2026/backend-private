import { Request, Response, NextFunction } from 'express';
import prepareResponse from '../utils/api-response';
import { logger } from '../utils';
import UserService from '@/services/user.service';
import BunnyService from '@/services/bunny.service';
import { UserStatus } from '@/models';
import { IUser } from '@/models/user.model';
import { uploadFiles } from '@/utils/fileUpload.util';
import fs from 'fs';
import path from 'path';
import { ensureString } from '@/utils/type-guards';

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
      const userId = ensureString(req.params.userId);

      if (!userId) {
        return res.status(400).json(prepareResponse(400, 'ID de usuario requerido'));
      }

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
      const userId = ensureString(req.params.userId);
      const resp = await this.userService.getAssignedCourses(userId);
      return res.json(prepareResponse(200, 'Assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getUnassignedCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureString(req.params.userId);
      const resp = await this.userService.getUnassignedCourses(userId);
      return res.json(prepareResponse(200, 'Unassigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  isCourseAccessibleForUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated', null));
      }

      const resp = await this.userService.isCourseAccessibleForUser(user._id.toString(), courseId);
      return res.json(prepareResponse(200, 'Course accessibility checked', resp));
    } catch (error) {
      return next(error);
    }
  };

  getCourseAccessInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
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
      const userId = ensureString(req.params.userId);

      const user = await this.userService.getUserById(userId);
      if (!user) {
        return res.status(404).json(prepareResponse(404, 'Usuario no encontrado'));
      }

      const resp = await this.userService.deleteUser(userId);

      if (resp) {
        await this.deleteBunnyFiles(user);
      }

      return res.json(prepareResponse(200, 'Usuario eliminado exitosamente', resp));
    } catch (error) {
      return next(error);
    }
  };

  deleteSelfProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;

      if (!user) {
        return res.status(401).json(prepareResponse(401, 'No autorizado'));
      }

      const userId = user._id.toString();
      const resp = await this.userService.deleteUser(userId);

      if (resp) {
        await this.deleteBunnyFiles(user);
      }

      return res.json(prepareResponse(200, 'Tu cuenta ha sido eliminada exitosamente', resp));
    } catch (error) {
      return next(error);
    }
  };

  // FIX: Extracted shared Bunny cleanup logic used by deleteUser and deleteSelfProfile
  private deleteBunnyFiles = async (user: IUser): Promise<void> => {
    const isBunnyCdn = (url?: string | null): url is string =>
      typeof url === 'string' && url.includes('b-cdn.net');

    if (isBunnyCdn(user.profilePhotoUrl)) {
      try {
        await this.bunnyService.deleteFile(user.profilePhotoUrl);
        logger.info(`✅ Foto de perfil eliminada de Bunny: ${user.profilePhotoUrl}`);
      } catch (error) {
        logger.error(`❌ Error al eliminar foto de perfil de Bunny: ${(error as Error).message}`);
      }
    }

    if (isBunnyCdn(user.professionalSignatureUrl)) {
      try {
        await this.bunnyService.deleteFile(user.professionalSignatureUrl);
        logger.info(`✅ Firma profesional eliminada de Bunny: ${user.professionalSignatureUrl}`);
      } catch (error) {
        logger.error(`❌ Error al eliminar firma de Bunny: ${(error as Error).message}`);
      }
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureString(req.params.userId);
      const user = await this.userService.getUserById(ensureString(userId));

      if (!user) {
        return res.status(404).json(prepareResponse(404, 'Usuario no encontrado'));
      }

      // FIX: Removed console.log with sensitive user data
      return res.json(prepareResponse(200, 'User fetched successfully', user));
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
      const userId = ensureString(req.params.userId);
      const resp = await this.userService.getAssignedCoursesEdit(userId);
      return res.json(prepareResponse(200, 'Assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getUnassignedCoursesEdit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureString(req.params.userId);
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
      const userId = ensureString(req.params.userId);
      const resp = await this.userService.updateLastConnection(userId);
      return res.json(prepareResponse(200, 'Last connection updated successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureString(req.params.userId);
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
      const courseId = ensureString(req.params.courseId);
      const resp = await this.userService.getUsersByAssignedCourses(courseId);
      return res.json(prepareResponse(200, 'Users by assigned courses fetched successfully', resp));
    } catch (error) {
      return next(error);
    }
  };

  getStudentsByTeacherCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teacherId = ensureString(req.params.teacherId);
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
    try {
      // FIX: Extracted inner logic — no more nested async function inside try
      const handleUpdate = async (files: { [fieldname: string]: Express.Multer.File[] } | undefined) => {
        const userId = ensureString(req.params.userId);

        const existingUser = await this.userService.getUserById(userId);
        if (!existingUser) {
          return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
        }

        const updateData: Partial<IUser> = {};

        if (req.body.firstName) updateData.firstName = req.body.firstName;
        if (req.body.lastName) updateData.lastName = req.body.lastName;
        if (req.body.email) updateData.email = req.body.email;
        if (req.body.username) updateData.username = req.body.username;
        if (req.body.phone) updateData.phone = req.body.phone;

        if (Object.prototype.hasOwnProperty.call(req.body, 'dni')) {
          updateData.dni = req.body.dni === '' ? null : req.body.dni;
        }

        if (req.body.birthDate) updateData.birthDate = new Date(req.body.birthDate);
        if (req.body.professionalDescription) updateData.professionalDescription = req.body.professionalDescription;

        if (req.body.roles) {
          try {
            updateData.roles = typeof req.body.roles === 'string'
              ? JSON.parse(req.body.roles)
              : req.body.roles;
          } catch {
            // ignore invalid roles payload
          }
        }

        // Validate files before touching the DB
        const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
        const MAX_FILE_SIZE = 25 * 1024 * 1024;

        const cleanupFiles = (...filePaths: (string | undefined)[]) => {
          for (const p of filePaths) {
            if (p && fs.existsSync(p)) fs.unlinkSync(p);
          }
        };

        if (files?.photo?.[0]) {
          const photoFile = files.photo[0];
          if (!ALLOWED_IMAGE_TYPES.includes(photoFile.mimetype)) {
            cleanupFiles(photoFile.path);
            return res.status(415).json(prepareResponse(415, 'Tipo de archivo no soportado para foto. Solo se permiten PNG, JPG, JPEG', null));
          }
          if (photoFile.size > MAX_FILE_SIZE) {
            cleanupFiles(photoFile.path);
            return res.status(413).json(prepareResponse(413, 'Foto demasiado grande. Máximo 25MB', null));
          }
        }

        if (files?.signatureFile?.[0]) {
          const signatureFile = files.signatureFile[0];
          if (!ALLOWED_IMAGE_TYPES.includes(signatureFile.mimetype)) {
            cleanupFiles(files.photo?.[0]?.path, signatureFile.path);
            return res.status(415).json(prepareResponse(415, 'Tipo de archivo no soportado para firma. Solo se permite PNG, JPG, JPEG', null));
          }
          if (signatureFile.size > MAX_FILE_SIZE) {
            cleanupFiles(files.photo?.[0]?.path, signatureFile.path);
            return res.status(413).json(prepareResponse(413, 'Firma demasiado grande. Máximo 25MB', null));
          }
        }

        // Update base user fields first
        logger.info(`📝 Actualizando usuario en BD: ${userId}`);
        const updatedUser = await this.userService.updateUser(userId, updateData);

        if (!updatedUser) {
          cleanupFiles(files?.photo?.[0]?.path, files?.signatureFile?.[0]?.path);
          return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
        }

        logger.info(`✅ Usuario actualizado en BD exitosamente`);

        // Upload files to Bunny CDN if present
        try {
          if (files?.photo?.[0]) {
            const photoFile = files.photo[0];
            const fileBuffer = fs.readFileSync(photoFile.path);
            const profilePhotoUrl = await this.bunnyService.uploadFilePreserveOriginal(fileBuffer, photoFile.originalname, 'profile-images');
            fs.unlinkSync(photoFile.path);
            await this.userService.updateUser(userId, { profilePhotoUrl });
          }

          if (files?.signatureFile?.[0]) {
            const signatureFile = files.signatureFile[0];
            const fileBuffer = fs.readFileSync(signatureFile.path);
            const professionalSignatureUrl = await this.bunnyService.uploadFilePreserveOriginal(fileBuffer, signatureFile.originalname, 'signatures');
            fs.unlinkSync(signatureFile.path);
            await this.userService.updateUser(userId, { professionalSignatureUrl });
          }
        } catch (uploadError) {
          logger.error(`❌ Error subiendo archivos a Bunny CDN: ${(uploadError as Error).message}`);
          // FIX: Upload failure is non-fatal but we still log it clearly
        }

        const finalUser = await this.userService.getUserById(userId);
        return res.json(prepareResponse(200, 'Usuario actualizado correctamente', finalUser));
      };

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

          try {
            await handleUpdate(files);
          } catch (serviceError) {
            const err = serviceError as Error;
            if (err.message === 'USERNAME_TAKEN') {
              return res.status(400).json(prepareResponse(400, 'El nombre de usuario ya está en uso', null));
            }
            logger.error(`❌ Error en updateUserData: ${err.message}`);
            return res.status(500).json(prepareResponse(500, err.message || 'Error interno del servidor', null));
          }
        });
      } else {
        await handleUpdate(undefined);
      }
    } catch (error) {
      return next(error);
    }
  };

  getUserProfileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageFileName = ensureString(req.query.imageFileName);
      if (!imageFileName) {
        return res.status(400).json(prepareResponse(400, 'Image file name required', null));
      }

      const fileBuffer = await this.userService.getUserProfileImage(imageFileName, req.ip);
      if (!fileBuffer) {
        return res.status(404).json(prepareResponse(404, 'Image not found', null));
      }

      const ext = path.extname(imageFileName).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
      };
      const contentType = contentTypeMap[ext] ?? 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      return res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };
  getUsersPaginated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(ensureString(req.query.page) || '1', 10);
    const limit = parseInt(ensureString(req.query.limit) || '10', 10);
    const sort = ensureString(req.query.sort) || 'createdAt';
    const dir = ensureString(req.query.dir) === 'ASC' ? 1 : -1;
    const courseId = ensureString(req.query.courseId) || undefined;

    const resp = await this.userService.getUsersPaginated({
      page,
      limit,
      sort,
      dir,
      courseId: courseId === 'none' ? undefined : courseId,
    });

    return res.json(prepareResponse(200, 'Users fetched successfully', resp));
  } catch (error) {
    return next(error);
  }
};
  saveUserInterests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureString(req.params.userId);
      const { interests, interestsSuggestions } = req.body;

      // Auditoría: Verificamos que no venga vacío
      if (!interests && !interestsSuggestions) {
        return res.status(400).json(prepareResponse(400, 'Datos insuficientes', null));
      }

      const updateData = {
        interests: interests || [],
        interestsSuggestions: interestsSuggestions || '',
        hasCompletedInterestsForm: true 
      };

      logger.info(`📝 Usuario ${userId} completando formulario de intereses`);
      
      const updatedUser = await this.userService.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json(prepareResponse(404, 'Usuario no encontrado'));
      }

      return res.json(prepareResponse(200, 'Intereses registrados con éxito', updatedUser));
    } catch (error) {
      return next(error);
    }
  };
}