import { courseProgressRepository, courseRepository, questionnaireRepository, questionnaireSubmissionRepository } from '@/repositories';
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
    const progress = await courseProgressRepository.findByUserAndCourse(userId, courseId);
    
    // Si hay progreso, recalcular para asegurar que el overallProgress sea correcto
    if (progress) {
      const totalClasses = await courseProgressRepository.getTotalClasses(courseId);
      const totalQuestionnaires = await courseProgressRepository.getTotalQuestionnaires(courseId);
      
      if (totalClasses !== undefined && totalQuestionnaires !== undefined) {
        // Filtrar clases duplicadas usando un Set de IDs únicos
        const completedClassIds = new Set<string>();
        progress.classesProgress.forEach((cp) => {
          if (cp.completed && cp.classId) {
            completedClassIds.add(String(cp.classId));
          }
        });
        const completedClasses = completedClassIds.size;
        
        // Filtrar cuestionarios duplicados usando un Set de IDs únicos
        const completedQuestionnaireIds = new Set<string>();
        if (progress.questionnairesProgress) {
          progress.questionnairesProgress.forEach((qp) => {
            if (qp.completed && qp.questionnaireId) {
              completedQuestionnaireIds.add(String(qp.questionnaireId));
            }
          });
        }
        const completedQuestionnaires = completedQuestionnaireIds.size;
        
        const totalItems = totalClasses + totalQuestionnaires;
        const completedItems = completedClasses + completedQuestionnaires;
        // Limitar el progreso a máximo 100%
        const calculatedProgress = totalItems > 0 
          ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
          : 0;
        
        // Si el progreso calculado es diferente al guardado, actualizarlo
        if (progress.overallProgress !== calculatedProgress) {
          await courseProgressRepository.updateOverallProgress(userId, courseId, calculatedProgress);
          progress.overallProgress = calculatedProgress;
        }
      }
    }
    
    return progress;
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
    // Obtener el número total de clases del curso desde la colección classes
    const totalClasses = await courseProgressRepository.getTotalClasses(courseId);

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
    // Obtener el número total de clases del curso desde la colección classes
    const totalClasses = await courseProgressRepository.getTotalClasses(courseId);

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
   * (debe haber completado las anteriores y los cuestionarios entre clases)
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

    // Verificar que los cuestionarios después de la clase anterior estén completados
    const questionnaires = await questionnaireRepository.findByCourseId(courseId);
    const activeQuestionnaires = questionnaires.filter((q: any) => q.status === 'ACTIVE');
    
    // Buscar cuestionarios que van después de la clase anterior
    const questionnairesAfterPreviousClass = activeQuestionnaires.filter((q: any) => {
      const questionnaireId = q._id?.toString() || q._id;
      const afterClassId = q.position?.afterClassId?.toString() || q.position?.afterClassId;
      return q.position?.type === 'BETWEEN_CLASSES' && afterClassId === previousClassId;
    });

    // Verificar que todos los cuestionarios después de la clase anterior estén completados
    if (questionnairesAfterPreviousClass.length > 0 && progress.questionnairesProgress) {
      for (const questionnaire of questionnairesAfterPreviousClass) {
        const questionnaireId = String(questionnaire._id);
        const questionnaireProgress = progress.questionnairesProgress.find(
          (qp) => qp.questionnaireId.toString() === questionnaireId
        );

        // Verificar si hay un envío pendiente de calificación
        const submissions = await questionnaireSubmissionRepository.findByStudentAndQuestionnaire(
          userId,
          questionnaireId
        );
        
        // Buscar si hay un envío con estado SUBMITTED (pendiente de calificación manual)
        const pendingSubmission = submissions.find(s => s.status === 'SUBMITTED');
        
        if (pendingSubmission) {
          return { 
            canAccess: false, 
            reason: 'Debes esperar a que el profesor califique el examen antes de continuar' 
          };
        }

        if (!questionnaireProgress?.completed) {
          return { 
            canAccess: false, 
            reason: 'Debes completar el cuestionario después de la clase anterior' 
          };
        }
      }
    }

    return { canAccess: true };
  }

  /**
   * Resetear completamente el progreso de un estudiante en un curso
   * Esto elimina:
   * - Progreso de clases (videos vistos)
   * - Progreso de cuestionarios
   * - Todas las submissions de cuestionarios
   */
  async resetStudentProgress(userId: string, courseId: string): Promise<{ success: boolean; deletedSubmissions: number }> {
    // 1. Eliminar todas las submissions de cuestionarios del estudiante en este curso
    const deletedSubmissions = await questionnaireSubmissionRepository.deleteByStudentAndCourse(userId, courseId);

    // 2. Eliminar el progreso completo del curso (incluye clases y cuestionarios)
    const deleted = await courseProgressRepository.deleteByUserAndCourse(userId, courseId);

    return {
      success: deleted,
      deletedSubmissions
    };
  }
}

export const courseProgressService = new CourseProgressService();
