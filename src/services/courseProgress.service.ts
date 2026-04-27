import { courseProgressRepository, courseRepository, questionnaireRepository, questionnaireSubmissionRepository, userRepository } from '@/repositories';
import { ICourseProgress, IClassProgress } from '@/models/mongo/courseProgress.model';
import { ManualUpdateProgressParams } from '@/models/params.model';

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
        // Las encuestas (isSurvey) siempre quedan GRADED, nunca SUBMITTED,
        // pero se guarda la condición por claridad semántica
        if (pendingSubmission && !questionnaire.isSurvey) {
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

  /**
   * Actualizar manualmente el progreso de una clase o cuestionario
   */
  async updateManualProgress(params: ManualUpdateProgressParams): Promise<ICourseProgress> {
    const { userId, courseId, type, itemId, completed, score } = params;

    if (type === 'class') {
      const totalClasses = await courseProgressRepository.getTotalClasses(courseId);
      // upsert ya maneja la creación si no existe y el recálculo de overallProgress
      return courseProgressRepository.upsert(
        userId,
        courseId,
        {
          classId: itemId,
          completed: completed,
        },
        totalClasses
      );
    } else {
      // Para cuestionarios, usamos updateQuestionnaireProgress
      // Si completed es false, pasamos score 0
      const finalScore = completed ? (score ?? 100) : 0;
      
      // Si se está desmarcando: limpiar submissions y actualizar progreso
      if (!completed) {
         // Eliminar todas las submissions de este alumno para este cuestionario
         await questionnaireSubmissionRepository.deleteByStudentAndQuestionnaire(userId, itemId);

         // Actualizar progreso manualmente en false
         const progress = await courseProgressRepository.findByUserAndCourse(userId, courseId);
         if (progress) {
           const questionnairesProgress = progress.questionnairesProgress || [];
           const qpIndex = questionnairesProgress.findIndex(qp => qp.questionnaireId.toString() === itemId);
           
           if (qpIndex >= 0) {
             questionnairesProgress[qpIndex].completed = false;
             questionnairesProgress[qpIndex].bestScore = 0;
             
             const totalClasses = await courseProgressRepository.getTotalClasses(courseId);
             const activeQuestionnaires = await questionnaireRepository.findByCourseId(courseId);
             const totalQuestionnairesCount = activeQuestionnaires.filter((q: any) => q.status === 'ACTIVE').length;
             
             const completedClassIds = new Set(progress.classesProgress.filter(cp => cp.completed).map(cp => cp.classId.toString()));
             const completedQuestionnaireIds = new Set(questionnairesProgress.filter(qp => qp.completed).map(qp => qp.questionnaireId.toString()));
             
             const totalItems = totalClasses + totalQuestionnairesCount;
             const completedItems = completedClassIds.size + completedQuestionnaireIds.size;
             const overallProgress = totalItems > 0 ? Math.min(100, Math.round((completedItems / totalItems) * 100)) : 0;
             
             await courseProgressRepository.saveManualUpdate(userId, courseId, {
               questionnairesProgress,
               overallProgress
             });
             
             return { ...progress, questionnairesProgress, overallProgress };
           }
           // qpIndex < 0: el cuestionario no estaba en el array de progreso todavía;
           // nada que desmarcar, devolver el progreso actual sin tocar nada
           return progress;
         }
         // progress es null: no existe registro de progreso — nada que desmarcar.
         // Crear un registro vacío con completed=false para consistencia.
         return courseProgressRepository.updateQuestionnaireProgress(userId, courseId, itemId, 0);
      }

      // Si se está marcando como completado: crear una submission GRADED para que el alumno
      // no pueda volver a responder el cuestionario (la vista del alumno busca submissions GRADED)
      const existingSubmissions = await questionnaireSubmissionRepository.findByStudentAndQuestionnaire(userId, itemId);
      const hasGraded = existingSubmissions.some((s: any) => s.status === 'GRADED');

      if (!hasGraded) {
        // Obtener datos del alumno para denormalizar en la submission
        const student = await userRepository.findById(userId);
        const now = new Date();
        const attemptNumber = await questionnaireSubmissionRepository.getNextAttemptNumber(userId, itemId);

        await questionnaireSubmissionRepository.create({
          questionnaireId: itemId as any,
          courseId: courseId as any,
          studentId: userId as any,
          studentName: student ? `${student.firstName} ${student.lastName}` : '',
          studentEmail: student?.email || '',
          profilePhotoUrl: student?.profilePhotoUrl || '',
          attemptNumber,
          answers: [],
          status: 'GRADED',
          autoGradedScore: finalScore,
          finalScore: finalScore,
          manualGradedScore: finalScore,
          gradedAt: now,
          feedback: 'Aprobado manualmente por el profesor',
          startedAt: now,
          submittedAt: now,
        });
      } else {
        // Ya existe una submission GRADED; actualizarla con la nueva nota
        const gradedSub = existingSubmissions.find((s: any) => s.status === 'GRADED') as any;
        await questionnaireSubmissionRepository.update(gradedSub._id.toString(), {
          autoGradedScore: finalScore,
          finalScore: finalScore,
          manualGradedScore: finalScore,
          feedback: 'Aprobado manualmente por el profesor',
        });
      }

      // forceCompleted=true: el profesor está marcando explícitamente como aprobado,
      // independientemente del passingScore configurado en el cuestionario.
      return courseProgressRepository.updateQuestionnaireProgress(
        userId,
        courseId,
        itemId,
        finalScore,
        true
      );
    }
  }
}

export const courseProgressService = new CourseProgressService();
