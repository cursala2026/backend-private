import { NextFunction, Request, Response } from 'express';
import prepareResponse from '@/utils/api-response';
import QuestionnaireService from '@/services/questionnaire.service';

export default class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  /**
   * Crear nuevo cuestionario
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(prepareResponse(401, 'Not authenticated'));
      }

      const questionnaireData = req.body;
      const questionnaire = await this.questionnaireService.create(questionnaireData, user._id.toString());

      return res.status(201).json(prepareResponse(201, 'Questionnaire created successfully', questionnaire));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Actualizar cuestionario
   */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updated = await this.questionnaireService.update(id, updateData);
      return res.json(prepareResponse(200, 'Questionnaire updated successfully', updated));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Eliminar cuestionario
   */
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      await this.questionnaireService.delete(id);
      return res.json(prepareResponse(200, 'Questionnaire deleted successfully'));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener cuestionario por ID
   */
  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Only pass studentId if user is a student (ALUMNO), not if they're a professor or admin
      // This ensures professors can see correctOptionId when editing questionnaires
      const isStudent = user?.roles && Array.isArray(user.roles) && 
        user.roles.some((r: any) => String(r).toUpperCase() === 'ALUMNO') &&
        !user.roles.some((r: any) => String(r).toUpperCase() === 'PROFESOR' || String(r).toUpperCase() === 'ADMIN');
      
      const studentId = isStudent ? user?._id?.toString() : undefined;
      const userRoles = user?.roles || [];

      const questionnaire = await this.questionnaireService.findById(id, studentId, userRoles);

      if (!questionnaire) {
        return res.status(404).json(prepareResponse(404, 'Questionnaire not found'));
      }

      return res.json(prepareResponse(200, 'Questionnaire fetched successfully', questionnaire));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Listar cuestionarios por curso
   */
  findByCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;

      const questionnaires = await this.questionnaireService.findByCourseId(courseId);
      return res.json(prepareResponse(200, 'Questionnaires fetched successfully', questionnaires));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Listar cuestionarios por profesor
   */
  findByProfessor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { professorId } = req.params;

      const questionnaires = await this.questionnaireService.findByProfessorId(professorId);
      return res.json(prepareResponse(200, 'Questionnaires fetched successfully', questionnaires));
    } catch (error) {
      return next(error);
    }
  };
}
