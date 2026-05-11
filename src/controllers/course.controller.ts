import { NextFunction, Request, Response } from 'express';
import { logger, prepareResponse } from '../utils';
import CourseService from '@/services/course.service';
import { categoryService, courseService } from '@/services';
import { ICourse } from '@/models';
import { courseUploadFiles } from '@/services/course-upload.service';
import { ensureString } from '../utils/type-guards';
// Re-exportar para compatibilidad con rutas
export { courseUploadFiles as uploadFiles } from '@/services/course-upload.service';
export const getClassDetails = async (req: Request, res: Response) => {
    // APLICACIÓN DEL CONTROL:
    // Aunque visualmente veas { classId: 'class-123' }, para el compilador es ambiguo.
    const classId = ensureString(req.params.classId); 
    
    // Ahora 'classId' es estrictamente 'string'. 
    // La "Prueba Sustantiva" (el build) pasará sin errores TS2345.
    const result = await courseService.findOneById(classId);
    res.status(200).json(result);
};
export default class CourseController {
  constructor(private readonly courseService: CourseService) { }

  findOneById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = ensureString(req.params.courseId);
    const course = await this.courseService.findOneById(courseId);
    if (!course) {
      return res.status(404).json(prepareResponse(404, 'Course not found'));
    }
    return res.json(prepareResponse(200, 'Course fetched successfully', course));
  } catch (error) {
    return next(error);
  }
};

findOnePublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = ensureString(req.params.courseId);
    const course = await this.courseService.findOneById(courseId);
    if (!course) {
      return res.status(404).json(prepareResponse(404, 'Course not found'));
    }
    return res.json(prepareResponse(200, 'Course fetched successfully', course));
  } catch (error) {
    return next(error);
  }
};

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Log básico de entrada
      const incomingContentType = String(req.headers['content-type'] || 'unknown');
      logger.info('Create course request received', { contentType: incomingContentType });

      // Helper para procesar la creación (comparte lógica entre multipart y JSON)
      const processCreate = async (body: any, files: Record<string, Express.Multer.File[]> | undefined) => {
        // Extraemos los datos del body
        const {
          name,
          description,
          category,
          longDescription,
          order,
          days,
          time,
          startDate,
          registrationOpenDate,
          modality,
          price,
          maxInstallments,
          interestFree,
          isPublished,
          teachers,
        } = body;

        // Procesar teachers: puede venir como array o string separado por comas
        let teachersArray: string[] = [];
        if (teachers) {
          if (Array.isArray(teachers)) {
            teachersArray = teachers.filter((t: string) => t && t.trim() !== '');
          } else if (typeof teachers === 'string') {
            teachersArray = teachers.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
          }
        }

        // Nota: Se elimina la restricción de cantidad de profesores (antes 1-3).
        // Ahora se permite cualquier cantidad (incluyendo 0) para facilitar creación.

        // Convertir a ObjectIds
        const { Types } = require('mongoose');
        const teachersObjectIds = teachersArray.map((id: string) => {
          if (!Types.ObjectId.isValid(id)) {
            throw new Error(`ID de profesor inválido: ${id}`);
          }
          return new Types.ObjectId(id);
        });

        // Construir el objeto de datos del curso
        const courseData = {
          name,
          description,
          // category can be sent as object or string; store as JSON string with only id,name,description
          ...(category
            ? { category: typeof category === 'string' ? category : JSON.stringify({ id: category.id, name: category.name, description: category.description }) }
            : {}),
          longDescription,
          status: 'ACTIVE', // Siempre crear cursos con estado activo
          order: order ? Number(order) : 0,
          days: typeof days === 'string' ? days.split(',').map((day: string) => day.trim()) : days,
          time,
          startDate: startDate ? new Date(startDate) : undefined,
          registrationOpenDate: registrationOpenDate ? new Date(registrationOpenDate) : undefined,
          modality,
          price: price ? Number(price) : undefined,
          maxInstallments: maxInstallments ? Number(maxInstallments) : 1,
          interestFree: interestFree === 'true' || interestFree === true,
          isPublished: (() => {
            if (isPublished === undefined) return true;
            if (typeof isPublished === 'string') return isPublished.toLowerCase() === 'true';
            return Boolean(isPublished);
          })(),
          teachers: teachersObjectIds,
        };

        // Obtener imagenes (si vienen)
        const imageFile = files?.imageFile?.[0];

        // Crear curso con archivos usando el servicio
        const course = await this.courseService.createCourseWithFiles(courseData, imageFile);

        // Regenerar PDF automáticamente después de crear el curso
        try {
          await this.courseService.rebuildOrderedContentForCourse(course._id.toString());
          logger.info('PDF generated successfully', { courseId: course._id });
        } catch (error) {
          logger.error('Error generating PDF for course', { error, courseId: course._id });
        }
        return res.json(prepareResponse(201, 'Course created successfully', course));
      };

      // Si la petición es multipart/form-data, usar multer para parsear archivos
      const contentType = req.headers['content-type'] || '';
      if (typeof contentType === 'string' && contentType.includes('multipart/form-data')) {
        courseUploadFiles.fields([
          { name: 'imageFile', maxCount: 1 },
        ])(req, res, async (err: unknown) => {
          if (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Multer error parsing multipart request', { error: err });
            return res.status(400).json({ message: errorMessage });
          }
          try {
            await processCreate(req.body, req.files as Record<string, Express.Multer.File[]>);
          } catch (error) {
            logger.error('Error creating course (multipart)', { message: (error as Error).message, stack: (error as any)?.stack });
            if (error && typeof error === 'object' && 'code' in error) {
              if ((error as any).code === 11000) {
                return res.status(400).json({ message: 'Ya existe un curso con ese nombre. Por favor, usa un nombre diferente.' });
              }
            }
            if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'ValidationError') {
              logger.error('Mongoose validation error creating course (multipart)', { error });
              return res.status(400).json({ message: 'Error de validación: ' + (error as Error).message });
            }
            logger.error('Unexpected error creating course (multipart)', { error });
            return res.status(500).json({ message: 'Error inesperado al crear el curso', error: (error as Error).message });
          }
        });
      } else {
        // Petición JSON normal (sin archivos)
        try {
          await processCreate(req.body, undefined);
        } catch (error) {
          logger.error('Error creating course (json)', { message: (error as Error).message, stack: (error as any)?.stack });
          if (error && typeof error === 'object' && 'code' in error) {
            if ((error as any).code === 11000) {
              return res.status(400).json({ message: 'Ya existe un curso con ese nombre. Por favor, usa un nombre diferente.' });
            }
          }
          if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'ValidationError') {
            logger.error('Mongoose validation error creating course (json)', { error });
            return res.status(400).json({ message: 'Error de validación: ' + (error as Error).message });
          }
          logger.error('Unexpected error creating course (json)', { error });
          return res.status(500).json({ message: 'Error inesperado al crear el curso', error: (error as Error).message });
        }
      }
    } catch (error) {
      return next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      courseUploadFiles.fields([
        { name: 'imageFile', maxCount: 1 },
      ])(req, res, async (err: unknown) => {
        if (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return res.status(400).json({ message: errorMessage });
        }

        try {
          const id = ensureString(req.params.courseId);
          const existingCourse = await this.courseService.findOneById(id);
          if (!existingCourse) {
            return res.status(404).json({ message: 'Course not found' });
          }

          // Nota: la migración desde `mainTeacher` a `teachers` ya no es necesaria.

          const updateData: Partial<ICourse> = {};
          const unsetFields: string[] = [];
          const {
            name,
            description,
            longDescription,
            category,
            days,
            time,
            startDate,
            registrationOpenDate,
            modality,
            price,
            maxInstallments,
            interestFree,
            numberOfClasses,
            duration,
            showOnHome,
            deleteImage,
            teachers,
          } = req.body;

          // Solo actualizar campos si están presentes en req.body
          if (name !== undefined) updateData.name = name;
          if (description !== undefined) updateData.description = description;
          // Manejar category: aceptar string o objeto; permitir limpiar con '' o null
          if (category !== undefined) {
            if (category === '' || category === null) {
              unsetFields.push('category');
            } else {
              updateData.category = typeof category === 'string' ? category : JSON.stringify({ id: category.id, name: category.name, description: category.description });
            }
          }
          if (longDescription !== undefined) updateData.longDescription = longDescription;
          if (days !== undefined) {
            if (typeof days === 'string') {
              updateData.days = days.split(',').map((day) => day.trim());
            } else {
              updateData.days = days;
            }
          }
          if (time !== undefined) updateData.time = time;
          // Manejar startDate: si no se envía (undefined) o está vacío, eliminarlo de la base de datos
          if (startDate !== undefined) {
            if (startDate === '' || startDate === null) {
              unsetFields.push('startDate');
            } else {
              updateData.startDate = new Date(startDate);
            }
          } else {
            // Si startDate es undefined (no se envió), eliminarlo de la base de datos
            unsetFields.push('startDate');
          }
          // Manejar registrationOpenDate: si no se envía (undefined) o está vacío, eliminarlo de la base de datos
          if (registrationOpenDate !== undefined) {
            if (registrationOpenDate === '' || registrationOpenDate === null) {
              unsetFields.push('registrationOpenDate');
            } else {
              updateData.registrationOpenDate = new Date(registrationOpenDate);
            }
          } else {
            // Si registrationOpenDate es undefined (no se envió), eliminarlo de la base de datos
            unsetFields.push('registrationOpenDate');
          }
          if (modality !== undefined) updateData.modality = modality;
          if (price !== undefined) updateData.price = Number(price);
          if (maxInstallments !== undefined) updateData.maxInstallments = Number(maxInstallments);
          if (interestFree !== undefined) updateData.interestFree = interestFree === 'true' || interestFree === true;
          if (showOnHome !== undefined) updateData.showOnHome = showOnHome === 'true' || showOnHome === true;
          
          // Solo actualizar numberOfClasses si es un número válido (>= 1)
          if (numberOfClasses !== undefined) {
            const numValue = Number(numberOfClasses);
            if (numValue > 0) {
              updateData.numberOfClasses = numValue;
            } else if (numberOfClasses === '' || numberOfClasses === null) {
              // Si está vacío o null, eliminarlo
              unsetFields.push('numberOfClasses');
            }
          }
          
          // Solo actualizar duration si es un número válido (>= 0.5)
          if (duration !== undefined) {
            const durValue = Number(duration);
            if (durValue >= 0.5) {
              updateData.duration = durValue;
            } else if (duration === '' || duration === null) {
              // Si está vacío o null, eliminarlo
              unsetFields.push('duration');
            }
          }

          // Procesar teachers si se proporciona
          if (teachers !== undefined) {
            let teachersArray: string[] = [];
            if (teachers) {
              if (Array.isArray(teachers)) {
                teachersArray = teachers.filter(t => t && t.trim() !== '');
              } else if (typeof teachers === 'string') {
                teachersArray = teachers.split(',').map(t => t.trim()).filter(t => t !== '');
              }
            }

            // Validar que haya entre 1 y 3 profesores
            if (teachersArray.length < 1 || teachersArray.length > 3) {
              return res.status(400).json({ 
                message: 'El curso debe tener entre 1 y 3 profesores asignados' 
              });
            }

            // Convertir a ObjectIds
            const { Types } = require('mongoose');
            const teachersObjectIds = teachersArray.map(id => {
              if (!Types.ObjectId.isValid(id)) {
                throw new Error(`ID de profesor inválido: ${id}`);
              }
              return new Types.ObjectId(id);
            });

            updateData.teachers = teachersObjectIds;
          }

          const files = req.files as Record<string, Express.Multer.File[]>;
          const imageFile = files?.imageFile?.[0];
          
          // Si se solicita eliminar la imagen y no hay nueva imagen, agregar a unsetFields
          if (deleteImage === 'true' || deleteImage === true) {
            if (!imageFile && existingCourse.imageUrl) {
              unsetFields.push('imageUrl');
              // Eliminar imagen del CDN
              const courseUploadService = require('@/services/courseUpload.service').default;
              await courseUploadService.deleteCourseImage(existingCourse.imageUrl);
            }
          }
          
          const hasUpdates = Object.keys(updateData).length > 0 || unsetFields.length > 0 || imageFile;

          // Validar que se reciba al menos un campo para actualizar
          if (!hasUpdates) {
            return res.status(400).json({ message: 'At least one field must be provided for update' });
          }

          // Actualizar curso con archivos usando el servicio
          const updatedCourse = await this.courseService.updateCourseWithFiles(
            id, 
            updateData, 
            unsetFields,
            imageFile
          );

          try {
            await this.courseService.rebuildOrderedContentForCourse(updatedCourse._id.toString());
          } catch (error) {
            console.error('Error rebuilding orderedContent after course update', (error as Error).message);
          }
          
          return res.json(prepareResponse(200, 'Course updated successfully', updatedCourse));
        } catch (error) {
          logger.error(`Update course error: ${(error as Error).message}`);
          
          // Manejar errores de MongoDB específicos
          if (error && typeof error === 'object' && 'code' in error) {
            // Error de duplicado (código 11000 en MongoDB)
            if (error.code === 11000) {
              return res.status(400).json({ 
                message: 'Ya existe un curso con ese nombre. Por favor, usa un nombre diferente.' 
              });
            }
          }

          // Error de validación de Mongoose
          if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') {
            return res.status(400).json({ 
              message: 'Error de validación: ' + (error as Error).message 
            });
          }

          // Error genérico
          return res.status(500).json({ 
            message: 'Error inesperado al actualizar el curso', 
            error: (error as Error).message 
          });
        }
      });
    } catch (error) {
      return next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      
      // Eliminar curso con todos sus archivos usando el servicio
      const deletedCourse = await this.courseService.deleteCourseWithFiles(courseId);

      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course deletion', (error as Error).message);
      }
      
      return res.json(prepareResponse(200, 'Course deleted successfully', deletedCourse));
    } catch (error) {
      return next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = ensureString(req.query.categoryId);
      let courses = await this.courseService.findAll();

      if (categoryId) {
        courses = courses.filter((c: any) => {
          if (!c || !c.category) return false;
          try {
            const parsed = JSON.parse(c.category);
            return String(parsed.id) === categoryId;
          } catch (_err) {
            // Si category no es JSON, comparar directamente
            return c.category === categoryId || c.category.includes(categoryId);
          }
        });
      }

      return res.json(prepareResponse(200, 'Courses fetched successfully', courses));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Devuelve las categorías (id, name, description) para poblar selects en el frontend
   */
  getCategoriesForSelect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cats = await categoryService.findAll();
      const mapped = (cats || []).map((c: any) => ({ id: String((c as any)._id), name: c.name, description: c.description }));
      return res.json(prepareResponse(200, 'Categories fetched successfully', mapped));
    } catch (error) {
      return next(error);
    }
  };

  findPublishedCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courses = await this.courseService.findPublishedCourses();
      return res.json(prepareResponse(200, 'Published courses fetched successfully', courses));
    } catch (error) {
      return next(error);
    }
  };

  changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const { status } = req.body;
      const course = await this.courseService.changeStatus(courseId, status);

      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course status change', (error as Error).message);
      }

      return res.json(prepareResponse(200, 'Course status updated successfully', course));
    } catch (error) {
      return next(error);
    }
  };

  moveUpOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const course = await this.courseService.moveUpOrder(courseId);
      
      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after moving course up', (error as Error).message);
      }

      return res.json(prepareResponse(200, 'Course order moved up successfully', course));
    } catch (error) {
      return next(error);
    }
  };

  moveDownOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const course = await this.courseService.moveDownOrder(courseId);
      
      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after moving course down', (error as Error).message);
      }

      return res.json(prepareResponse(200, 'Course order moved down successfully', course));
    } catch (error) {
      return next(error);
    }
  };

  getCourseImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageFileName = ensureString(req.params.imageFileName);
      const fileBuffer = await this.courseService.getCourseImage(imageFileName);
      if (!fileBuffer) {
        return res.status(404).json({ message: 'Image not found' });
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

  findForHome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courses = await this.courseService.findForHome();
      return res.json(prepareResponse(200, 'Courses for home fetched successfully', courses));
    } catch (error) {
      return next(error);
    }
  };

  changeShowOnHome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const course = await this.courseService.changeShowOnHome(courseId);

      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course show on home change', (error as Error).message);
      }

      return res.json(prepareResponse(200, 'Course show on home status updated successfully', course));
    } catch (error) {
      return next(error);
    }
  };

  // `mainTeacher` endpoint removed; use course update (`teachers` array) instead.

  changePublishedStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const { isPublished } = req.body;

      // Validar que courseId existe
      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      // Validar que isPublished es un boolean
      if (typeof isPublished !== 'boolean') {
        return res.status(400).json(prepareResponse(400, 'isPublished must be a boolean'));
      }

      // Verificar que el curso existe
      const existingCourse = await this.courseService.findOneById(courseId);
      if (!existingCourse) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Actualizar solo el campo isPublished
      const updatedCourse = await this.courseService.update(courseId, { isPublished }, []);

      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course published status change', (error as Error).message);
      }

      return res.json(prepareResponse(200, 'Course published status updated successfully', updatedCourse));
    } catch (error) {
      logger.error('Error in changePublishedStatus:', error);
      return next(error);
    }
  };

  findByTeacherId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teacherId = ensureString(req.params.teacherId);
      const courses = await this.courseService.findByTeacherId(teacherId);
      return res.json(prepareResponse(200, 'Teacher courses fetched successfully', courses));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Endpoint atómico para añadir/remover teachers del curso.
   * Body: { add?: string[], remove?: string[] }
   */
  updateTeachers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const { add, remove } = req.body as { add?: string[]; remove?: string[] };

      if (!courseId) return res.status(400).json(prepareResponse(400, 'Course ID is required'));

      // Validación mínima: al menos add o remove
      if ((!Array.isArray(add) || add.length === 0) && (!Array.isArray(remove) || remove.length === 0)) {
        return res.status(400).json(prepareResponse(400, 'add or remove array must be provided'));
      }

      const updated = await this.courseService.updateTeachers(courseId, { add, remove });

      try {
        await this.courseService.rebuildOrderedContentForCourse(courseId.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course teachers update', (error as Error).message);
      }
      
      return res.json(prepareResponse(200, 'Course teachers updated successfully', updated));
    } catch (error) {
      return next(error);
    }
  };

  enrollStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const userId = (req.user as any)?._id; // Obtenido del middleware de autenticación

      if (!userId) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated'));
      }

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      // Verificar que el curso existe
      const course = await this.courseService.findOneById(courseId);
      if (!course) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Verificar que el curso es gratis
      if (course.price && course.price > 0) {
        return res.status(400).json(prepareResponse(400, 'Cannot enroll in paid courses through this endpoint'));
      }

      // Inscribir al estudiante
      const updatedCourse = await this.courseService.enrollStudent(courseId, userId.toString());

      return res.json(prepareResponse(200, 'Student enrolled successfully', updatedCourse));
    } catch (error) {
      logger.error('Error enrolling student:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('already enrolled')) {
          return res.status(400).json(prepareResponse(400, 'Student already enrolled in this course'));
        }
      }
      return next(error);
    }
  };

  enrollStudentByAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const userId = ensureString(req.params.userId);
      const { startDate, endDate } = req.body;

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      if (!userId) {
        return res.status(400).json(prepareResponse(400, 'User ID is required'));
      }

      // Verificar que el curso existe
      const course = await this.courseService.findOneById(courseId);
      if (!course) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Convertir fechas si vienen como string
      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      // Inscribir manualmente al estudiante
      const updatedCourse = await this.courseService.enrollStudentByAdmin(
        courseId,
        userId,
        parsedStartDate,
        parsedEndDate
      );

      return res.json(prepareResponse(200, 'Student enrolled successfully by admin', updatedCourse));
    } catch (error) {
      logger.error('Error enrolling student by admin:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('not found')) {
          return res.status(404).json(prepareResponse(404, message));
        }
        if (message.includes('already enrolled')) {
          return res.status(400).json(prepareResponse(400, 'Student already enrolled in this course'));
        }
      }
      return next(error);
    }
  };

  getStudentCourses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any)?._id;

      if (!userId) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated'));
      }

      const courses = await this.courseService.getStudentCourses(userId.toString());
      return res.json(prepareResponse(200, 'Student courses fetched successfully', courses));
    } catch (error) {
      logger.error('Error fetching student courses:', error);
      return next(error);
    }
  };

  unenrollStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const userId = (req.user as any)?._id; // Obtenido del middleware de autenticación

      if (!userId) {
        return res.status(401).json(prepareResponse(401, 'User not authenticated'));
      }

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      // Verificar que el curso existe
      const course = await this.courseService.findOneById(courseId);
      if (!course) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Desuscribir al estudiante
      const updatedCourse = await this.courseService.unenrollStudent(courseId, userId.toString());

      return res.json(prepareResponse(200, 'Student unenrolled successfully', updatedCourse));
    } catch (error) {
      logger.error('Error unenrolling student:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('not enrolled')) {
          return res.status(400).json(prepareResponse(400, 'Student is not enrolled in this course'));
        }
      }
      return next(error);
    }
  };

  unenrollStudentByAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);
      const userId = ensureString(req.params.userId);

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      if (!userId) {
        return res.status(400).json(prepareResponse(400, 'User ID is required'));
      }

      // Verificar que el curso existe
      const course = await this.courseService.findOneById(courseId);
      if (!course) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Desasociar completamente al estudiante del curso
      const updatedCourse = await this.courseService.unenrollStudentByAdmin(courseId, userId);

      return res.json(prepareResponse(200, 'Student completely unenrolled from course', updatedCourse));
    } catch (error) {
      logger.error('Error unenrolling student by admin:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('not found')) {
          return res.status(404).json(prepareResponse(404, message));
        }
        if (message.includes('not enrolled')) {
          return res.status(400).json(prepareResponse(400, 'Student is not enrolled in this course'));
        }
      }
      return next(error);
    }
  };

  duplicateCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);

      if (!courseId) {
        return res.status(400).json(prepareResponse(400, 'Course ID is required'));
      }

      // Verificar que el curso existe
      const course = await this.courseService.findOneById(courseId);
      if (!course) {
        return res.status(404).json(prepareResponse(404, 'Course not found'));
      }

      // Duplicar el curso con todas sus clases y cuestionarios
      const duplicatedCourse = await this.courseService.duplicateCourse(courseId);

      try {
        await this.courseService.rebuildOrderedContentForCourse(duplicatedCourse._id.toString());
      } catch (error) {
        console.error('Error rebuilding orderedContent after course duplication', (error as Error).message);
      }

      return res.json(prepareResponse(201, 'Course duplicated successfully', duplicatedCourse));
    } catch (error) {
      logger.error('Error duplicating course:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('not found')) {
          return res.status(404).json(prepareResponse(404, message));
        }
      }
      return next(error);
    }
  };
}
