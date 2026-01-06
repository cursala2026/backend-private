import { Request, Response, NextFunction } from 'express';
import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import { hasAdminRole } from '@/middlewares/adminSecurity.middleware';

/**
 * Middleware para verificar si el usuario es admin o dueño del cuestionario
 * (profesor principal del curso al que pertenece el cuestionario)
 * @param questionnaireRepository  Repositorio de cuestionarios
 */
export function requireAdminOrQuestionnaireOwner(questionnaireRepository: QuestionnaireRepository) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req as any;
      const questionnaireId = req.params.id || req.params.questionnaireId;

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

      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin or questionnaire creator can perform this action.',
      });
    } catch (error) {
      return next(error);
    }
  };
}
