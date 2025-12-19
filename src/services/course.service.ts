import fs from 'fs';
import path from 'path';
import { ICourse, Types } from '@/models';
import CourseRepository from '@/repositories/course.repository';
import UserRepository from '@/repositories/user.repository';
import { courseUploadService } from './course-upload.service';

export default class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository
  ) {}

  async findOneById(id: string) {
    return this.courseRepository.findOneById(id);
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
      }

      // Subir PDF si se proporcionó
      if (programFile) {
        const pdfFileName = await courseUploadService.saveProgramFile(programFile);
        updateData.programUrl = pdfFileName;
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

      // Eliminar imagen anterior
      if (existingCourse.imageUrl) {
        await courseUploadService.deleteCourseImage(existingCourse.imageUrl);
      }
    }

    // Procesar archivo de programa si se proporciona uno nuevo
    if (programFile) {
      // Guardar el PDF en el filesystem local
      const pdfFileName = await courseUploadService.saveProgramFile(programFile);
      updateData.programUrl = pdfFileName;

      // Eliminar programa anterior
      if (existingCourse.programUrl) {
        courseUploadService.deleteProgramFile(existingCourse.programUrl);
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

    // Eliminar el archivo PDF si existe
    if (course.programUrl) {
      courseUploadService.deleteProgramFile(course.programUrl);
    }

    // Eliminar el curso de la base de datos
    return this.courseRepository.delete(id);
  }

  async delete(id: string): Promise<ICourse | null> {
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
}
