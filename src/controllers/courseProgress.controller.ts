import { Request, Response } from 'express';
import { courseProgressService } from '@/services/courseProgress.service';
import { IUser } from '@/models';
import { ManualUpdateProgressParams } from '@/models/params.model';
import { ensureString } from '@/utils/type-guards';

class CourseProgressController {
  /**
   * GET /progress/:courseId
   * Obtener el progreso del usuario en un curso
   */
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      const courseId = ensureString(req.params.courseId);
      const { userId: queryUserId } = req.query;

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      // Si se proporciona un userId en la query y el solicitante es admin/profesor, 
      // usar ese userId en lugar del del usuario autenticado
      let targetUserId = user._id.toString();
      if (queryUserId) {
        const userRoles: string[] = (user as any).roles || [];
        const isAdminOrTeacher = userRoles.includes('ADMIN') || userRoles.includes('PROFESOR');
        if (isAdminOrTeacher) {
          targetUserId = queryUserId.toString();
        }
      }

      const progress = await courseProgressService.getProgress(
        targetUserId,
        courseId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el progreso',
      });
    }
  }

  /**
   * GET /progress
   * Obtener todos los progresos del usuario
   */
  async getAllProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      const progress = await courseProgressService.getAllProgress(user._id.toString());

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el progreso',
      });
    }
  }

  /**
   * POST /progress/:courseId
   * Actualizar el progreso de visualización de un video
   */
  async updateProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      const courseId = ensureString(req.params.courseId);
      const { classId, watchTime, duration, completed } = req.body;

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      if (!classId) {
        res.status(400).json({ success: false, message: 'classId es requerido' });
        return;
      }

      const progress = await courseProgressService.updateVideoProgress(
        user._id.toString(),
        courseId,
        {
          classId,
          watchTime,
          duration,
          completed,
        }
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar el progreso',
      });
    }
  }

  /**
   * POST /progress/:courseId/complete/:classId
   * Marcar una clase como completada
   */
  async markCompleted(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      const courseId = ensureString(req.params.courseId);
      const classId = ensureString(req.params.classId);

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      const progress = await courseProgressService.markClassCompleted(
        user._id.toString(),
        courseId,
        classId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al marcar la clase como completada',
      });
    }
  }

  /**
   * GET /progress/:courseId/class/:classId
   * Obtener el progreso de una clase específica
   */
  async getClassProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      const courseId = ensureString(req.params.courseId);
      const classId = ensureString(req.params.classId);

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      const classProgress = await courseProgressService.getClassProgress(
        user._id.toString(),
        courseId,
        classId
      );

      res.json({
        success: true,
        data: classProgress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el progreso de la clase',
      });
    }
  }

  /**
   * GET /progress/:courseId/can-access/:classId
   * Verificar si el usuario puede acceder a una clase
   */
  async canAccessClass(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      const courseId = ensureString(req.params.courseId);
      const classId = ensureString(req.params.classId);

      if (!user?._id) {
        res.status(401).json({ success: false, message: 'No autorizado' });
        return;
      }

      const result = await courseProgressService.canAccessClass(
        user._id.toString(),
        courseId,
        classId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al verificar acceso',
      });
    }
  }

  /**
   * DELETE /progress/:courseId/student/:userId
   * Resetear completamente el progreso de un estudiante en un curso
   */
  async resetStudentProgress(req: Request, res: Response): Promise<void> {
    try {
      const courseId = ensureString(req.params.courseId);
      const userId = ensureString(req.params.userId);

      if (!userId || !courseId) {
        res.status(400).json({
          success: false,
          message: 'userId y courseId son requeridos',
        });
        return;
      }

      const result = await courseProgressService.resetStudentProgress(userId, courseId);

      res.json({
        success: true,
        message: 'Progreso del estudiante reseteado exitosamente',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al resetear el progreso del estudiante',
      });
    }
  }

  /**
   * PATCH /progress/manual-update
   * Actualizar manualmente el progreso de una clase o cuestionario de un alumno
   */
  async updateManualProgress(req: Request, res: Response): Promise<void> {
    try {
      const { userId, courseId, type, itemId, completed, score } = req.body;

      if (!userId || !courseId || !type || !itemId) {
        res.status(400).json({
          success: false,
          message: 'userId, courseId, type e itemId son requeridos',
        });
        return;
      }

      const params: ManualUpdateProgressParams = {
        userId,
        courseId,
        type,
        itemId,
        completed: !!completed,
        score: score !== undefined ? Number(score) : undefined
      };

      const progress = await courseProgressService.updateManualProgress(params);

      res.json({
        success: true,
        message: 'Progreso actualizado manualmente con éxito',
        data: progress,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar manualmente el progreso',
      });
    }
  }
}

export const courseProgressController = new CourseProgressController();
