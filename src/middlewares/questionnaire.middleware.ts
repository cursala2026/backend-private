import { Request, Response, NextFunction } from 'express';
import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import { hasAdminRole } from '@/middlewares/adminSecurity.middleware';
import { Course } from '@/models/mongo/course.model';
import { IUser } from '@/models/user.model';
import { ensureString } from '@/utils/type-guards';

/**
 * Middleware para verificar si el usuario es admin o dueño del cuestionario
 * (profesor principal del curso al que pertenece el cuestionario)
 * @param questionnaireRepository  Repositorio de cuestionarios
 */
export function requireAdminOrQuestionnaireOwner(questionnaireRepository: QuestionnaireRepository) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req as any;
      const questionnaireId = ensureString(req.params.questionnaireId);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      // Check if admin
      if (await hasAdminRole(user)) {
        return next();
      }

      const questionnaire = await questionnaireRepository.findById(questionnaireId);
      if (!questionnaire) {
        return res.status(404).json({ success: false, message: 'Questionnaire not found' });
      }

      const userId = String(user._id);
      const creatorId = questionnaire.createdBy ? String(questionnaire.createdBy) : null;

      if (creatorId === userId) {
        return next();
      }

      // Allow professors assigned to the course (course.teachers) to edit the questionnaire
      try {
        if (questionnaire.courseId) {
          const course = await Course.findById(questionnaire.courseId).exec();
          if (course && Array.isArray((course as any).teachers)) {
            const teacherIds = (course as any).teachers.map((t: any) => String(t));
            if (teacherIds.includes(userId)) return next();
          }
        }
      } catch (err) {
        // ignore errors here and fall through to deny if something goes wrong fetching the course
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin or questionnaire creator can perform this action.',
      });
    } catch (error) {
      return next(error);
    }
  };
}
