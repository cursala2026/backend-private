import { CourseProgressModel, ICourseProgress, IClassProgress } from '@/models/mongo/courseProgress.model';
import { Schema, Types } from 'mongoose';

class CourseProgressRepository {
  /**
   * Obtener el progreso de un usuario en un curso específico
   */
  async findByUserAndCourse(userId: string, courseId: string): Promise<ICourseProgress | null> {
    return CourseProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      courseId: new Types.ObjectId(courseId),
    }).lean();
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
        currentClassId: classId,
        overallProgress: 0,
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

      // Calcular progreso general
      const completedClasses = progress.classesProgress.filter((cp) => cp.completed).length;
      progress.overallProgress = Math.round((completedClasses / totalClasses) * 100);

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
}

export const courseProgressRepository = new CourseProgressRepository();
