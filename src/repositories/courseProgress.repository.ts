import { CourseProgressModel, ICourseProgress, IClassProgress } from '@/models/mongo/courseProgress.model';
import { CourseSchema } from '@/models/mongo/course.model';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';
import { Schema, Types } from 'mongoose';
import generalConnection from '@/config/databases';

class CourseProgressRepository {
  // Create models with the correct connection
  private Course = generalConnection.model('Course', CourseSchema, 'courses');
  private Questionnaire = generalConnection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
  /**
   * Obtener el progreso de un usuario en un curso específico
   */
  async findByUserAndCourse(userId: string, courseId: string): Promise<ICourseProgress | null> {
    const progress = await CourseProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      courseId: new Types.ObjectId(courseId),
    }).lean();

    // Ensure questionnairesProgress exists for backward compatibility with old documents
    if (progress && !progress.questionnairesProgress) {
      progress.questionnairesProgress = [];
    }

    return progress;
  }

  /**
   * Obtener todos los progresos de un usuario
   */
  async findAllByUser(userId: string): Promise<ICourseProgress[]> {
    return CourseProgressModel.find({
      userId: new Types.ObjectId(userId),
    }).lean();
  }

  /**
   * Crear o actualizar el progreso de un usuario en un curso
   */
  async upsert(
    userId: string,
    courseId: string,
    classProgress: { classId: string; watchTime?: number; duration?: number; completed?: boolean },
    totalClasses: number
  ): Promise<ICourseProgress> {
    const now = new Date();
    const classId = new Types.ObjectId(classProgress.classId) as unknown as Schema.Types.ObjectId;

    // Buscar progreso existente
    let progress = await this.findByUserAndCourse(userId, courseId);

    if (!progress) {
      // Crear nuevo progreso
      // Calcular progreso general incluyendo cuestionarios desde el inicio
      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: courseId as any,
        status: 'ACTIVE',
      });

      const completedClasses = classProgress.completed ? 1 : 0;
      const completedQuestionnaires = 0; // No hay cuestionarios completados al crear el progreso

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;
      const initialProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const created = await CourseProgressModel.create({
        userId: new Types.ObjectId(userId),
        courseId: new Types.ObjectId(courseId),
        classesProgress: [
          {
            classId,
            watchTime: classProgress.watchTime || 0,
            duration: classProgress.duration || 0,
            completed: classProgress.completed || false,
            completedAt: classProgress.completed ? now : undefined,
            lastWatchedAt: now,
          },
        ],
        questionnairesProgress: [],
        currentClassId: classId,
        overallProgress: initialProgress,
        startedAt: now,
        lastAccessedAt: now,
      });
      return created.toObject();
    } else {
      // Actualizar progreso existente
      const existingClassIndex = progress.classesProgress.findIndex(
        (cp) => cp.classId.toString() === classProgress.classId
      );

      if (existingClassIndex >= 0) {
        // Actualizar clase existente
        const existing = progress.classesProgress[existingClassIndex];
        progress.classesProgress[existingClassIndex] = {
          ...existing,
          watchTime: classProgress.watchTime ?? existing.watchTime,
          duration: classProgress.duration ?? existing.duration,
          completed: classProgress.completed ?? existing.completed,
          completedAt: classProgress.completed ? now : existing.completedAt,
          lastWatchedAt: now,
        };
      } else {
        // Agregar nueva clase al progreso
        progress.classesProgress.push({
          classId,
          watchTime: classProgress.watchTime || 0,
          duration: classProgress.duration || 0,
          completed: classProgress.completed || false,
          completedAt: classProgress.completed ? now : undefined,
          lastWatchedAt: now,
        });
      }

      progress.currentClassId = classId;
      progress.lastAccessedAt = now;

      // Calcular progreso general incluyendo cuestionarios
      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: courseId as any,
        status: 'ACTIVE',
      });

      const completedClasses = progress.classesProgress.filter((cp) => cp.completed).length;
      const completedQuestionnaires = progress.questionnairesProgress
        ? progress.questionnairesProgress.filter((qp) => qp.completed).length
        : 0;

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      progress.overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      await CourseProgressModel.updateOne(
        { userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(courseId) },
        {
          $set: {
            classesProgress: progress.classesProgress,
            currentClassId: progress.currentClassId,
            overallProgress: progress.overallProgress,
            lastAccessedAt: progress.lastAccessedAt,
          },
        }
      );
    }

    return progress;
  }

  /**
   * Marcar una clase como completada
   */
  async markClassCompleted(
    userId: string,
    courseId: string,
    classId: string,
    totalClasses: number
  ): Promise<ICourseProgress> {
    return this.upsert(
      userId,
      courseId,
      {
        classId,
        completed: true,
      },
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
    const progress = await this.findByUserAndCourse(userId, courseId);
    if (!progress) return null;

    return (
      progress.classesProgress.find((cp) => cp.classId.toString() === classId) || null
    );
  }

  /**
   * Eliminar el progreso de una clase específica de todos los usuarios
   * Se usa cuando se elimina una clase del curso
   */
  async removeClassFromAllProgress(courseId: string, classId: string): Promise<number> {
    const result = await CourseProgressModel.updateMany(
      { courseId: new Types.ObjectId(courseId) },
      {
        $pull: {
          classesProgress: { classId: new Types.ObjectId(classId) }
        }
      }
    );
    return result.modifiedCount;
  }

  /**
   * Resetear el progreso de una clase específica (cuando se cambia el video)
   * Mantiene la clase en el progreso pero resetea watchTime, duration y completed
   */
  async resetClassProgress(courseId: string, classId: string): Promise<number> {
    const result = await CourseProgressModel.updateMany(
      { 
        courseId: new Types.ObjectId(courseId),
        'classesProgress.classId': new Types.ObjectId(classId)
      },
      {
        $set: {
          'classesProgress.$.watchTime': 0,
          'classesProgress.$.duration': 0,
          'classesProgress.$.completed': false,
          'classesProgress.$.completedAt': null,
          'classesProgress.$.lastWatchedAt': new Date()
        }
      }
    );
    return result.modifiedCount;
  }

  /**
   * Recalcular el progreso general de un curso para todos los usuarios
   */
  async recalculateOverallProgress(courseId: string, totalClasses: number): Promise<void> {
    const allProgress = await CourseProgressModel.find({
      courseId: new Types.ObjectId(courseId)
    });

    for (const progress of allProgress) {
      const completedClasses = progress.classesProgress.filter((cp: IClassProgress) => cp.completed).length;
      const newOverallProgress = totalClasses > 0 
        ? Math.round((completedClasses / totalClasses) * 100) 
        : 0;

      await CourseProgressModel.updateOne(
        { _id: progress._id },
        { $set: { overallProgress: newOverallProgress } }
      );
    }
  }

  /**
   * Eliminar todo el progreso de un curso (cuando se elimina el curso)
   */
  async deleteAllByCourseId(courseId: string): Promise<number> {
    const result = await CourseProgressModel.deleteMany({
      courseId: new Types.ObjectId(courseId)
    });
    return result.deletedCount;
  }

  /**
   * Eliminar el progreso de un usuario en un curso específico (cuando se desinscribe)
   */
  async deleteByUserAndCourse(userId: string, courseId: string): Promise<boolean> {
    const result = await CourseProgressModel.deleteOne({
      userId: new Types.ObjectId(userId),
      courseId: new Types.ObjectId(courseId)
    });
    return result.deletedCount > 0;
  }

  /**
   * Actualizar el progreso de un cuestionario
   * @param userId - ID del usuario
   * @param courseId - ID del curso
   * @param questionnaireId - ID del cuestionario
   * @param score - Puntaje obtenido (0-100)
   */
  async updateQuestionnaireProgress(
    userId: string,
    courseId: string,
    questionnaireId: string,
    score: number
  ): Promise<ICourseProgress> {
    const now = new Date();
    const questionnaireObjId = new Types.ObjectId(questionnaireId) as unknown as Schema.Types.ObjectId;

    // Get questionnaire to check passingScore
    const questionnaire = await this.Questionnaire.findById(questionnaireId);
    const passingScore = questionnaire?.passingScore;
    // Only mark as completed if score >= passingScore (or if no passingScore is set, always complete)
    const isPassed = !passingScore || score >= passingScore;

    // Buscar progreso existente
    let progress = await this.findByUserAndCourse(userId, courseId);

    if (!progress) {
      // Crear nuevo progreso si no existe
      // Get total items to calculate initial progress
      const course = await this.Course.findById(new Types.ObjectId(courseId));
      const totalClasses = course?.classes?.length || 0;

      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: new Types.ObjectId(courseId),
        status: 'ACTIVE',
      });

      const totalItems = totalClasses + totalQuestionnaires;
      // Only count as completed if passed
      const completedItems = isPassed ? 1 : 0;
      const initialProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const created = await CourseProgressModel.create({
        userId: new Types.ObjectId(userId),
        courseId: new Types.ObjectId(courseId),
        classesProgress: [],
        questionnairesProgress: [
          {
            questionnaireId: questionnaireObjId,
            completed: isPassed,
            bestScore: score,
            attempts: 1,
            lastAttemptAt: now,
          },
        ],
        overallProgress: initialProgress,
        startedAt: now,
        lastAccessedAt: now,
      });
      return created.toObject();
    } else {
      // Actualizar progreso existente
      // Ensure questionnairesProgress array exists (for backward compatibility)
      if (!progress.questionnairesProgress) {
        progress.questionnairesProgress = [];
      }

      const existingQuestionnaireIndex = progress.questionnairesProgress.findIndex(
        (qp) => qp.questionnaireId.toString() === questionnaireId
      );

      if (existingQuestionnaireIndex >= 0) {
        // Actualizar cuestionario existente
        const existing = progress.questionnairesProgress[existingQuestionnaireIndex];
        const newBestScore = Math.max(existing.bestScore || 0, score);
        // Only mark as completed if the new best score passes (or if already completed)
        const shouldBeCompleted = isPassed || existing.completed;

        // Convert to plain object to avoid Mongoose subdocument issues
        progress.questionnairesProgress[existingQuestionnaireIndex] = {
          questionnaireId: existing.questionnaireId,
          completed: shouldBeCompleted,
          bestScore: newBestScore,
          attempts: existing.attempts + 1,
          lastAttemptAt: now,
        };
      } else {
        // Agregar nuevo cuestionario al progreso
        progress.questionnairesProgress.push({
          questionnaireId: questionnaireObjId,
          completed: isPassed,
          bestScore: score,
          attempts: 1,
          lastAttemptAt: now,
        });
      }

      progress.lastAccessedAt = now;

      // Recalculate overall progress including both classes and questionnaires
      const course = await this.Course.findById(courseId as any);
      const totalClasses = course?.classes?.length || 0;

      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: courseId as any,
        status: 'ACTIVE',
      });

      const completedClasses = progress.classesProgress.filter((cp) => cp.completed).length;
      const completedQuestionnaires = progress.questionnairesProgress
        ? progress.questionnairesProgress.filter((qp) => qp.completed).length
        : 0;

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      progress.overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      await CourseProgressModel.updateOne(
        { userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(courseId) },
        {
          $set: {
            questionnairesProgress: progress.questionnairesProgress,
            overallProgress: progress.overallProgress,
            lastAccessedAt: progress.lastAccessedAt,
          },
        }
      );
    }

    return progress;
  }

  /**
   * Verificar si un usuario puede acceder a una clase
   * Chequea si los cuestionarios previos están completados
   * @param userId - ID del usuario
   * @param courseId - ID del curso
   * @param classId - ID de la clase que se quiere acceder
   * @param questionnairesBefore - Array de IDs de cuestionarios que bloquean esta clase
   * @returns Objeto con canAccess y opcional blockingItem
   */
  async canAccessClass(
    userId: string,
    courseId: string,
    classId: string,
    questionnairesBefore: string[]
  ): Promise<{ canAccess: boolean; blockingItem?: string }> {
    if (questionnairesBefore.length === 0) {
      return { canAccess: true };
    }

    const progress = await this.findByUserAndCourse(userId, courseId);
    if (!progress) {
      return { canAccess: false, blockingItem: 'No progress found' };
    }

    // Verificar que todos los cuestionarios previos estén completados
    for (const questionnaireId of questionnairesBefore) {
      const questionnaireProgress = progress.questionnairesProgress.find(
        (qp) => qp.questionnaireId.toString() === questionnaireId
      );

      if (!questionnaireProgress || !questionnaireProgress.completed) {
        return { canAccess: false, blockingItem: `Questionnaire ${questionnaireId}` };
      }
    }

    return { canAccess: true };
  }

  /**
   * Eliminar el progreso de un cuestionario específico de un estudiante
   * @param userId - ID del usuario
   * @param courseId - ID del curso
   * @param questionnaireId - ID del cuestionario
   */
  async removeQuestionnaireProgress(
    userId: string,
    courseId: string,
    questionnaireId: string
  ): Promise<void> {
    const progress = await this.findByUserAndCourse(userId, courseId);
    if (!progress) {
      return; // No hay progreso para eliminar
    }

    // Eliminar el cuestionario del array de progreso
    const updatedQuestionnairesProgress = progress.questionnairesProgress.filter(
      (qp) => qp.questionnaireId.toString() !== questionnaireId
    );

    // Recalcular el progreso general
    const course = await this.Course.findById(new Types.ObjectId(courseId));
    const totalClasses = course?.classes?.length || 0;

    const totalQuestionnaires = await this.Questionnaire.countDocuments({
      courseId: new Types.ObjectId(courseId),
      status: 'ACTIVE',
    });

    const completedClasses = progress.classesProgress.filter((cp) => cp.completed).length;
    const completedQuestionnaires = updatedQuestionnairesProgress.filter((qp) => qp.completed).length;

    const totalItems = totalClasses + totalQuestionnaires;
    const completedItems = completedClasses + completedQuestionnaires;

    const newOverallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Actualizar el progreso
    await CourseProgressModel.updateOne(
      { userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(courseId) },
      {
        $set: {
          questionnairesProgress: updatedQuestionnairesProgress,
          overallProgress: newOverallProgress,
        },
      }
    );
  }

  /**
   * Recalcular el progreso general de un curso incluyendo cuestionarios
   * @param courseId - ID del curso
   * @param totalClasses - Total de clases en el curso
   * @param totalQuestionnaires - Total de cuestionarios en el curso
   */
  async recalculateOverallProgressWithQuestionnaires(
    courseId: string,
    totalClasses: number,
    totalQuestionnaires: number
  ): Promise<void> {
    const allProgress = await CourseProgressModel.find({
      courseId: new Types.ObjectId(courseId),
    });

    for (const progress of allProgress) {
      const completedClasses = progress.classesProgress.filter((cp: any) => cp.completed).length;
      const completedQuestionnaires = progress.questionnairesProgress.filter((qp: any) => qp.completed).length;

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      const newOverallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      await CourseProgressModel.updateOne(
        { _id: progress._id },
        { $set: { overallProgress: newOverallProgress } }
      );
    }
  }

  /**
   * Obtener el total de cuestionarios activos de un curso
   */
  async getTotalQuestionnaires(courseId: string): Promise<number> {
    return this.Questionnaire.countDocuments({
      courseId: courseId as any,
      status: 'ACTIVE',
    });
  }

  /**
   * Actualizar solo el overallProgress de un progreso específico
   */
  async updateOverallProgress(
    userId: string,
    courseId: string,
    overallProgress: number
  ): Promise<void> {
    await CourseProgressModel.updateOne(
      { userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(courseId) },
      { $set: { overallProgress } }
    );
  }
}

export const courseProgressRepository = new CourseProgressRepository();
