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
    this.bunnyService = new BunnyService();
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

      const result = await this.userService.getUsersPaginated({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        sort: (sort as string) || 'createdAt',
        dir: dir === 'ASC' ? 1 : -1,
        search: search as string,
        role: role as string,
      });

      // DEBUG: Log del usuario específico
      const targetUser = result?.data?.find((u: any) => u.email === 'rubilar85@hotmail.com');
      if (targetUser) {
        logger.info('🔍 DEBUG getUsersPaginated - rubilar85@hotmail.com:', {
          _id: targetUser._id,
          email: targetUser.email,
          roles: targetUser.roles,
          rolesType: Array.isArray(targetUser.roles) ? 'Array' : typeof targetUser.roles
        });
      }

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
      logger.error(`❌ Error updating user: ${(error as Error).message}`, { stack: (error as Error).stack });
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
    console.log('🚀 DEBUG: updateUserData endpoint called with userId:', req.params.userId);
    try {
      uploadFiles.fields([
        { name: 'photo', maxCount: 1 },
        { name: 'signatureFile', maxCount: 1 },
      ])(req, res, async (err: unknown) => {
        if (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return res.status(400).json(prepareResponse(400, errorMessage, null));
        }

        try {
          const { userId } = req.params;
          const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

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
          if (req.body.phone) updateData.phone = req.body.phone;
          if (req.body.dni) updateData.dni = req.body.dni;
          if (req.body.birthDate) updateData.birthDate = new Date(req.body.birthDate);
          if (req.body.professionalDescription) updateData.professionalDescription = req.body.professionalDescription;
          if (req.body.roles) updateData.roles = JSON.parse(req.body.roles);

          // Procesar foto de perfil si se proporciona
          let profilePhotoUrl: string | undefined;
          if (files?.photo && files.photo[0]) {
            const photoFile = files.photo[0] as Express.Multer.File;
            
            // Validar tipo de archivo
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(photoFile.mimetype)) {
              // Eliminar archivo temporal
              if (fs.existsSync(photoFile.path)) {
                fs.unlinkSync(photoFile.path);
              }
              return res.status(415).json(
                prepareResponse(415, 'Tipo de archivo no soportado para foto. Solo se permiten PNG, JPG, JPEG', null)
              );
            }

            // Validar tamaño (5MB máximo)
            const maxSize = 5 * 1024 * 1024;
            if (photoFile.size > maxSize) {
              // Eliminar archivo temporal
              if (fs.existsSync(photoFile.path)) {
                fs.unlinkSync(photoFile.path);
              }
              return res.status(413).json(prepareResponse(413, 'Foto demasiado grande. Máximo 5MB', null));
            }
          }

          // Procesar firma si se proporciona
          let professionalSignatureUrl: string | undefined;
          if (files?.signatureFile && files.signatureFile[0]) {
            const signatureFile = files.signatureFile[0] as Express.Multer.File;
            
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(signatureFile.mimetype)) {
              // Eliminar archivos temporales
              if (files.photo?.[0] && fs.existsSync(files.photo[0].path)) {
                fs.unlinkSync(files.photo[0].path);
              }
              if (fs.existsSync(signatureFile.path)) {
                fs.unlinkSync(signatureFile.path);
              }
              return res.status(415).json(
                prepareResponse(415, 'Tipo de archivo no soportado para firma. Solo se permite PNG, JPG, JPEG', null)
              );
            }

            const maxSize = 5 * 1024 * 1024;
            if (signatureFile.size > maxSize) {
              // Eliminar archivos temporales
              if (files.photo?.[0] && fs.existsSync(files.photo[0].path)) {
                fs.unlinkSync(files.photo[0].path);
              }
              if (fs.existsSync(signatureFile.path)) {
                fs.unlinkSync(signatureFile.path);
              }
              return res.status(413).json(prepareResponse(413, 'Firma demasiado grande. Máximo 5MB', null));
            }
          }

          // 1. PRIMERO: Actualizar usuario en base de datos (sin URLs de archivos aún)
          logger.info(`📝 Actualizando usuario en BD: ${userId}`);
          const updatedUser = await this.userService.updateUser(userId, updateData);
          
          if (!updatedUser) {
            // Limpiar archivos temporales si falla
            if (files?.photo?.[0] && fs.existsSync(files.photo[0].path)) {
              fs.unlinkSync(files.photo[0].path);
            }
            if (files?.signatureFile?.[0] && fs.existsSync(files.signatureFile[0].path)) {
              fs.unlinkSync(files.signatureFile[0].path);
            }
            return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
          }

          logger.info(`✅ Usuario actualizado en BD exitosamente`);

          // 2. SEGUNDO: Solo si la BD se actualizó correctamente, subir archivos a Bunny CDN
          try {
            if (files?.photo && files.photo[0]) {
              const photoFile = files.photo[0];
              logger.info(`📤 Subiendo foto a Bunny CDN...`);
              
              const fileBuffer = fs.readFileSync(photoFile.path);
              const fileName = `profile-${existingUser.roles[0]?.toLowerCase()}[${Date.now()}-${Math.floor(Math.random() * 1000000000)}].${photoFile.mimetype.split('/')[1]}`;
              
              profilePhotoUrl = await this.bunnyService.uploadFile(fileBuffer, fileName, 'profile-images');
              logger.info(`✅ Foto subida a Bunny: ${profilePhotoUrl}`);
              
              // Eliminar archivo temporal
              fs.unlinkSync(photoFile.path);
              
              // Actualizar URL en BD
              await this.userService.updateUser(userId, { profilePhotoUrl });
            }

            if (files?.signatureFile && files.signatureFile[0]) {
              const signatureFile = files.signatureFile[0];
              logger.info(`📤 Subiendo firma a Bunny CDN...`);
              
              const fileBuffer = fs.readFileSync(signatureFile.path);
              const fileName = `signature-${existingUser.roles[0]?.toLowerCase()}[${Date.now()}-${Math.floor(Math.random() * 1000000000)}].${signatureFile.mimetype.split('/')[1]}`;
              
              professionalSignatureUrl = await this.bunnyService.uploadFile(fileBuffer, fileName, 'signatures');
              logger.info(`✅ Firma subida a Bunny: ${professionalSignatureUrl}`);
              
              // Eliminar archivo temporal
              fs.unlinkSync(signatureFile.path);
              
              // Actualizar URL en BD
              await this.userService.updateUser(userId, { professionalSignatureUrl });
            }
          } catch (uploadError) {
            logger.error(`❌ Error subiendo archivos a Bunny CDN: ${(uploadError as Error).message}`);
            // La BD ya está actualizada con los datos, pero sin las fotos
            // Podríamos decidir si esto es un error crítico o no
          }

          // 3. Obtener usuario final con todas las actualizaciones
          const finalUser = await this.userService.getUserById(userId);

          return res.json(prepareResponse(200, 'Usuario actualizado correctamente', finalUser));
        } catch (serviceError) {
          const errorMessage = serviceError instanceof Error ? serviceError.message : 'Error interno del servidor';
          logger.error(`❌ Error en updateUserData: ${errorMessage}`);
          return res.status(500).json(prepareResponse(500, errorMessage, null));
        }
      });
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

      // Obtener IP del cliente (considerando proxies)
      const clientIP =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';

      const fileBuffer = await this.userService.getUserProfileImage(imageFileName, clientIP);
      if (!fileBuffer) {
        return res.status(404).json({ message: 'Image not found' });
      }

      // Detectar tipo de archivo por extensión
      const extension = imageFileName.split('.').pop()?.toLowerCase();
      let contentType = 'image/jpeg'; // default

      if (extension === 'png') {
        contentType = 'image/png';
      } else if (extension === 'jpg' || extension === 'jpeg') {
        contentType = 'image/jpeg';
      }

      // Agregar headers de seguridad para CSP
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };
}
