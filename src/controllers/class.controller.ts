import { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { logger, prepareResponse } from '../utils';
import ClassService from '@/services/class.service';
import CourseService from '@/services/course.service';
import { IClassData } from '@/models';
import {
  uploadDirImages,
  uploadDirVideos,
  uploadDirSupportMaterials,
} from '@/services/upload.config';
import { fileUploadService } from '@/services/file-upload.service';
import BunnyService from '@/services/bunny.service';

// Re-exportar para mantener compatibilidad con rutas existentes
export { uploadFiles, uploadChunkMulter } from '@/services/file-upload.service';

export default class ClassController {
  private readonly bunnyService: BunnyService;

  constructor(
    private readonly classService: ClassService,
    private readonly courseService?: CourseService
  ) {
    this.bunnyService = new BunnyService();
  }

  // Delegar operaciones de chunks a FileUploadService
  uploadChunk = (req: Request, res: Response, next: NextFunction) =>
    fileUploadService.processChunk(req, res, next);

  finalizeUpload = async (req: Request, res: Response) => {
    const { uploadId, fileName, fieldName } = req.body;
    if (!uploadId || !fileName || !fieldName) {
      return res.status(400).json({
        message: 'Faltan parámetros requeridos: uploadId, fileName, fieldName',
      });
    }
    const result = await fileUploadService.finalizeChunks(uploadId, fileName, fieldName);
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  };

  cleanupChunks = async (req: Request, res: Response) => {
    const { uploadId } = req.params;
    if (!uploadId) {
      return res.status(400).json({ message: 'uploadId es requerido' });
    }
    const result = fileUploadService.cleanupChunks(uploadId);
    return res.json(result);
  };

  // Método privado para encontrar archivos ensamblados
  private findAssembledFile = (uploadId: string, directory: string) =>
    fileUploadService.findAssembledFile(uploadId, directory);

  findOneById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const classData = await this.classService.findOneById(classId);
      if (!classData) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }
      return res.json(prepareResponse(200, 'Class fetched successfully', classData));
    } catch (error) {
      return next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    console.log('Controller Service ID:', (fileUploadService as any)._id);
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const { name, description, courseId, linkLive, imageFileId, videoFileId, supportMaterialIds } = req.body;

      logger.info('Creando nueva clase');

      if (!name || !description || !courseId) {
        return res.status(400).json({ message: 'Faltan campos requeridos: name, description o courseId.' });
      }

      if (!files?.imageFile && !imageFileId) {
        return res.status(400).json({ message: 'Se requiere una imagen.' });
      }

      // Resolver archivos usando el servicio
      const resolvedFiles = fileUploadService.resolveClassFiles(files, imageFileId, videoFileId, supportMaterialIds);

      let { imageUrl, videoUrl, supportMaterials, errors, uploadIdsToClean } = resolvedFiles;

      if (errors.length > 0) {
        return res.status(400).json({ message: errors[0] });
      }

      // Subir imagen a Bunny Storage si existe
      if (imageUrl) {
        try {
          const localImagePath = path.join(uploadDirImages, imageUrl);
          const imageBuffer = fs.readFileSync(localImagePath);
          const uniqueFileName = this.bunnyService.generateUniqueFileName(imageUrl, 'class');

          logger.info(`🐰 Subiendo imagen a Bunny: ${uniqueFileName}`);
          const bunnyUrl = await this.bunnyService.uploadFile(imageBuffer, uniqueFileName, 'class-images');

          // Eliminar archivo local después de subir a Bunny
          fs.unlinkSync(localImagePath);

          // Reemplazar imageUrl con la URL de Bunny
          imageUrl = bunnyUrl;
          logger.info(`✅ Imagen subida a Bunny exitosamente: ${bunnyUrl}`);
        } catch (error) {
          logger.error(`❌ Error subiendo imagen a Bunny: ${(error as Error).message}`);
          return res.status(500).json({ message: 'Error subiendo imagen a Bunny Storage' });
        }
      }

      // Subir video a Bunny Storage si existe
      if (videoUrl) {
        try {
          const localVideoPath = path.join(uploadDirVideos, videoUrl);
          const videoStats = fs.statSync(localVideoPath);
          const videoSizeMB = videoStats.size / (1024 * 1024);
          const uniqueFileName = this.bunnyService.generateUniqueFileName(videoUrl, 'class-video');

          logger.info(`🐰 Subiendo video a Bunny (${videoSizeMB.toFixed(2)} MB): ${uniqueFileName}`);

          // Para videos mayores a 100MB, usar streaming para evitar cargar todo en memoria
          let bunnyUrl: string;
          if (videoStats.size > 100 * 1024 * 1024) {
            logger.info('📹 Usando streaming para video grande');
            const videoStream = fs.createReadStream(localVideoPath);
            bunnyUrl = await this.bunnyService.uploadFileStream(videoStream, uniqueFileName, 'class-videos', videoStats.size);
          } else {
            const videoBuffer = fs.readFileSync(localVideoPath);
            bunnyUrl = await this.bunnyService.uploadFile(videoBuffer, uniqueFileName, 'class-videos');
          }

          // Eliminar archivo local después de subir a Bunny
          fs.unlinkSync(localVideoPath);

          // Reemplazar videoUrl con la URL de Bunny
          videoUrl = bunnyUrl;
          logger.info(`✅ Video subido a Bunny exitosamente: ${bunnyUrl}`);
        } catch (error) {
          logger.error(`❌ Error subiendo video a Bunny: ${(error as Error).message}`);
          return res.status(500).json({ message: 'Error subiendo video a Bunny Storage' });
        }
      }

      // Construir datos de clase
      const classData: Partial<IClassData> = {
        name,
        description,
        imageUrl,
        courseId,
        supportMaterials,
      };

      if (videoUrl) {
        classData.videoUrl = videoUrl;
      }

      if (linkLive !== undefined) {
        classData.linkLive = linkLive;
      }

      logger.info('Datos para crear clase:', { name, imageUrl, videoUrl, supportMaterialsCount: supportMaterials.length });

      const newClass = await this.classService.create(classData);

      // Limpiar mapeo después de usar
      fileUploadService.cleanupAssembledFilesMappings(uploadIdsToClean);

      return res.json(prepareResponse(201, 'Clase creada exitosamente', newClass));
    } catch (error) {
      logger.error(`Error en create class: ${(error as Error).message}`);
      return next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;

      const existingClass = await this.classService.findOneById(classId);
      if (!existingClass) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const {
        name,
        description,
        linkLive,
        imageFileId,
        videoFileId,
        supportMaterialIds,
        deleteCurrentImage,
        deleteCurrentVideo,
        deleteCurrentSupportMaterials,
      } = req.body;

      logger.info('Actualizando clase');

      // Parsear materiales a eliminar
      let materialsToDelete: string[] = [];
      if (deleteCurrentSupportMaterials) {
        try {
          materialsToDelete = JSON.parse(deleteCurrentSupportMaterials);
        } catch (e) {
          logger.warn('Error parseando deleteCurrentSupportMaterials');
        }
      }

      // Resolver archivos usando el servicio
      let { imageUrl, videoUrl, supportMaterials, filesToDelete, uploadIdsToClean } =
        fileUploadService.resolveClassFilesForUpdate(
          files,
          imageFileId,
          videoFileId,
          supportMaterialIds,
          existingClass.imageUrl,
          existingClass.videoUrl,
          existingClass.supportMaterials,
          deleteCurrentImage === 'true',
          deleteCurrentVideo === 'true',
          materialsToDelete
        );

      // Subir nueva imagen a Bunny Storage si existe y es diferente a la anterior
      if (imageUrl && imageUrl !== existingClass.imageUrl) {
        try {
          // Si existe una imagen anterior en Bunny, eliminarla
          if (existingClass.imageUrl && this.bunnyService.isBunnyCdnUrl(existingClass.imageUrl)) {
            logger.info(`🗑️ Eliminando imagen anterior de Bunny: ${existingClass.imageUrl}`);
            await this.bunnyService.deleteFile(existingClass.imageUrl);
          }

          // Subir nueva imagen a Bunny
          const localImagePath = path.join(uploadDirImages, imageUrl);
          const imageBuffer = fs.readFileSync(localImagePath);
          const uniqueFileName = this.bunnyService.generateUniqueFileName(imageUrl, 'class');

          logger.info(`🐰 Subiendo nueva imagen a Bunny: ${uniqueFileName}`);
          const bunnyUrl = await this.bunnyService.uploadFile(imageBuffer, uniqueFileName, 'class-images');

          // Eliminar archivo local después de subir a Bunny
          fs.unlinkSync(localImagePath);

          // Reemplazar imageUrl con la URL de Bunny
          imageUrl = bunnyUrl;
          logger.info(`✅ Imagen actualizada en Bunny exitosamente: ${bunnyUrl}`);
        } catch (error) {
          logger.error(`❌ Error actualizando imagen en Bunny: ${(error as Error).message}`);
          return res.status(500).json({ message: 'Error actualizando imagen en Bunny Storage' });
        }
      }

      // Subir nuevo video a Bunny Storage si existe y es diferente al anterior
      if (videoUrl && videoUrl !== existingClass.videoUrl) {
        try {
          // Si existe un video anterior en Bunny, eliminarlo
          if (existingClass.videoUrl && this.bunnyService.isBunnyCdnUrl(existingClass.videoUrl)) {
            logger.info(`🗑️ Eliminando video anterior de Bunny: ${existingClass.videoUrl}`);
            await this.bunnyService.deleteFile(existingClass.videoUrl);
          }

          // Subir nuevo video a Bunny
          const localVideoPath = path.join(uploadDirVideos, videoUrl);
          const videoStats = fs.statSync(localVideoPath);
          const videoSizeMB = videoStats.size / (1024 * 1024);
          const uniqueFileName = this.bunnyService.generateUniqueFileName(videoUrl, 'class-video');

          logger.info(`🐰 Subiendo nuevo video a Bunny (${videoSizeMB.toFixed(2)} MB): ${uniqueFileName}`);

          // Para videos mayores a 100MB, usar streaming para evitar cargar todo en memoria
          let bunnyUrl: string;
          if (videoStats.size > 100 * 1024 * 1024) {
            logger.info('📹 Usando streaming para video grande');
            const videoStream = fs.createReadStream(localVideoPath);
            bunnyUrl = await this.bunnyService.uploadFileStream(videoStream, uniqueFileName, 'class-videos', videoStats.size);
          } else {
            const videoBuffer = fs.readFileSync(localVideoPath);
            bunnyUrl = await this.bunnyService.uploadFile(videoBuffer, uniqueFileName, 'class-videos');
          }

          // Eliminar archivo local después de subir a Bunny
          fs.unlinkSync(localVideoPath);

          // Reemplazar videoUrl con la URL de Bunny
          videoUrl = bunnyUrl;
          logger.info(`✅ Video actualizado en Bunny exitosamente: ${bunnyUrl}`);
        } catch (error) {
          logger.error(`❌ Error actualizando video en Bunny: ${(error as Error).message}`);
          return res.status(500).json({ message: 'Error actualizando video en Bunny Storage' });
        }
      }

      // Construir datos de actualización
      const updateData: Partial<IClassData> = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (linkLive !== undefined) updateData.linkLive = linkLive;

      // Solo actualizar URLs si cambiaron
      if (imageUrl !== existingClass.imageUrl) {
        updateData.imageUrl = imageUrl;
      }
      if (videoUrl !== existingClass.videoUrl) {
        updateData.videoUrl = videoUrl;
      }
      if (supportMaterials.join(',') !== (existingClass.supportMaterials || []).join(',')) {
        updateData.supportMaterials = supportMaterials;
      }

      logger.info('Datos para actualizar clase:', {
        name: updateData.name,
        imageUrl: updateData.imageUrl,
        videoUrl: updateData.videoUrl,
        supportMaterialsCount: updateData.supportMaterials?.length,
      });

      // Eliminar archivos viejos
      fileUploadService.deleteFiles(filesToDelete);

      const updatedClass = await this.classService.update(classId, updateData);

      // Limpiar mapeo
      fileUploadService.cleanupAssembledFilesMappings(uploadIdsToClean);

      return res.json(prepareResponse(200, 'Class updated successfully', updatedClass));
    } catch (error) {
      logger.error(`Error en update class: ${(error as Error).message}`);
      return next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const deletedClass = await this.classService.delete(classId);
      if (!deletedClass) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }
      return res.json(prepareResponse(200, 'Class deleted successfully', deletedClass));
    } catch (error) {
      return next(error);
    }
  };

  findAllByCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const classes = await this.classService.findAllByCourse(courseId);
      return res.json(prepareResponse(200, 'Classes fetched successfully', classes));
    } catch (error) {
      return next(error);
    }
  };

  findAllByTeacherCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { teacherId } = req.params;
      
      if (!this.courseService) {
        return res.status(500).json(prepareResponse(500, 'Course service not available', null));
      }

      // Obtener los cursos del profesor
      const courses = await this.courseService.findByTeacherId(teacherId);
      
      if (!courses || courses.length === 0) {
        return res.json(prepareResponse(200, 'Classes fetched successfully', []));
      }

      // Extraer los IDs de los cursos
      const courseIds = courses.map(course => course._id.toString());

      // Obtener las clases de esos cursos
      const classes = await this.classService.findAllByCourses(courseIds);

      // Agregar información del curso a cada clase
      const classesWithCourse = classes.map(classItem => {
        const course = courses.find(c => c._id.toString() === classItem.courseId.toString());
        return {
          ...classItem,
          courseName: course?.name || 'Curso desconocido',
          courseId: classItem.courseId.toString()
        };
      });

      return res.json(prepareResponse(200, 'Classes fetched successfully', classesWithCourse));
    } catch (error) {
      return next(error);
    }
  };

  changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { status } = req.body;
      const updatedClass = await this.classService.changeStatus(classId, status);
      if (!updatedClass) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }
      return res.json(prepareResponse(200, 'Class status updated successfully', updatedClass));
    } catch (error) {
      return next(error);
    }
  };

  moveUpOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const updatedClass = await this.classService.moveUpOrder(classId);
      if (!updatedClass) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }
      return res.json(prepareResponse(200, 'Class order moved up successfully', updatedClass));
    } catch (error) {
      return next(error);
    }
  };

  moveDownOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const updatedClass = await this.classService.moveDownOrder(classId);
      if (!updatedClass) {
        return res.status(404).json(prepareResponse(404, 'Class not found'));
      }
      return res.json(prepareResponse(200, 'Class order moved down successfully', updatedClass));
    } catch (error) {
      return next(error);
    }
  };

  getClassImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageFileName } = req.params;
      const fileBuffer = await this.classService.getClassImage(imageFileName);
      if (!fileBuffer) {
        return res.status(404).json(prepareResponse(404, 'Image not found'));
      }

      // Determinar el tipo de contenido basado en la extensión del archivo
      let contentType = 'image/jpeg';
      if (imageFileName.endsWith('.png')) {
        contentType = 'image/png';
      } else if (imageFileName.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (imageFileName.endsWith('.jpg') || imageFileName.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      }

      // Headers CORS para permitir la carga de imágenes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 1 día

      res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };

  getClassVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoFileName } = req.params;
      const { range } = req.headers;

      logger.info(`Solicitando video de clase: ${videoFileName}`);

      // Si videoFileName es una URL completa de Bunny CDN, redirigir directamente
      if (this.bunnyService.isBunnyCdnUrl(videoFileName)) {
        logger.info(`Redirigiendo a video en Bunny CDN: ${videoFileName}`);
        return res.redirect(videoFileName);
      }

      // Si es un archivo local, usar el sistema de streaming existente
      const videoData = fileUploadService.getVideoStream(videoFileName, range);

      if (!videoData) {
        return res.status(404).json(prepareResponse(404, 'Video not found'));
      }

      if (videoData.status === 416) {
        res.status(416).send('Requested range not satisfiable');
        return;
      }

      res.writeHead(videoData.status, videoData.headers);

      videoData.stream.on('error', (err) => {
        logger.error(`Error al leer el archivo de video: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error reading the video file');
        }
      });

      videoData.stream.pipe(res);
    } catch (error) {
      logger.error(`Error en getClassVideo: ${(error as Error).message}`);
      return next(error);
    }
  };

  /**
   * Actualiza la configuración del examen para una clase específica.
   * PATCH /api/class/:classId/exam-config
   */
  updateExamConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId } = req.params;
      const { examLink, examVisible, examStartDate, examEndDate } = req.body;

      // Determinar si es activación o desactivación
      if (examVisible === false) {
        // Desactivar examen
        const updatedClass = await this.classService.deactivateExam(classId);

        if (!updatedClass) {
          res.status(404).json(prepareResponse(404, 'Clase no encontrada', null));
          return;
        }

        res.status(200).json(prepareResponse(200, 'Examen desactivado correctamente', updatedClass));
      } else {
        // Activar examen - requiere todos los dato

        if (!examLink || !examStartDate || !examEndDate) {
          res
            .status(400)
            .json(
              prepareResponse(400, 'Para activar el examen se requieren: examLink, examStartDate y examEndDate', null)
            );
          return;
        }

        const updatedClass = await this.classService.activateExam(classId, {
          examLink,
          examStartDate,
          examEndDate,
        });

        if (!updatedClass) {
          res.status(404).json(prepareResponse(404, 'Clase no encontrada', null));
          return;
        }

        res.status(200).json(prepareResponse(200, 'Examen configurado y activado correctamente', updatedClass));
      }
    } catch (error) {
      logger.error(`Error updating exam config: ${(error as Error).message}`);

      if (
        (error as Error).message.includes('no es válido') ||
        (error as Error).message.includes('obligatorio') ||
        (error as Error).message.includes('debe ser posterior') ||
        (error as Error).message.includes('no puede ser en el pasado')
      ) {
        res.status(400).json(prepareResponse(400, (error as Error).message, null));
      } else {
        return next(error);
      }
    }
  };

  /**
   * Obtiene la configuración del examen de una clase específica.
   * GET /api/class/:classId/exam-config
   */
  getExamConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId } = req.params;

      const examConfig = await this.classService.getExamConfig(classId);

      if (!examConfig) {
        res.status(404).json(prepareResponse(404, 'Configuración de examen no encontrada', null));
        return;
      }

      res.status(200).json(prepareResponse(200, 'Configuración de examen obtenida correctamente', examConfig));
    } catch (error) {
      logger.error(`Error getting exam config: ${(error as Error).message}`);
      return next(error);
    }
  };

  /**
   * Elimina archivos multimedia específicos de una clase
   * @param req - Request con classId, mediaType y fileName (opcional)
   * @param res - Response con confirmación de eliminación
   * @param next - NextFunction para manejo de errores
   */
  deleteClassMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId, mediaType, fileName } = req.params;

      // Validar parámetros
      if (!classId || !mediaType) {
        return res.status(400).json(prepareResponse(400, 'classId y mediaType son requeridos'));
      }

      // Validar tipos de media permitidos
      const allowedMediaTypes = ['image', 'video', 'supportMaterial'];
      if (!allowedMediaTypes.includes(mediaType)) {
        return res.status(400).json(prepareResponse(400, `mediaType debe ser uno de: ${allowedMediaTypes.join(', ')}`));
      }

      // Para supportMaterial, fileName es requerido
      if (mediaType === 'supportMaterial' && !fileName) {
        return res.status(400).json(prepareResponse(400, 'fileName es requerido para eliminar archivos de soporte'));
      }

      logger.info(`Eliminando media de clase`);
      logger.info(`Parámetros de eliminación de media recibidos`);

      // Obtener la clase actual
      const existingClass = await this.classService.findOneById(classId);
      if (!existingClass) {
        return res.status(404).json(prepareResponse(404, 'Clase no encontrada'));
      }

      logger.info(`Clase encontrada para eliminación de media`);

      const updateQuery: Record<string, unknown> = {};
      const unsetQuery: Record<string, unknown> = {};
      const filesToDelete: { directory: string; fileName: string }[] = [];

      switch (mediaType) {
        case 'image':
          if (existingClass.imageUrl) {
            // Si la imagen está en Bunny, eliminarla de allí
            if (this.bunnyService.isBunnyCdnUrl(existingClass.imageUrl)) {
              logger.info(`🗑️ Eliminando imagen de Bunny: ${existingClass.imageUrl}`);
              await this.bunnyService.deleteFile(existingClass.imageUrl);
            } else {
              // Si es local, marcarla para eliminación del filesystem
              filesToDelete.push({ directory: uploadDirImages, fileName: existingClass.imageUrl });
            }
            unsetQuery.imageUrl = '';
          }
          break;

        case 'video':
          if (existingClass.videoUrl) {
            // Si el video está en Bunny, eliminarlo de allí
            if (this.bunnyService.isBunnyCdnUrl(existingClass.videoUrl)) {
              logger.info(`🗑️ Eliminando video de Bunny: ${existingClass.videoUrl}`);
              await this.bunnyService.deleteFile(existingClass.videoUrl);
            } else {
              // Si es local, marcarlo para eliminación del filesystem
              filesToDelete.push({ directory: uploadDirVideos, fileName: existingClass.videoUrl });
            }
            unsetQuery.videoUrl = '';
          }
          break;

        case 'supportMaterial':
          if (existingClass.supportMaterials && fileName) {
            logger.info('Procesando eliminación de archivo soporte');

            const updatedSupportMaterials = existingClass.supportMaterials.filter(
              (material: string) => path.basename(material) !== fileName
            );

            if (updatedSupportMaterials.length < existingClass.supportMaterials.length) {
              filesToDelete.push({ directory: uploadDirSupportMaterials, fileName });

              if (updatedSupportMaterials.length === 0) {
                unsetQuery.supportMaterials = '';
              } else {
                updateQuery.supportMaterials = updatedSupportMaterials;
              }
            } else {
              return res.status(404).json(prepareResponse(404, 'Archivo de soporte no encontrado'));
            }
          }
          break;

        default:
          return res.status(400).json(prepareResponse(400, 'Tipo de media no válido'));
      }

      // Eliminar archivos usando el servicio
      fileUploadService.deleteFiles(filesToDelete);

      // Construir la consulta de actualización final
      const finalUpdateQuery: Record<string, unknown> = {};
      if (Object.keys(updateQuery).length > 0) {
        finalUpdateQuery.$set = updateQuery;
      }
      if (Object.keys(unsetQuery).length > 0) {
        finalUpdateQuery.$unset = unsetQuery;
      }

      logger.info(`Consulta de actualización preparada`);

      // Actualizar la clase en la base de datos usando los operadores de MongoDB
      const updatedClass = await this.classService.updateWithOperators(classId, finalUpdateQuery);

      logger.info(`Clase actualizada después de eliminación de media`);

      logger.info(`Media eliminado exitosamente de la clase`);

      return res.json(
        prepareResponse(200, `${mediaType} eliminado correctamente`, {
          classId,
          mediaType,
          fileName,
          updatedClass: {
            imageUrl: updatedClass.imageUrl,
            videoUrl: updatedClass.videoUrl,
            supportMaterials: updatedClass.supportMaterials,
          },
        })
      );
    } catch (error) {
      logger.error(`❌ Error eliminando media de clase: ${(error as Error).message}`);
      return next(error);
    }
  };
}
