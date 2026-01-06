import fs from 'fs';
import path from 'path';
import { ICourse, Types } from '@/models';
import { logger } from '@/utils';
import CourseRepository from '@/repositories/course.repository';
import UserRepository from '@/repositories/user.repository';
import { courseProgressRepository, questionnaireSubmissionRepository, certificateRepository } from '@/repositories';
import { courseUploadService } from './course-upload.service';

export default class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository
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

  async findById(id: string): Promise<ICourse | null> {
    return this.courseRepository.findById(id);
  }

  async update(id: string, updateData: Partial<ICourse>, unsetFields?: string[]): Promise<ICourse> {
    return this.courseRepository.update(id, updateData, unsetFields);
  }

  async create(courseData: Partial<ICourse>): Promise<ICourse> {
    return this.courseRepository.create(courseData);
  }

  /**
   * Crea un curso completo con archivos (imagen y PDF)
   */
  async createCourseWithFiles(
    courseData: Partial<ICourse>,
    imageFile?: Express.Multer.File,
    programFile?: Express.Multer.File
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
      if (programFile) {
        const programUrl = await courseUploadService.uploadProgramFile(programFile);
        updateData.programUrl = programUrl;
        updateData.programOriginalName = programFile.originalname;
      }

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
    imageFile?: Express.Multer.File,
    programFile?: Express.Multer.File
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

    // Procesar archivo de programa si se proporciona uno nuevo
    if (programFile) {
      // Subir el PDF a Bunny CDN
      const programUrl = await courseUploadService.uploadProgramFile(programFile);
      updateData.programUrl = programUrl;
      updateData.programOriginalName = programFile.originalname;

      // Eliminar programa anterior
      if (existingCourse.programUrl) {
        await courseUploadService.deleteProgramFile(existingCourse.programUrl);
      }
    }

    // Realizar la actualización
    return this.courseRepository.update(id, updateData, unsetFields);
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
    return this.courseRepository.findPublishedCourses();
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

  async assignMainTeacher(courseId: string, mainTeacherId: string): Promise<ICourse> {
    // If mainTeacherId is empty or null, remove the main teacher
    if (!mainTeacherId || mainTeacherId === '') {
      return this.courseRepository.assignMainTeacher(courseId, null);
    }

    // Validate that the user exists
    const teacher = await this.userRepository.getUserById(mainTeacherId);
    if (!teacher) {
      throw new Error('El usuario especificado como profesor principal no existe.');
    }

    // Assign the main teacher to the course
    return this.courseRepository.assignMainTeacher(courseId, new Types.ObjectId(mainTeacherId));
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
    return this.courseRepository.getStudentCourses(studentId);
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

    logger.info(`Course duplicated successfully: ${courseId} -> ${duplicatedCourse._id}`, {
      originalCourseId: courseId,
      newCourseId: duplicatedCourse._id,
      classesCount: duplicatedCourse.classes?.length || 0,
      questionnairesCount: duplicatedCourse.questionnaires?.length || 0,
    });

    return duplicatedCourse;
  }
}
