import { CourseProgressModel, ICourseProgress, IClassProgress, IQuestionnaireProgress } from '@/models/mongo/courseProgress.model';
import { CourseSchema } from '@/models/mongo/course.model';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';
import { ClassSchema } from '@/models/mongo/class.model';
import { Schema, Types } from 'mongoose';
import generalConnection from '@/config/databases';

class CourseProgressRepository {
  // Create models with the correct connection
  private Course = generalConnection.model('Course', CourseSchema, 'courses');
  private Questionnaire = generalConnection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
  private Class = generalConnection.model('Class', ClassSchema, 'classes');
  async findByUserAndCourse(userId: string, courseId: string): Promise<ICourseProgress | null> {
    const progress = await CourseProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      courseId: new Types.ObjectId(courseId),
    }).lean();

    if (!progress) return null;

    // Convertir ObjectIds a strings para asegurar serialización correcta
    if (progress.classesProgress) {
      progress.classesProgress = progress.classesProgress.map((cp: any) => ({
        ...cp,
        classId: cp.classId?.toString() || String(cp.classId),
      }));
    }
    
    if (progress.questionnairesProgress) {
      progress.questionnairesProgress = progress.questionnairesProgress.map((qp: any) => ({
        ...qp,
        questionnaireId: qp.questionnaireId?.toString() || String(qp.questionnaireId),
      }));
    }

    return progress as unknown as ICourseProgress;
  }

  /**
   * Obtener todos los progresos de un usuario
   */
  async findAllByUser(userId: string): Promise<ICourseProgress[]> {
    const progressList = await CourseProgressModel.find({
      userId: new Types.ObjectId(userId),
    }).lean();

    // Convertir ObjectIds a strings para asegurar serialización correcta
    return progressList.map((progress: any) => {
      if (progress.classesProgress) {
        progress.classesProgress = progress.classesProgress.map((cp: any) => ({
          ...cp,
          classId: cp.classId?.toString() || String(cp.classId),
        }));
      }
      if (progress.questionnairesProgress) {
        progress.questionnairesProgress = progress.questionnairesProgress.map((qp: any) => ({
          ...qp,
          questionnaireId: qp.questionnaireId?.toString() || String(qp.questionnaireId),
        }));
      }
      return progress;
    });
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
      // Usar getTotalClasses para obtener el valor correcto
      const actualTotalClasses = await this.getTotalClasses(courseId);
      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: new Types.ObjectId(courseId),
        status: 'ACTIVE',
      });

      const completedClasses = classProgress.completed ? 1 : 0;
      const completedQuestionnaires = 0; // No hay cuestionarios completados al crear el progreso

      const totalItems = actualTotalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;
      // Limitar el progreso a máximo 100%
      const initialProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

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
      const progressObj = created.toObject();
      // Convertir ObjectIds a strings
      if (progressObj.classesProgress) {
        progressObj.classesProgress = progressObj.classesProgress.map((cp: any) => ({
          ...cp,
          classId: cp.classId?.toString() || String(cp.classId),
        }));
      }
      return progressObj;
    } else {
      // Actualizar progreso existente
      // Usar findOneAndUpdate para evitar problemas con ObjectIds en subdocumentos
      const existingClassIndex = progress.classesProgress.findIndex(
        (cp) => cp.classId.toString() === classProgress.classId
      );

      let updateOperation: any;
      
      if (existingClassIndex >= 0) {
        // Actualizar clase existente usando $ para encontrar el elemento correcto del array
        const existing = progress.classesProgress[existingClassIndex];
        updateOperation = {
          $set: {
            'classesProgress.$.watchTime': classProgress.watchTime ?? existing.watchTime ?? 0,
            'classesProgress.$.duration': classProgress.duration ?? existing.duration ?? 0,
            'classesProgress.$.completed': classProgress.completed ?? existing.completed ?? false,
            'classesProgress.$.lastWatchedAt': now,
            currentClassId: classId,
            lastAccessedAt: now,
          },
        };
        
        if (classProgress.completed) {
          updateOperation.$set['classesProgress.$.completedAt'] = now;
        } else {
          updateOperation.$set['classesProgress.$.completedAt'] = null;
        }
      } else {
        // Agregar nueva clase al progreso
        updateOperation = {
          $push: {
            classesProgress: {
              classId,
              watchTime: classProgress.watchTime || 0,
              duration: classProgress.duration || 0,
              completed: classProgress.completed || false,
              completedAt: classProgress.completed ? now : undefined,
              lastWatchedAt: now,
            },
          },
          $set: {
            currentClassId: classId,
            lastAccessedAt: now,
          },
        };
      }

      // Recalcular progreso usando los valores correctos de la base de datos
      const actualTotalClasses = await this.getTotalClasses(courseId);
      const activeQuestionnaires = await this.Questionnaire.find({
        courseId: new Types.ObjectId(courseId),
        status: 'ACTIVE',
      }).lean();
      
      const totalQuestionnaires = activeQuestionnaires.length;

      // Obtener el progreso actualizado para calcular correctamente
      const updatedProgress = existingClassIndex >= 0 
        ? {
            ...progress,
            classesProgress: progress.classesProgress.map((cp, idx) => 
              idx === existingClassIndex 
                ? { ...cp, ...classProgress, completedAt: classProgress.completed ? now : cp.completedAt, lastWatchedAt: now }
                : cp
            ),
          }
        : {
            ...progress,
            classesProgress: [...progress.classesProgress, {
              classId: classId,
              watchTime: classProgress.watchTime || 0,
              duration: classProgress.duration || 0,
              completed: classProgress.completed || false,
              completedAt: classProgress.completed ? now : undefined,
              lastWatchedAt: now,
            }],
          };

      // Obtener los IDs de cuestionarios activos para filtrar los completados válidos
      const activeQuestionnaireIds = new Set(activeQuestionnaires.map((q: any) => q._id.toString()));

      // Filtrar clases duplicadas usando un Set de IDs únicos
      const completedClassIds = new Set<string>();
      updatedProgress.classesProgress.forEach((cp) => {
        if (cp.completed && cp.classId) {
          completedClassIds.add(String(cp.classId));
        }
      });
      const completedClasses = completedClassIds.size;
      
      // Filtrar cuestionarios duplicados usando un Set de IDs únicos y asegurando que sigan siendo activos
      const completedQuestionnaireIds = new Set<string>();
      if (updatedProgress.questionnairesProgress) {
        updatedProgress.questionnairesProgress.forEach((qp) => {
          if (qp.completed && qp.questionnaireId) {
            const qid = String(qp.questionnaireId);
            if (activeQuestionnaireIds.has(qid)) {
              completedQuestionnaireIds.add(qid);
            }
          }
        });
      }
      const completedQuestionnaires = completedQuestionnaireIds.size;

      const totalItems = actualTotalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      // Limitar el progreso a máximo 100%
      const overallProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

      updateOperation.$set.overallProgress = overallProgress;

      // Usar el operador $ para encontrar el elemento correcto del array cuando existe
      const query = existingClassIndex >= 0
        ? {
            userId: new Types.ObjectId(userId),
            courseId: new Types.ObjectId(courseId),
            'classesProgress.classId': new Types.ObjectId(classProgress.classId),
          }
        : {
            userId: new Types.ObjectId(userId),
            courseId: new Types.ObjectId(courseId),
          };

      await CourseProgressModel.updateOne(query, updateOperation);

      // Actualizar el objeto progress para retornarlo
      progress.classesProgress = updatedProgress.classesProgress;
      progress.currentClassId = classId;
      progress.overallProgress = overallProgress;
      progress.lastAccessedAt = now;
    }

    // Convertir ObjectIds a strings antes de retornar
    if (progress.classesProgress) {
      progress.classesProgress = progress.classesProgress.map((cp: any) => ({
        ...cp,
        classId: cp.classId?.toString() || String(cp.classId),
      }));
    }
    if (progress.questionnairesProgress) {
      progress.questionnairesProgress = progress.questionnairesProgress.map((qp: any) => ({
        ...qp,
        questionnaireId: qp.questionnaireId?.toString() || String(qp.questionnaireId),
      }));
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

    const normalizedClassId = String(classId);
    const classProgress = progress.classesProgress.find((cp) => {
      const cpClassId = String(cp.classId);
      return cpClassId === normalizedClassId;
    });
    
    return classProgress || null;
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
   * Incluye tanto clases como cuestionarios
   */
  async recalculateOverallProgress(courseId: string, totalClasses?: number): Promise<void> {
    const allProgress = await CourseProgressModel.find({
      courseId: new Types.ObjectId(courseId)
    });

    // Usar getTotalClasses si no se proporciona totalClasses
    const actualTotalClasses = totalClasses !== undefined ? totalClasses : await this.getTotalClasses(courseId);
    const totalQuestionnaires = await this.Questionnaire.countDocuments({
      courseId: new Types.ObjectId(courseId),
      status: 'ACTIVE',
    });

    const totalItems = actualTotalClasses + totalQuestionnaires;

    for (const progress of allProgress) {
      // Filtrar clases duplicadas usando un Set de IDs únicos
      const completedClassIds = new Set<string>();
      progress.classesProgress.forEach((cp: IClassProgress) => {
        if (cp.completed && cp.classId) {
          completedClassIds.add(String(cp.classId));
        }
      });
      const completedClasses = completedClassIds.size;
      
      // Filtrar cuestionarios duplicados usando un Set de IDs únicos
      const completedQuestionnaireIds = new Set<string>();
      if (progress.questionnairesProgress) {
        progress.questionnairesProgress.forEach((qp: IQuestionnaireProgress) => {
          if (qp.completed && qp.questionnaireId) {
            completedQuestionnaireIds.add(String(qp.questionnaireId));
          }
        });
      }
      const completedQuestionnaires = completedQuestionnaireIds.size;
      
      const completedItems = completedClasses + completedQuestionnaires;
      // Limitar el progreso a máximo 100%
      const newOverallProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
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
    score: number,
    forceCompleted?: boolean
  ): Promise<ICourseProgress> {
    const now = new Date();
    const questionnaireObjId = new Types.ObjectId(questionnaireId) as unknown as Schema.Types.ObjectId;

    // Get questionnaire to check passingScore
    const questionnaire = await this.Questionnaire.findById(questionnaireId);
    const passingScore = questionnaire?.passingScore;
    // Only mark as completed if score >= passingScore (or if no passingScore is set, always complete).
    // forceCompleted=true ignores passingScore: el profesor ha marcado explícitamente como aprobado.
    const isPassed = forceCompleted || !passingScore || score >= passingScore;

    // Buscar progreso existente
    let progress = await this.findByUserAndCourse(userId, courseId);

    if (!progress) {
      // Crear nuevo progreso si no existe
      // Get total items to calculate initial progress
      const totalClasses = await this.getTotalClasses(courseId);

      const totalQuestionnaires = await this.Questionnaire.countDocuments({
        courseId: new Types.ObjectId(courseId),
        status: 'ACTIVE',
      });

      const totalItems = totalClasses + totalQuestionnaires;
      // Only count as completed if passed
      const completedItems = isPassed ? 1 : 0;
      // Limitar el progreso a máximo 100%
      const initialProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

      const created = await CourseProgressModel.create({
        userId: new Types.ObjectId(userId),
        courseId: new Types.ObjectId(courseId),
        classesProgress: [],
        questionnairesProgress: [
          {
            questionnaireId: questionnaireObjId,
            completed: isPassed, // isPassed ya incorpora forceCompleted
            bestScore: score,
            attempts: 1,
            lastAttemptAt: now,
          },
        ],
        overallProgress: initialProgress,
        startedAt: now,
        lastAccessedAt: now,
      });
      const progressObj = created.toObject();
      // Convertir ObjectIds a strings
      if (progressObj.questionnairesProgress) {
        progressObj.questionnairesProgress = progressObj.questionnairesProgress.map((qp: any) => ({
          ...qp,
          questionnaireId: qp.questionnaireId?.toString() || String(qp.questionnaireId),
        }));
      }
      return progressObj;
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
        
        // Convert to plain object to avoid Mongoose subdocument issues
        progress.questionnairesProgress[existingQuestionnaireIndex] = {
          questionnaireId: existing.questionnaireId,
          // `completed` es adhesivo: una vez aprobado no se revierte aunque el reintento falle
          completed: existing.completed || isPassed,
          // `bestScore` guarda el máximo histórico, no el último intento
          bestScore: Math.max(existing.bestScore || 0, score),
          attempts: (existing.attempts || 0) + 1,
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
      // Usar getTotalClasses para obtener el valor correcto
      const actualTotalClasses = await this.getTotalClasses(courseId);

      const activeQuestionnaires = await this.Questionnaire.find({
        courseId: new Types.ObjectId(courseId),
        status: 'ACTIVE',
      }).lean();
      
      const totalQuestionnaires = activeQuestionnaires.length;
      const activeQuestionnaireIds = new Set(activeQuestionnaires.map((q: any) => q._id.toString()));

      // Filtrar clases duplicadas usando un Set de IDs únicos
      const completedClassIds = new Set<string>();
      progress.classesProgress.forEach((cp) => {
        if (cp.completed && cp.classId) {
          completedClassIds.add(String(cp.classId));
        }
      });
      const completedClasses = completedClassIds.size;
      
      // Filtrar cuestionarios duplicados usando un Set de IDs únicos y asegurando que sigan siendo activos
      const completedQuestionnaireIds = new Set<string>();
      if (progress.questionnairesProgress) {
        progress.questionnairesProgress.forEach((qp) => {
          if (qp.completed && qp.questionnaireId) {
            const qid = String(qp.questionnaireId);
            if (activeQuestionnaireIds.has(qid)) {
              completedQuestionnaireIds.add(qid);
            }
          }
        });
      }
      const completedQuestionnaires = completedQuestionnaireIds.size;

      const totalItems = actualTotalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      // Limitar el progreso a máximo 100%
      progress.overallProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

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

    // Convertir ObjectIds a strings antes de retornar
    if (progress.classesProgress) {
      progress.classesProgress = progress.classesProgress.map((cp: any) => ({
        ...cp,
        classId: cp.classId?.toString() || String(cp.classId),
      }));
    }
    if (progress.questionnairesProgress) {
      progress.questionnairesProgress = progress.questionnairesProgress.map((qp: any) => ({
        ...qp,
        questionnaireId: qp.questionnaireId?.toString() || String(qp.questionnaireId),
      }));
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

    // Recalcular el progreso general utilizando el método estándar
    const totalClasses = await this.getTotalClasses(courseId);

    const totalQuestionnaires = await this.Questionnaire.countDocuments({
      courseId: new Types.ObjectId(courseId),
      status: 'ACTIVE',
    });

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
      updatedQuestionnairesProgress.forEach((qp) => {
        if (qp.completed && qp.questionnaireId) {
          completedQuestionnaireIds.add(String(qp.questionnaireId));
        }
      });
      const completedQuestionnaires = completedQuestionnaireIds.size;

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      // Limitar el progreso a máximo 100%
      const newOverallProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

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
      // Filtrar clases duplicadas usando un Set de IDs únicos
      const completedClassIds = new Set<string>();
      progress.classesProgress.forEach((cp: any) => {
        if (cp.completed && cp.classId) {
          completedClassIds.add(String(cp.classId));
        }
      });
      const completedClasses = completedClassIds.size;
      
      // Filtrar cuestionarios duplicados usando un Set de IDs únicos
      const completedQuestionnaireIds = new Set<string>();
      progress.questionnairesProgress.forEach((qp: any) => {
        if (qp.completed && qp.questionnaireId) {
          completedQuestionnaireIds.add(String(qp.questionnaireId));
        }
      });
      const completedQuestionnaires = completedQuestionnaireIds.size;

      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;

      // Limitar el progreso a máximo 100%
      const newOverallProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;

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
      courseId: new Types.ObjectId(courseId),
      status: 'ACTIVE',
    });
  }

  /**
   * Obtener el total de clases activas de un curso desde la colección classes
   */
  async getTotalClasses(courseId: string): Promise<number> {
    return this.Class.countDocuments({
      courseId: new Types.ObjectId(courseId),
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

  /**
   * Guardar actualización manual de progreso
   */
  async saveManualUpdate(
    userId: string,
    courseId: string,
    update: { questionnairesProgress?: any[]; classesProgress?: any[]; overallProgress: number }
  ): Promise<void> {
    await CourseProgressModel.updateOne(
      { userId: new Types.ObjectId(userId), courseId: new Types.ObjectId(courseId) },
      { $set: { ...update, lastAccessedAt: new Date() } }
    );
  }

  /**
   * Eliminar todo el progreso de un usuario (cuando se elimina el usuario)
   * @param userId - ID del usuario
   * @returns Número de documentos eliminados
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    const result = await CourseProgressModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount;
  }
}

export const courseProgressRepository = new CourseProgressRepository();
