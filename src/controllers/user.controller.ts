import { NextFunction, Response, Request } from 'express';
import prepareResponse from '../utils/api-response';
import UserService from '@/services/user.service';
import { UserStatus } from '@/models';
import { IUser } from '@/models/user.model';
import { uploadFiles, uploadDirSignatures } from '@/utils/fileUpload.util';
import fs from 'fs';
import path from 'path';

export default class UserController {
  constructor(private readonly userService: UserService) { }

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

      const resp = await this.userService.deleteUser(userId);
      return res.json(prepareResponse(200, 'User deleted successfully', resp));
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

      const resp = await this.userService.updateUser(userId, userData);
      return res.json(prepareResponse(200, 'User updated successfully', resp));
    } catch (error) {
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
          const { professionalDescription } = req.body;
          const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

          // Validar que el usuario exista
          const existingUser = await this.userService.getUserById(userId);
          if (!existingUser) {
            return res.status(404).json(prepareResponse(404, 'Usuario no encontrado', null));
          }

          // Validar descripción profesional
          if (!professionalDescription || professionalDescription.trim().length < 100) {
            return res
              .status(400)
              .json(prepareResponse(400, 'La descripción profesional debe tener al menos 100 caracteres', null));
          }

          // Procesar archivo de foto de perfil si se proporciona
          let profilePhotoUrl: string | undefined;
          if (files?.photo && files.photo[0]) {
            const photoFile = files.photo[0] as Express.Multer.File;
            // Validar tipo de archivo
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(photoFile.mimetype)) {
              return res
                .status(415)
                .json(
                  prepareResponse(415, 'Tipo de archivo no soportado para foto. Solo se permiten PNG, JPG, JPEG', null)
                );
            }

            // Validar tamaño (5MB máximo)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (photoFile.size > maxSize) {
              return res.status(413).json(prepareResponse(413, 'Foto demasiado grande. Máximo 5MB', null));
            }

            // Generar URL de la imagen
            profilePhotoUrl = `${photoFile.filename}`;
          }

          // Procesar archivo de firma si se proporciona
          let professionalSignatureUrl: string | undefined;
          if (files?.signatureFile && files.signatureFile[0]) {
            const signatureFile = files.signatureFile[0] as Express.Multer.File;
            console.log('DEBUG: Procesando archivo de firma:', {
              filename: signatureFile.filename,
              originalname: signatureFile.originalname,
              mimetype: signatureFile.mimetype,
              size: signatureFile.size
            });
            
            // Validar tipo de archivo (solo PNG, JPG, JPEG)
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(signatureFile.mimetype)) {
              return res
                .status(415)
                .json(prepareResponse(415, 'Tipo de archivo no soportado para firma. Solo se permite PNG, JPG, JPEG', null));
            }

            // Validar tamaño (5MB máximo)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (signatureFile.size > maxSize) {
              return res.status(413).json(prepareResponse(413, 'Firma demasiado grande. Máximo 5MB', null));
            }

            // Generar URL de la firma
            professionalSignatureUrl = `${signatureFile.filename}`;
            console.log('DEBUG: URL de firma generada:', professionalSignatureUrl);
            console.log('DEBUG: Archivo guardado en path:', signatureFile.path);
            console.log('DEBUG: Verificando si archivo existe:', fs.existsSync(signatureFile.path));
            console.log('DEBUG: Directorio de firmas:', uploadDirSignatures);
          } else {
            console.log('DEBUG: No se recibió archivo de firma');
          }

          // Verificar si el usuario quiere eliminar la foto o firma
          // Si no se proporciona archivo pero había uno antes, mantenerlo
          // Si se quiere eliminar, el frontend debe enviar un campo especial
          const clearPhoto = req.body.clearPhoto === 'true';
          const clearSignature = req.body.clearSignature === 'true';

          if (clearPhoto) {
            profilePhotoUrl = '';
          }

          if (clearSignature) {
            professionalSignatureUrl = '';
          }

          console.log('DEBUG: Valores finales antes de actualizar:', {
            profilePhotoUrl,
            professionalSignatureUrl,
            clearPhoto,
            clearSignature
          });

          // Actualizar datos del usuario
          const updatedUser = await this.userService.updateUserData(
            userId,
            professionalDescription,
            profilePhotoUrl,
            professionalSignatureUrl
          );

          console.log('DEBUG: Usuario actualizado:', {
            _id: updatedUser?._id,
            profilePhotoUrl: updatedUser?.profilePhotoUrl,
            professionalSignatureUrl: updatedUser?.professionalSignatureUrl
          });

          const responseData = {
            userId: updatedUser?._id?.toString(),
            professionalDescription: updatedUser?.professionalDescription,
            photoUrl: updatedUser?.profilePhotoUrl,
            signatureUrl: updatedUser?.professionalSignatureUrl,
          };

          console.log('DEBUG: Datos de respuesta:', responseData);

          return res.json(prepareResponse(200, 'Datos del usuario actualizados correctamente', responseData));
        } catch (serviceError) {
          const errorMessage = serviceError instanceof Error ? serviceError.message : 'Error interno del servidor';
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
