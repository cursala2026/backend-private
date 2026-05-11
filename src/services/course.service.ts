import fs from 'fs';
import path from 'path';
import { ICourse, Types } from '@/models';
import { IUser } from '@/models/user.model';
import { logger } from '@/utils';
import CourseRepository from '@/repositories/course.repository';
import UserRepository from '@/repositories/user.repository';
import { sendEmail } from '@/utils/emailer';
// NotificationService removed — kept optional `notificationService` as `any` to preserve calls
import PromotionalCodeService from './promotionalCode.service';
// NotificationType removed; usar literales 'success' | 'warning' donde corresponda
import { courseProgressRepository, questionnaireSubmissionRepository, certificateRepository } from '@/repositories';
import { courseUploadService, ProgramGeneratorService, mapCourseToPdfData } from './course-upload.service';
import config from '@/config';

export default class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
    private readonly promotionalCodeService?: PromotionalCodeService
  ) {}

  async findOneById(id: string) {
    const course = await this.courseRepository.findOneById(id);
    
    if (course) {
      if (course.classes && course.questionnaires) {
        // Generar el array ordenado de contenido
        course.orderedContent = this.buildOrderedContent(course.classes, course.questionnaires);
      }
    }
    
    return course;
  }

  /**
   * Construye un array ordenado de contenido del curso (clases + cuestionarios)
   * @param classes - Array de clases del curso
   * @param questionnaires - Array de cuestionarios del curso
   * @returns Array ordenado con clases y cuestionarios intercalados
   */
  private buildOrderedContent(classes: any[], questionnaires: any[]): any[] {
    const orderedContent: any[] = [];
    
    // Ordenar clases por su campo order
    const sortedClasses = [...classes].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Separar cuestionarios por tipo
    const betweenClassesQuestions = questionnaires.filter(
      q => q.position?.type === 'BETWEEN_CLASSES' && q.status === 'ACTIVE'
    );
    const finalExams = questionnaires.filter(
      q => q.position?.type === 'FINAL_EXAM' && q.status === 'ACTIVE'
    );
    
    // Insertar clases y cuestionarios intercalados
    sortedClasses.forEach((classItem, index) => {
      // Agregar la clase
      orderedContent.push({
        type: 'CLASS',
        data: classItem,
        order: index
      });
      
      // Buscar cuestionarios que van después de esta clase
      const classId = String(classItem._id);
      const questionsAfterThisClass = betweenClassesQuestions.filter(
        q => String(q.position?.afterClassId) === classId
      );
      
      // Agregar cuestionarios que van después de esta clase
      questionsAfterThisClass.forEach(q => {
        orderedContent.push({
          type: 'QUESTIONNAIRE',
          data: q
        });
      });
    });
    
    // Agregar exámenes finales al final
    finalExams.forEach(q => {
      orderedContent.push({
        type: 'QUESTIONNAIRE',
        data: q
      });
    });
    
    return orderedContent;
  }

  async buildFullProgramData(courseId: string): Promise<any> {
    const course = await this.courseRepository.findOneById(courseId);
    if (!course) throw new Error('Course not found');

    // Recuperar clases y cuestionarios
    const classes = course.classes || [];
    const questionnaires = course.questionnaires || [];

    // Recuperar profesores vinculados
    const teacherIds = (course.teachers || []).map((t: any) => String(t));
    const teacherResults = await Promise.all(teacherIds.map(id => this.userRepository.getUserById(id)));
    const teachers = teacherResults.filter((t): t is IUser => !!t);

    // Respetar el orderedContent
    const orderedContent = this.buildOrderedContent(classes, questionnaires);

    // Construir objeto final
    return {
      ...course,
      teachers: teachers
        .filter(Boolean)
        .map(t => ({
          id: t._id.toString(),
          name: `${t.firstName} ${t.lastName}`,
          email: t.email,
        })),
      orderedContent,
    };
  }

  /**
   * Reconstruye y persiste `orderedContent` del curso especificado.
   * Usa `findOneById` para obtener las clases y cuestionarios actuales,
   * construye el array ordenado y lo persiste en el documento del curso.
   */
  async rebuildOrderedContentForCourse(courseId: string): Promise<void> {
    try {
      const course = await this.courseRepository.findOneById(courseId);
      if (!course) return;

      const classes = course.classes || [];
      const questionnaires = course.questionnaires || [];

      const ordered = this.buildOrderedContent(classes, questionnaires);

      // Persistir el orderedContent en el documento del curso
      await this.courseRepository.update(courseId, { orderedContent: ordered });

      // Generar PDF con el programa del curso actualizado
      try {
        const fullData = await this.buildFullProgramData(courseId);
        const programData = await mapCourseToPdfData(fullData);
        const generator = new ProgramGeneratorService();
        const pdfUrl = await generator.generateAndUploadProgramPDF(programData, fullData.programUrl);
        // Actualizar el curso con la URL del nuevo PDF generado
        await this.courseRepository.update(courseId, { orderedContent: ordered, programUrl: pdfUrl });
      } catch (err) {
        logger.error('Error generating/uploading program PDF after rebuilding orderedContent', { courseId, error: (err as Error).message });
      }
    } catch (err) {
      logger.error('Error rebuilding orderedContent for course', { courseId, error: (err as Error).message });
    }
  }

  async findById(id: string): Promise<ICourse | null> {
    return this.courseRepository.findById(id);
  }

  async update(id: string, updateData: Partial<ICourse>, unsetFields?: string[]): Promise<ICourse> {
    const existingCourse = await this.courseRepository.findOneById(id);
    if (!existingCourse) {
      throw new Error('Course not found');
    }

    const existingTeachers = (existingCourse.teachers || []).map((t: any) => String(t));
    const newTeachers = updateData.teachers ? (updateData.teachers as any[]).map(t => String(t)) : undefined;

    const updated = await this.courseRepository.update(id, updateData, unsetFields);

    if (newTeachers) {
      const added = newTeachers.filter(t => !existingTeachers.includes(t));
      const removed = existingTeachers.filter(t => !newTeachers.includes(t));
      await this.handleTeacherAssignmentChanges(added, removed, updated);
    }

    return updated;
  }

  async create(courseData: Partial<ICourse>): Promise<ICourse> {
    return this.courseRepository.create(courseData);
  }

  /**
   * Crea un curso completo con archivos (imagen y PDF)
   */
  async createCourseWithFiles(
    courseData: Partial<ICourse>,
    imageFile?: Express.Multer.File
  ): Promise<ICourse> {
    // Paso 1: Crear el curso en la base de datos
    let course = await this.courseRepository.create(courseData);

    // Paso 2: Subir archivos y actualizar el curso
    try {
      const updateData: Partial<ICourse> = {};

      // Subir imagen a Bunny CDN si se proporcionó
      if (imageFile) {
        const imageUrl = await courseUploadService.uploadCourseImage(imageFile);
        updateData.imageUrl = imageUrl;
        updateData.imageOriginalName = imageFile.originalname;
      }

      // Subir PDF a Bunny CDN si se proporcionó
      const programData = await mapCourseToPdfData(course);
      const generator = new ProgramGeneratorService();
      const pdfUrl = await generator.generateAndUploadProgramPDF(programData, course.programUrl);
      updateData.programUrl = pdfUrl;
      updateData.programOriginalName = `${programData.course?.name}.pdf`;

      // Actualizar el curso con las URLs de los archivos
      if (Object.keys(updateData).length > 0) {
        course = await this.courseRepository.update(course._id.toString(), updateData);
      }

      return course;
    } catch (uploadError) {
      // Si falla la subida de archivos, eliminar el curso creado
      await this.courseRepository.delete(course._id.toString());
      throw new Error(`Error al subir archivos: ${(uploadError as Error).message}`);
    }
  }

  /**
   * Actualiza un curso con archivos opcionales
   */
  async updateCourseWithFiles(
    id: string,
    updateData: Partial<ICourse>,
    unsetFields: string[] = [],
    imageFile?: Express.Multer.File
  ): Promise<ICourse> {
    const existingCourse = await this.courseRepository.findOneById(id);
    if (!existingCourse) {
      throw new Error('Course not found');
    }

    // Procesar archivo de imagen si se proporciona uno nuevo
    if (imageFile) {
      // Subir nueva imagen a Bunny CDN
      updateData.imageUrl = await courseUploadService.uploadCourseImage(imageFile);
      updateData.imageOriginalName = imageFile.originalname;

      // Eliminar imagen anterior
      if (existingCourse.imageUrl) {
        await courseUploadService.deleteCourseImage(existingCourse.imageUrl);
      }
    }

    // Generar y subir nuevo PDF automaticamente
    const programData = await mapCourseToPdfData(existingCourse);
    const generator = new ProgramGeneratorService();
    const pdfUrl = await generator.generateAndUploadProgramPDF(programData, existingCourse.programUrl);
    updateData.programUrl = pdfUrl;
    updateData.programOriginalName = `${programData.course?.name}.pdf`;

    // Realizar la actualización
    const updated = await this.courseRepository.update(id, updateData, unsetFields);

    // Si se modificó el array `teachers`, detectar cambios y notificar
    if (updateData.teachers) {
      const existingTeachers = (existingCourse.teachers || []).map((t: any) => String(t));
      const newTeachers = (updateData.teachers as any[]).map(t => String(t));
      const added = newTeachers.filter(t => !existingTeachers.includes(t));
      const removed = existingTeachers.filter(t => !newTeachers.includes(t));
      await this.handleTeacherAssignmentChanges(added, removed, updated);
    }

    return updated;
  }

  /**
   * Elimina un curso y todos sus archivos asociados
   */
  async deleteCourseWithFiles(id: string): Promise<ICourse | null> {
    // Obtener el curso antes de eliminarlo
    const course = await this.courseRepository.findOneById(id);
    if (!course) {
      throw new Error('Course not found');
    }

    // Eliminar la imagen de Bunny CDN si existe
    if (course.imageUrl) {
      await courseUploadService.deleteCourseImage(course.imageUrl);
    }

    // Eliminar el archivo PDF desde Bunny CDN si existe
    if (course.programUrl) {
      await courseUploadService.deleteProgramFile(course.programUrl);
    }

    // Eliminar todo el progreso de este curso
    try {
      await courseProgressRepository.deleteAllByCourseId(id);
    } catch (error) {
      console.error('Error al eliminar progreso del curso:', error);
    }

    // Eliminar el curso de la base de datos
    return this.courseRepository.delete(id);
  }

  /**
   * Actualiza atómicamente los teachers del curso y dispara notificaciones apropiadas.
   */
  async updateTeachers(courseId: string, payload: { add?: string[]; remove?: string[] }): Promise<ICourse> {
    const { add = [], remove = [] } = payload;

    const existingCourse = await this.courseRepository.findOneById(courseId);
    if (!existingCourse) throw new Error('Course not found');

    // Ejecutar operación atómica en repo
    const updated = await this.courseRepository.updateTeachersAtomic(courseId, add, remove);

    // Disparar notificaciones basadas en diffs
    try {
      await this.handleTeacherAssignmentChanges(add, remove, updated);
    } catch (err) {
      logger.error('Error handling teacher assignment notifications', { error: (err as Error).message });
    }

    const updateData: Partial<ICourse> = {};
    const programData = await mapCourseToPdfData(existingCourse);
    const generator = new ProgramGeneratorService();
    const pdfUrl = await generator.generateAndUploadProgramPDF(programData, existingCourse.programUrl);
    updateData.programUrl = pdfUrl;
    updateData.programOriginalName = `${programData.course?.name}.pdf`;

    return updated;
  }

  async delete(id: string): Promise<ICourse | null> {
    // Eliminar todo el progreso de este curso
    try {
      await courseProgressRepository.deleteAllByCourseId(id);
    } catch (error) {
      console.error('Error al eliminar progreso del curso:', error);
    }
    return this.courseRepository.delete(id);
  }

  async findAll(): Promise<ICourse[]> {
    return this.courseRepository.findAll();
  }

  async findPublishedCourses(): Promise<ICourse[]> {
    const courses = await this.courseRepository.findPublishedCourses();

    try {
      if (!this.promotionalCodeService) return courses;

      const ids = (courses || [])
        .map((c: any) => (c && c._id ? String(c._id) : (c && c.id ? String(c.id) : undefined)))
        .filter(Boolean) as string[];

      if (ids.length === 0) return courses;

      const promosMap = await this.promotionalCodeService.getActivePromotionsForCourses(ids);

      const augmented = (courses || []).map((c: any) => {
        const id = c && c._id ? String(c._id) : c && c.id ? String(c.id) : undefined;
        return {
          ...c,
          hasActivePromotionalCode: id ? Boolean(promosMap[id]) : false,
        };
      });

      return augmented as unknown as ICourse[];
    } catch (err) {
      // Si hay error en promo service, devolver cursos sin el flag para no romper endpoint
      return courses;
    }
  }

  async changeStatus(courseId: string, status: string): Promise<ICourse | null> {
    return this.courseRepository.changeStatus(courseId, status);
  }

  async moveUpOrder(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.moveUpOrder(courseId);
  }

  async moveDownOrder(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.moveDownOrder(courseId);
  }

  async getCourseImage(imageFileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(__dirname, '../static/images', imageFileName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading course image: ${error.message}`);
      }
      throw new Error('Unknown error reading course image');
    }
  }

  async findForHome(): Promise<Array<Omit<ICourse, '_id'> & { _id: string }>> {
    return this.courseRepository.findForHome();
  }

  async changeShowOnHome(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.changeShowOnHome(courseId);
  }
 

  async findByTeacherId(teacherId: string): Promise<ICourse[]> {
    return this.courseRepository.findByTeacherId(teacherId);
  }

  async enrollStudent(courseId: string, studentId: string): Promise<ICourse> {
    const course = await this.courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Verificar si el estudiante ya está inscrito
    const students = course.students || [];
    const isAlreadyEnrolled = students.some((enrolledStudent: any) => {
      const enrolledUserId = enrolledStudent.userId
        ? enrolledStudent.userId.toString()
        : String(enrolledStudent);
      return enrolledUserId === studentId;
    });

    if (isAlreadyEnrolled) {
      throw new Error('Student already enrolled in this course');
    }

    // Agregar el estudiante al array de estudiantes del curso (auto-inscripción)
    return this.courseRepository.enrollStudent(courseId, studentId, 'SELF');
  }

  /**
   * Inscribe manualmente a un estudiante en un curso (solo admin).
   * Permite especificar fechas de inicio y fin para cohorts.
   * @param courseId - ID del curso
   * @param studentId - ID del estudiante a inscribir
   * @param startDate - Fecha de inicio opcional
   * @param endDate - Fecha de fin opcional
   * @returns El curso actualizado
   */
  async enrollStudentByAdmin(courseId: string, studentId: string, startDate?: Date, endDate?: Date): Promise<ICourse> {
    const course = await this.courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Verificar que el estudiante existe
    const student = await this.userRepository.getUserById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Verificar si el estudiante ya está inscrito
    const students = course.students || [];
    const isAlreadyEnrolled = students.some((enrolledStudent: any) => {
      const enrolledUserId = enrolledStudent.userId
        ? enrolledStudent.userId.toString()
        : String(enrolledStudent);
      return enrolledUserId === studentId;
    });

    if (isAlreadyEnrolled) {
      throw new Error('Student already enrolled in this course');
    }

    // Agregar el estudiante al array de estudiantes del curso (inscripción manual por admin)
    return this.courseRepository.enrollStudent(courseId, studentId, 'MANUAL', startDate, endDate);
  }

  async getStudentCourses(studentId: string): Promise<ICourse[]> {
    const courses = await this.courseRepository.getStudentCourses(studentId);

    try {
      if (!this.promotionalCodeService) return courses;

      const ids = (courses || [])
        .map((c: any) => (c && c._id ? String(c._id) : c && c.id ? String(c.id) : undefined))
        .filter(Boolean) as string[];

      if (ids.length === 0) return courses;

      const promosMap = await this.promotionalCodeService.getActivePromotionsForCourses(ids);

      const augmented = (courses || []).map((c: any) => {
        const id = c && c._id ? String(c._id) : c && c.id ? String(c.id) : undefined;
        return {
          ...c,
          hasActivePromotionalCode: id ? Boolean(promosMap[id]) : false,
        };
      });

      return augmented as unknown as ICourse[];
    } catch (err) {
      return courses;
    }
  }

  async unenrollStudent(courseId: string, studentId: string): Promise<ICourse> {
    const course = await this.courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Verificar si el estudiante está inscrito
    const students = course.students || [];
    const isEnrolled = students.some((enrolledStudent: any) => {
      const enrolledUserId = enrolledStudent.userId
        ? enrolledStudent.userId.toString()
        : String(enrolledStudent);
      return enrolledUserId === studentId;
    });

    if (!isEnrolled) {
      throw new Error('Student is not enrolled in this course');
    }

    // Eliminar el progreso del estudiante en este curso (incluye progreso de clases y cuestionarios)
    await courseProgressRepository.deleteByUserAndCourse(studentId, courseId);

    // Eliminar todos los envíos de cuestionarios del estudiante para este curso
    await questionnaireSubmissionRepository.deleteByStudentAndCourse(studentId, courseId);

    // Eliminar todos los certificados del estudiante para este curso (comportamiento igual que el admin)
    await certificateRepository.deleteByStudentAndCourse(studentId, courseId);

    // Remover el estudiante del array de estudiantes del curso
    return this.courseRepository.unenrollStudent(courseId, studentId);
  }

  /**
   * Desasocia completamente a un estudiante de un curso (solo admin).
   * Elimina toda la información relacionada con el curso del estudiante:
   * - Inscripción en el curso
   * - Progreso del curso
   * - Envíos de cuestionarios
   * - Certificados
   * @param courseId - ID del curso
   * @param studentId - ID del estudiante a desasociar
   * @returns El curso actualizado
   */
  async unenrollStudentByAdmin(courseId: string, studentId: string): Promise<ICourse> {
    const course = await this.courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // Verificar si el estudiante existe
    const student = await this.userRepository.getUserById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Verificar si el estudiante está inscrito en el curso
    const students = course.students || [];
    const normalizedStudentId = studentId.toString();

    const isEnrolled = students.some((enrolledStudent: any) => {
      const enrolledUserId = enrolledStudent.userId
        ? enrolledStudent.userId.toString()
        : String(enrolledStudent);
      return enrolledUserId === normalizedStudentId;
    });

    if (!isEnrolled) {
      throw new Error('Student is not enrolled in this course');
    }

    // 1. Eliminar el progreso del estudiante en este curso (incluye progreso de clases y cuestionarios)
    await courseProgressRepository.deleteByUserAndCourse(studentId, courseId);

    // 2. Eliminar todos los envíos de cuestionarios del estudiante para este curso
    await questionnaireSubmissionRepository.deleteByStudentAndCourse(studentId, courseId);

    // 3. Eliminar todos los certificados del estudiante para este curso
    await certificateRepository.deleteByStudentAndCourse(studentId, courseId);

    // 4. Remover el estudiante del array de estudiantes del curso
    return this.courseRepository.unenrollStudent(courseId, studentId);
  }

  /**
   * Duplica un curso completo con todas sus clases y cuestionarios.
   * Los archivos (imágenes, videos, PDFs) mantienen los mismos enlaces (no se duplican en Bunny).
   * @param courseId - ID del curso a duplicar
   * @returns El nuevo curso duplicado con sus clases y cuestionarios
   */
  async duplicateCourse(courseId: string): Promise<ICourse> {
    // Verificar que el curso existe
    const originalCourse = await this.courseRepository.findOneById(courseId);
    if (!originalCourse) {
      throw new Error('Course not found');
    }

    // Duplicar el curso con todas sus clases y cuestionarios
    const duplicatedCourse = await this.courseRepository.duplicateCourse(courseId);

    const updateData: Partial<ICourse> = {};
    const programData = await mapCourseToPdfData(duplicatedCourse);
    const generator = new ProgramGeneratorService();
    const pdfUrl = await generator.generateAndUploadProgramPDF(programData, duplicatedCourse.programUrl);
    updateData.programUrl = pdfUrl;
    updateData.programOriginalName = `${programData.course?.name}.pdf`;

    logger.info(`Course duplicated successfully: ${courseId} -> ${duplicatedCourse._id}`, {
      originalCourseId: courseId,
      newCourseId: duplicatedCourse._id,
      classesCount: duplicatedCourse.classes?.length || 0,
      questionnairesCount: duplicatedCourse.questionnaires?.length || 0,
    });

    return duplicatedCourse;
  }

  private async handleTeacherAssignmentChanges(added: string[], removed: string[], course: ICourse) {
    if ((!added || added.length === 0) && (!removed || removed.length === 0)) return;

    // Enviar notificaciones y emails a los profesores añadidos
    for (const teacherId of added) {
      try {
        const user = await this.userRepository.getUserById(teacherId);
        if (!user) continue;

        const title = 'Has sido asignado a un curso';
        const courseTitle = (course as any).title || (course as any).name || '(sin título)';
        const message = `Has sido asignado al curso: ${courseTitle}`;

        // Email
        if (user.email) {
          try {
            const frontendBase = (config.FRONTEND_DOMAIN || '').split(',')[0] || '';
            await sendEmail({
              email: user.email,
              subject: `Has sido asignado al curso: ${courseTitle}`,
              html: `
                <div style="font-family: Inter, Arial, sans-serif; max-width:680px; margin:0 auto; background:#f6f7fb; padding:24px;">
                  <div style="background:#ffffff; border-radius:10px; padding:28px; box-shadow:0 4px 18px rgba(15,23,42,0.06);">
                    <div style="display:flex; gap:12px; align-items:center;">
                      <div style="width:48px; height:48px; border-radius:8px; background:#ecfeff; display:flex; align-items:center; justify-content:center; color:#0ea5e9; font-weight:700;">🎓</div>
                      <div>
                        <h2 style="margin:0; font-size:18px; color:#0f172a;">Has sido asignado a un curso</h2>
                        <p style="margin:6px 0 0; color:#475569; font-size:14px;">Hola <strong>${user.firstName || ''}</strong>, te han asignado como profesor en el curso <strong>${courseTitle}</strong>.</p>
                      </div>
                    </div>
                    <div style="margin-top:18px;">
                      <p style="color:#475569; font-size:14px;">Puedes ver los detalles y gestionar el contenido desde el panel del curso.</p>
                      ${frontendBase ? `<p style="margin-top:18px;"><a href="${frontendBase}/courses/${course._id}" style="display:inline-block; background:#0ea5e9; color:#ffffff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600;">Ver curso</a></p>` : ''}
                    </div>
                    <p style="margin-top:20px; color:#9aa4b2; font-size:12px;">Equipo Cursala</p>
                  </div>
                </div>
              `,
            });
          } catch (err) {
            logger.error(`Error enviando email a ${user._id}: ${(err as Error).message}`);
          }
        }

        // In-app notification removed
      } catch (err) {
        logger.error(`Error procesando teacher added ${teacherId}: ${(err as Error).message}`);
      }
    }

    // Notificar a los profesores removidos
    for (const teacherId of removed) {
      try {
        const user = await this.userRepository.getUserById(teacherId);
        if (!user) continue;

        const title = 'Has sido removido de un curso';
        const courseTitle = (course as any).title || (course as any).name || '(sin título)';
        const message = `Has sido desasignado del curso: ${courseTitle}`;

        if (user.email) {
          try {
            const frontendBase = (config.FRONTEND_DOMAIN || '').split(',')[0] || '';
            await sendEmail({
              email: user.email,
              subject: `Has sido desasignado del curso: ${courseTitle}`,
              html: `
                <div style="font-family: Inter, Arial, sans-serif; max-width:680px; margin:0 auto; background:#f6f7fb; padding:24px;">
                  <div style="background:#ffffff; border-radius:10px; padding:28px; box-shadow:0 4px 18px rgba(15,23,42,0.06);">
                    <div style="display:flex; gap:12px; align-items:center;">
                      <div style="width:48px; height:48px; border-radius:8px; background:#fff7ed; display:flex; align-items:center; justify-content:center; color:#f97316; font-weight:700;">⚠️</div>
                      <div>
                        <h2 style="margin:0; font-size:18px; color:#0f172a;">Has sido desasignado de un curso</h2>
                        <p style="margin:6px 0 0; color:#475569; font-size:14px;">Hola <strong>${user.firstName || ''}</strong>, has sido removido como profesor del curso <strong>${courseTitle}</strong>.</p>
                      </div>
                    </div>
                    <div style="margin-top:18px;">
                      <p style="color:#475569; font-size:14px;">Si crees que esto es un error, contacta al administrador o responde a este correo.</p>
                      ${frontendBase ? `<p style="margin-top:18px;"><a href="${frontendBase}/support" style="display:inline-block; background:#f97316; color:#ffffff; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:600;">Contactar al soporte</a></p>` : ''}
                    </div>
                    <p style="margin-top:20px; color:#9aa4b2; font-size:12px;">Equipo Cursala</p>
                  </div>
                </div>
              `,
            });
          } catch (err) {
            logger.error(`Error enviando email a ${user._id}: ${(err as Error).message}`);
          }
        }

        // In-app notification removed
      } catch (err) {
        logger.error(`Error procesando teacher removed ${teacherId}: ${(err as Error).message}`);
      }
    }
  }
}
