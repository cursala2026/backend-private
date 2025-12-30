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
import { courseProgressRepository } from '@/repositories/courseProgress.repository';
import { courseRepository } from '@/repositories';
import { videoUploadProgressService } from '@/services/video-upload-progress.service';

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

      if (!name || !courseId) {
        return res.status(400).json({ message: 'Faltan campos requeridos: name o courseId.' });
      }
      
      // description es opcional, pero si viene vacío, establecerlo como string vacío
      const finalDescription = description || '';

      // Resolver archivos usando el servicio
      const resolvedFiles = fileUploadService.resolveClassFiles(files, imageFileId, videoFileId, supportMaterialIds);

      let { imageUrl, videoUrl, supportMaterials, errors, uploadIdsToClean } = resolvedFiles;

      if (errors.length > 0) {
        return res.status(400).json({ message: errors[0] });
      }

      // Si no hay imagen, usar la imagen por defecto
      if (!imageUrl) {
        // Buscar la imagen por defecto en desarrollo (src) y producción (dist)
        const defaultImagePaths = [
          path.join(__dirname, '../static/clase/clase.png'), // Producción (dist)
          path.join(__dirname, '../../static/clase/clase.png'), // Desarrollo (src)
        ];
        
        let defaultImagePath: string | null = null;
        for (const imagePath of defaultImagePaths) {
          if (fs.existsSync(imagePath)) {
            defaultImagePath = imagePath;
            break;
          }
        }
        
        if (defaultImagePath) {
          logger.info('📷 Usando imagen por defecto para la clase');
          // Copiar la imagen por defecto al directorio de imágenes temporales
          const tempImageName = `default-class-${Date.now()}.png`;
          const tempImagePath = path.join(uploadDirImages, tempImageName);
          fs.copyFileSync(defaultImagePath, tempImagePath);
          imageUrl = tempImageName;
        } else {
          logger.warn('⚠️ No se encontró la imagen por defecto. Rutas intentadas:', defaultImagePaths);
        }
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

      // Manejar video: si existe, se subirá en background
      const hasVideo = !!videoUrl;
      const localVideoPath = videoUrl ? path.join(uploadDirVideos, videoUrl) : null;
      let videoStats: fs.Stats | null = null;
      let videoSizeMB = 0;
      let uniqueVideoFileName = '';

      if (hasVideo && localVideoPath && fs.existsSync(localVideoPath)) {
        videoStats = fs.statSync(localVideoPath);
        videoSizeMB = videoStats.size / (1024 * 1024);
        uniqueVideoFileName = this.bunnyService.generateUniqueFileName(videoUrl, 'class-video');
        logger.info(`📹 Video detectado (${videoSizeMB.toFixed(2)} MB): ${uniqueVideoFileName}`);
      }

      // Subir archivos de apoyo a Bunny Storage si existen
      if (supportMaterials.length > 0) {
        const bunnyUrls: string[] = [];
        for (const materialFile of supportMaterials) {
          try {
            const localFilePath = path.join(uploadDirSupportMaterials, materialFile);
            const fileBuffer = fs.readFileSync(localFilePath);
            const uniqueFileName = this.bunnyService.generateUniqueFileName(materialFile, 'support');

            logger.info(`🐰 Subiendo archivo de apoyo a Bunny: ${uniqueFileName}`);
            const bunnyUrl = await this.bunnyService.uploadFile(fileBuffer, uniqueFileName, 'support-materials');

            // Eliminar archivo local después de subir a Bunny
            fs.unlinkSync(localFilePath);

            bunnyUrls.push(bunnyUrl);
            logger.info(`✅ Archivo de apoyo subido a Bunny exitosamente: ${bunnyUrl}`);
          } catch (error) {
            logger.error(`❌ Error subiendo archivo de apoyo a Bunny: ${(error as Error).message}`);
            // Continuar con los demás archivos
          }
        }
        // Reemplazar supportMaterials con las URLs de Bunny
        supportMaterials = bunnyUrls;
      }

      // Construir datos de clase
      const classData: Partial<IClassData> = {
        name,
        description: finalDescription,
        imageUrl,
        courseId,
        supportMaterials,
      };

      // Si hay video, marcar como processing (se subirá en background)
      if (hasVideo) {
        classData.videoStatus = 'processing';
        // NO establecer videoUrl todavía - se establecerá cuando termine la subida
        // Esto evita problemas de validación con nombres de archivo locales
        // classData.videoUrl se establecerá en uploadVideoInBackground
      }

      if (linkLive !== undefined) {
        classData.linkLive = linkLive;
      }

      logger.info('Datos para crear clase:', { 
        name, 
        imageUrl, 
        hasVideo, 
        videoStatus: classData.videoStatus,
        videoUrl: classData.videoUrl,
        supportMaterialsCount: supportMaterials.length 
      });

      let newClass;
      try {
        newClass = await this.classService.create(classData);
      } catch (error) {
        logger.error(`Error creando clase en servicio: ${(error as Error).message}`);
        logger.error(`Stack trace: ${(error as Error).stack}`);
        // Si es un error de validación, devolver 400 con mensaje descriptivo
        if ((error as any).name === 'ValidationError') {
          const validationErrors = Object.values((error as any).errors || {}).map((e: any) => e.message).join(', ');
          return res.status(400).json({ 
            message: `Error de validación: ${validationErrors}`,
            error: (error as Error).message 
          });
        }
        throw error;
      }
      
      const classId = newClass._id.toString();

      // Limpiar mapeo después de usar
      fileUploadService.cleanupAssembledFilesMappings(uploadIdsToClean);

      // Si hay video, subirlo en background
      if (hasVideo && localVideoPath && videoStats && fs.existsSync(localVideoPath)) {
        // Iniciar tracking de progreso (empezar en 0%)
        videoUploadProgressService.startTracking(classId);
        // Enviar progreso inicial de 0% para que el frontend sepa que empezó
        videoUploadProgressService.updateProgress(classId, 0);

        // Ejecutar subida en background (no await)
        // Usar setTimeout para asegurar que la respuesta HTTP se envíe primero
        setImmediate(() => {
          this.uploadVideoInBackground(
            classId,
            localVideoPath,
            uniqueVideoFileName,
            videoStats.size
          ).catch((error) => {
            logger.error(`❌ Error en background upload para clase ${classId}: ${(error as Error).message}`);
            videoUploadProgressService.setError(classId);
            // Actualizar status a error
            this.classService.update(classId, { videoStatus: 'error' }).catch((updateError) => {
              logger.error(`Error actualizando videoStatus a error: ${(updateError as Error).message}`);
            });
          });
        });
      }

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
      const shouldDeleteVideo = deleteCurrentVideo === 'true';
      
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
          shouldDeleteVideo,
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

      // Manejar video: si existe y es diferente, se subirá en background
      const hasNewVideo = videoUrl && videoUrl !== existingClass.videoUrl;
      // Verificar si se está eliminando el video: debe estar marcado para eliminar Y no haber videoUrl nuevo
      const isVideoDeleted = shouldDeleteVideo && (videoUrl === undefined || videoUrl === null || videoUrl === '');
      const localVideoPath = hasNewVideo ? path.join(uploadDirVideos, videoUrl) : null;
      let videoStats: fs.Stats | null = null;
      let videoSizeMB = 0;
      let uniqueVideoFileName = '';

      // Si se está eliminando el video, eliminar de Bunny
      if (isVideoDeleted && existingClass.videoUrl) {
        if (this.bunnyService.isBunnyCdnUrl(existingClass.videoUrl)) {
          logger.info(`🗑️ Eliminando video de Bunny: ${existingClass.videoUrl}`);
          // Eliminar en background para no bloquear
          this.bunnyService.deleteFile(existingClass.videoUrl).catch((error) => {
            logger.error(`Error eliminando video de Bunny: ${(error as Error).message}`);
          });
        }
      }

      if (hasNewVideo && localVideoPath && fs.existsSync(localVideoPath)) {
        videoStats = fs.statSync(localVideoPath);
        videoSizeMB = videoStats.size / (1024 * 1024);
        uniqueVideoFileName = this.bunnyService.generateUniqueFileName(videoUrl, 'class-video');
        logger.info(`📹 Nuevo video detectado (${videoSizeMB.toFixed(2)} MB): ${uniqueVideoFileName}`);

        // Si existe un video anterior en Bunny, eliminarlo
        if (existingClass.videoUrl && this.bunnyService.isBunnyCdnUrl(existingClass.videoUrl)) {
          logger.info(`🗑️ Eliminando video anterior de Bunny: ${existingClass.videoUrl}`);
          // Eliminar en background para no bloquear
          this.bunnyService.deleteFile(existingClass.videoUrl).catch((error) => {
            logger.error(`Error eliminando video anterior: ${(error as Error).message}`);
          });
        }
      }

      // Procesar archivos de apoyo nuevos
      const newSupportMaterialFiles = supportMaterials.filter(
        (material) => !material.startsWith('http://') && !material.startsWith('https://')
      );
      const existingBunnyUrls = supportMaterials.filter(
        (material) => material.startsWith('http://') || material.startsWith('https://')
      );

      // Subir nuevos archivos de apoyo a Bunny
      if (newSupportMaterialFiles.length > 0) {
        const bunnyUrls: string[] = [...existingBunnyUrls];
        for (const materialFile of newSupportMaterialFiles) {
          try {
            const localFilePath = path.join(uploadDirSupportMaterials, materialFile);
            if (fs.existsSync(localFilePath)) {
              const fileBuffer = fs.readFileSync(localFilePath);
              const uniqueFileName = this.bunnyService.generateUniqueFileName(materialFile, 'support');

              logger.info(`🐰 Subiendo archivo de apoyo a Bunny: ${uniqueFileName}`);
              const bunnyUrl = await this.bunnyService.uploadFile(fileBuffer, uniqueFileName, 'support-materials');

              // Eliminar archivo local después de subir a Bunny
              fs.unlinkSync(localFilePath);

              bunnyUrls.push(bunnyUrl);
              logger.info(`✅ Archivo de apoyo subido a Bunny exitosamente: ${bunnyUrl}`);
            }
          } catch (error) {
            logger.error(`❌ Error subiendo archivo de apoyo a Bunny: ${(error as Error).message}`);
            // Continuar con los demás archivos
          }
        }
        supportMaterials = bunnyUrls;
      }

      // Eliminar archivos de apoyo que fueron marcados para eliminar de Bunny
      if (materialsToDelete.length > 0) {
        for (const materialToDelete of materialsToDelete) {
          if (this.bunnyService.isBunnyCdnUrl(materialToDelete)) {
            try {
              logger.info(`🗑️ Eliminando archivo de apoyo de Bunny: ${materialToDelete}`);
              await this.bunnyService.deleteFile(materialToDelete);
            } catch (error) {
              logger.error(`❌ Error eliminando archivo de apoyo de Bunny: ${(error as Error).message}`);
            }
          }
        }
      }

      // Construir datos de actualización
      const updateData: Partial<IClassData> = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (linkLive !== undefined) updateData.linkLive = linkLive;

      // Manejar eliminación de imagen: si deleteCurrentImage es true y imageUrl es undefined
      const isImageDeleted = deleteCurrentImage === 'true' && (imageUrl === undefined || imageUrl === null);
      
      // Solo actualizar URLs si cambiaron y hay un valor válido
      if (imageUrl !== undefined && imageUrl !== null && imageUrl !== existingClass.imageUrl) {
        updateData.imageUrl = imageUrl;
      } else if (isImageDeleted && existingClass.imageUrl) {
        // Si se está eliminando la imagen, usar $unset
        const unsetFields: string[] = ['imageUrl'];
        const setData: Partial<IClassData> = {};
        
        if (name !== undefined) setData.name = name;
        if (description !== undefined) setData.description = description;
        if (linkLive !== undefined) setData.linkLive = linkLive;
        if (supportMaterials.join(',') !== (existingClass.supportMaterials || []).join(',')) {
          setData.supportMaterials = supportMaterials;
        }
        
        // Eliminar imagen de Bunny si existe
        if (existingClass.imageUrl && this.bunnyService.isBunnyCdnUrl(existingClass.imageUrl)) {
          logger.info(`🗑️ Eliminando imagen de Bunny: ${existingClass.imageUrl}`);
          this.bunnyService.deleteFile(existingClass.imageUrl).catch((error) => {
            logger.error(`Error eliminando imagen de Bunny: ${(error as Error).message}`);
          });
        }
        
        // Usar updateWithOperators para eliminar el campo
        const updateQuery: any = {};
        if (Object.keys(setData).length > 0) {
          updateQuery.$set = setData;
        }
        updateQuery.$unset = {};
        unsetFields.forEach(field => {
          updateQuery.$unset[field] = '';
        });
        
        const updatedClass = await this.classService.updateWithOperators(classId, updateQuery);
        return res.json(prepareResponse(200, 'Class updated successfully', updatedClass));
      }
      
      // Si se está eliminando el video, usar $unset para eliminar los campos
      if (isVideoDeleted) {
        // Usar updateWithOperators para eliminar los campos
        const unsetFields: string[] = ['videoUrl', 'videoStatus'];
        const setData: Partial<IClassData> = {};
        
        if (name !== undefined) setData.name = name;
        if (description !== undefined) setData.description = description;
        if (linkLive !== undefined) setData.linkLive = linkLive;
        if (imageUrl !== existingClass.imageUrl) {
          setData.imageUrl = imageUrl;
        }
        if (supportMaterials.join(',') !== (existingClass.supportMaterials || []).join(',')) {
          setData.supportMaterials = supportMaterials;
        }

        logger.info('Datos para actualizar clase (eliminando video):', {
          name: setData.name,
          imageUrl: setData.imageUrl,
          unsetFields,
          supportMaterialsCount: setData.supportMaterials?.length,
        });

        // Eliminar archivos viejos
        fileUploadService.deleteFiles(filesToDelete);

        // Usar updateWithOperators para eliminar campos
        const updateQuery: any = {};
        if (Object.keys(setData).length > 0) {
          updateQuery.$set = setData;
        }
        updateQuery.$unset = {};
        unsetFields.forEach(field => {
          updateQuery.$unset[field] = '';
        });

        const updatedClass = await this.classService.updateWithOperators(classId, updateQuery);
        
        return res.json(prepareResponse(200, 'Class updated successfully', updatedClass));
      }
      
      // Si hay nuevo video, marcar como processing (se subirá en background)
      if (hasNewVideo) {
        updateData.videoStatus = 'processing';
        // Guardar temporalmente el nombre del archivo local
        updateData.videoUrl = videoUrl; // Se actualizará cuando termine la subida
      }
      
      if (supportMaterials.join(',') !== (existingClass.supportMaterials || []).join(',')) {
        updateData.supportMaterials = supportMaterials;
      }

      logger.info('Datos para actualizar clase:', {
        name: updateData.name,
        imageUrl: updateData.imageUrl,
        videoUrl: updateData.videoUrl,
        hasNewVideo,
        isVideoDeleted,
        supportMaterialsCount: updateData.supportMaterials?.length,
      });

      // Eliminar archivos viejos
      fileUploadService.deleteFiles(filesToDelete);

      const updatedClass = await this.classService.update(classId, updateData);

      // Si hay nuevo video, subirlo en background
      if (hasNewVideo && localVideoPath && videoStats && fs.existsSync(localVideoPath)) {
        // Iniciar tracking de progreso (empezar en 0%)
        videoUploadProgressService.startTracking(classId);
        // Enviar progreso inicial de 0% para que el frontend sepa que empezó
        videoUploadProgressService.updateProgress(classId, 0);

        // Ejecutar subida en background (no await)
        // Usar setImmediate para asegurar que la respuesta HTTP se envíe primero
        setImmediate(() => {
          this.uploadVideoInBackground(
            classId,
            localVideoPath,
            uniqueVideoFileName,
            videoStats.size
          ).catch((error) => {
            logger.error(`❌ Error en background upload para clase ${classId}: ${(error as Error).message}`);
            videoUploadProgressService.setError(classId);
            // Actualizar status a error
            this.classService.update(classId, { videoStatus: 'error' }).catch((updateError) => {
              logger.error(`Error actualizando videoStatus a error: ${(updateError as Error).message}`);
            });
          });
        });
      }

      // Si el video cambió, resetear el progreso de esta clase para todos los usuarios
      if (hasNewVideo && existingClass.courseId) {
        try {
          const courseId = existingClass.courseId.toString();
          await courseProgressRepository.resetClassProgress(courseId, classId);
          
          // Recalcular el progreso general del curso desde la colección classes
          const totalClasses = await courseProgressRepository.getTotalClasses(courseId);
          await courseProgressRepository.recalculateOverallProgress(courseId, totalClasses);
          logger.info(`Progreso de clase ${classId} reseteado por cambio de video`);
        } catch (error) {
          logger.error(`Error al resetear progreso de clase: ${(error as Error).message}`);
        }
      }

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

            // Buscar el archivo completo (puede ser URL de Bunny o nombre local)
            const materialToDelete = existingClass.supportMaterials.find(
              (material: string) => path.basename(material) === fileName || material.endsWith(fileName)
            );

            if (materialToDelete) {
              // Si el archivo está en Bunny, eliminarlo de allí
              if (this.bunnyService.isBunnyCdnUrl(materialToDelete)) {
                logger.info(`🗑️ Eliminando archivo de apoyo de Bunny: ${materialToDelete}`);
                await this.bunnyService.deleteFile(materialToDelete);
              } else {
                // Si es local, marcarlo para eliminación del filesystem
                filesToDelete.push({ directory: uploadDirSupportMaterials, fileName: materialToDelete });
              }

              // Actualizar la lista de materiales
              const updatedSupportMaterials = existingClass.supportMaterials.filter(
                (material: string) => material !== materialToDelete
              );

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

  /**
   * Sube un video en background y actualiza el estado de la clase
   */
  private async uploadVideoInBackground(
    classId: string,
    localVideoPath: string,
    uniqueFileName: string,
    fileSize: number
  ): Promise<void> {
    try {
      logger.info(`🚀 Iniciando subida en background para clase ${classId}`);

      // Usar streaming siempre para videos (más eficiente)
      const videoStream = fs.createReadStream(localVideoPath);
      
      // Callback para actualizar progreso
      const onProgress = (percent: number) => {
        videoUploadProgressService.updateProgress(classId, percent);
      };

      // Subir a Bunny con tracking de progreso
      const bunnyUrl = await this.bunnyService.uploadFileStream(
        videoStream,
        uniqueFileName,
        'class-videos',
        fileSize,
        onProgress
      );

      // Eliminar archivo local después de subir
      if (fs.existsSync(localVideoPath)) {
        fs.unlinkSync(localVideoPath);
        logger.info(`🗑️ Archivo local eliminado: ${localVideoPath}`);
      }

      // Actualizar clase con videoUrl y status ready
      await this.classService.update(classId, {
        videoUrl: bunnyUrl,
        videoStatus: 'ready',
      });

      // Finalizar tracking
      videoUploadProgressService.finishTracking(classId);

      logger.info(`✅ Video subido exitosamente en background para clase ${classId}: ${bunnyUrl}`);
    } catch (error) {
      logger.error(`❌ Error subiendo video en background para clase ${classId}: ${(error as Error).message}`);
      
      // Limpiar archivo local en caso de error
      if (fs.existsSync(localVideoPath)) {
        try {
          fs.unlinkSync(localVideoPath);
        } catch (unlinkError) {
          logger.error(`Error eliminando archivo local después de error: ${(unlinkError as Error).message}`);
        }
      }

      // Marcar error en tracking y actualizar clase
      videoUploadProgressService.setError(classId);
      await this.classService.update(classId, { videoStatus: 'error' });
      
      throw error;
    }
  }

  /**
   * Endpoint SSE para obtener el progreso de subida de video
   * GET /classes/:id/upload-progress
   */
  getUploadProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;

      if (!classId) {
        return res.status(400).json({ message: 'classId es requerido' });
      }

      // Configurar headers para SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en nginx

      // Crear un EventEmitter para este cliente
      const { EventEmitter } = require('events');
      const clientEmitter = new EventEmitter();

      // Registrar cliente SSE
      videoUploadProgressService.registerSSEClient(classId, clientEmitter);

      // Enviar progreso inicial si existe
      const initialProgress = videoUploadProgressService.getProgress(classId);
      if (initialProgress >= 0) {
        const initialData = JSON.stringify({ percent: initialProgress });
        res.write(`data: ${initialData}\n\n`);
        // Forzar flush
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }

      // Escuchar eventos de progreso
      let lastSentPercent = -1;
      const progressHandler = (data: { percent: number }) => {
        // Solo enviar si el porcentaje cambió (evitar spam)
        if (data.percent !== lastSentPercent && !res.writableEnded) {
          lastSentPercent = data.percent;
          const progressData = JSON.stringify({ percent: data.percent });
          res.write(`data: ${progressData}\n\n`);
          // Forzar flush del stream para asegurar que se envíe inmediatamente
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      };

      const errorHandler = (data: { message: string }) => {
        res.write(`data: ${JSON.stringify({ error: data.message })}\n\n`);
        cleanup();
      };

      clientEmitter.on('progress', progressHandler);
      clientEmitter.on('error', errorHandler);

      // Limpiar cuando el cliente se desconecta
      const cleanup = () => {
        clientEmitter.removeListener('progress', progressHandler);
        clientEmitter.removeListener('error', errorHandler);
        videoUploadProgressService.unregisterSSEClient(classId, clientEmitter);
        res.end();
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);

      // Enviar heartbeat cada 30 segundos para mantener la conexión
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`: heartbeat\n\n`);
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Limpiar intervalo cuando se cierre la conexión
      req.on('close', () => {
        clearInterval(heartbeatInterval);
      });
    } catch (error) {
      logger.error(`Error en getUploadProgress: ${(error as Error).message}`);
      return next(error);
    }
  };
}
