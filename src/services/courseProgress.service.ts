import { courseProgressRepository, courseRepository } from '@/repositories';
import { ICourseProgress, IClassProgress } from '@/models/mongo/courseProgress.model';

export interface UpdateProgressDto {
  classId: string;
  watchTime?: number;
  duration?: number;
  completed?: boolean;
}

class CourseProgressService {
  /**
   * Obtener el progreso de un usuario en un curso
   */
  async getProgress(userId: string, courseId: string): Promise<ICourseProgress | null> {
    return courseProgressRepository.findByUserAndCourse(userId, courseId);
  }

  /**
   * Obtener todos los progresos de un usuario
   */
  async getAllProgress(userId: string): Promise<ICourseProgress[]> {
    return courseProgressRepository.findAllByUser(userId);
  }

  /**
   * Actualizar el progreso de visualización de un video
   */
  async updateVideoProgress(
    userId: string,
    courseId: string,
    data: UpdateProgressDto
  ): Promise<ICourseProgress> {
    // Obtener el número total de clases del curso
    const course = await courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Curso no encontrado');
    }

    const totalClasses = course.classes?.length || 0;

    // Determinar si el video se considera completado (>90% visto)
    let completed = data.completed || false;
    if (data.watchTime && data.duration && data.duration > 0) {
      const percentWatched = (data.watchTime / data.duration) * 100;
      if (percentWatched >= 90) {
        completed = true;
      }
    }

    return courseProgressRepository.upsert(
      userId,
      courseId,
      {
        classId: data.classId,
        watchTime: data.watchTime,
        duration: data.duration,
        completed,
      },
      totalClasses
    );
  }

  /**
   * Marcar una clase como completada manualmente
   */
  async markClassCompleted(
    userId: string,
    courseId: string,
    classId: string
  ): Promise<ICourseProgress> {
    const course = await courseRepository.findOneById(courseId);
    if (!course) {
      throw new Error('Curso no encontrado');
    }

    const totalClasses = course.classes?.length || 0;

    return courseProgressRepository.markClassCompleted(
      userId,
      courseId,
      classId,
      totalClasses
    );
  }

  /**
   * Obtener el progreso de una clase específica
   */
  async getClassProgress(
    userId: string,
    courseId: string,
    classId: string
  ): Promise<IClassProgress | null> {
    return courseProgressRepository.getClassProgress(userId, courseId, classId);
  }

  /**
   * Verificar si el usuario puede acceder a una clase
   * (debe haber completado las anteriores o ser la primera)
   */
  async canAccessClass(
    userId: string,
    courseId: string,
    classId: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    const course = await courseRepository.findOneById(courseId);
    if (!course) {
      return { canAccess: false, reason: 'Curso no encontrado' };
    }

    const classes = course.classes || [];
    const classIndex = classes.findIndex((c: any) => c._id?.toString() === classId);

    if (classIndex === -1) {
      return { canAccess: false, reason: 'Clase no encontrada' };
    }

    // La primera clase siempre es accesible
    if (classIndex === 0) {
      return { canAccess: true };
    }

    // Verificar que la clase anterior esté completada
    const progress = await this.getProgress(userId, courseId);
    if (!progress) {
      return { canAccess: false, reason: 'Debes completar las clases anteriores' };
    }

    const previousClassId = (classes[classIndex - 1] as any)._id?.toString();
    const previousClassProgress = progress.classesProgress.find(
      (cp) => cp.classId.toString() === previousClassId
    );

    if (!previousClassProgress?.completed) {
      return { canAccess: false, reason: 'Debes completar la clase anterior primero' };
    }

    return { canAccess: true };
  }
}

export const courseProgressService = new CourseProgressService();
