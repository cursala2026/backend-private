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

      // Sanitize and whitelist incoming fields to avoid unexpected data
      const body = req.body || {};
      const allowedTopFields = [
        'courseId',
        'title',
        'description',
        'status',
        'position',
        'questions',
        'passingScore',
        'allowRetries',
        'maxRetries',
        'showCorrectAnswers',
        'timeLimitMinutes',
      ];

      const questionnaireData: any = {};
      for (const k of allowedTopFields) {
        if (body[k] !== undefined) questionnaireData[k] = body[k];
      }

      // Sanitize questions if present
      if (Array.isArray(questionnaireData.questions)) {
        questionnaireData.questions = questionnaireData.questions.map((q: any) => {
          const allowedQuestionFields = [
            'type',
            'questionText',
            'promptType',
            'promptMediaUrl',
            'promptMediaProvider',
            'order',
            'points',
            'required',
            'options',
            'correctOptionId',
          ];
          const out: any = {};
          for (const f of allowedQuestionFields) {
            if (q[f] !== undefined) out[f] = q[f];
          }
          return out;
        });
      }

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
      const body = req.body || {};
      const allowedTopFields = [
        'title',
        'description',
        'status',
        'position',
        'questions',
        'passingScore',
        'allowRetries',
        'maxRetries',
        'showCorrectAnswers',
        'timeLimitMinutes',
      ];

      const updateData: any = {};
      for (const k of allowedTopFields) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }

      if (Array.isArray(updateData.questions)) {
        updateData.questions = updateData.questions.map((q: any) => {
          const allowedQuestionFields = [
            'type',
            'questionText',
            'promptType',
            'promptMediaUrl',
            'promptMediaProvider',
            'order',
            'points',
            'required',
            'options',
            'correctOptionId',
          ];
          const out: any = {};
          for (const f of allowedQuestionFields) {
            if (q[f] !== undefined) out[f] = q[f];
          }
          return out;
        });
      }

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

  /**
   * Subir / reemplazar media para una pregunta
   */
  uploadQuestionMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId, questionId } = req.params as any;
      const user = (req as any).user;
      if (!user) return res.status(401).json(prepareResponse(401, 'Not authenticated'));

      // Multer file
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json(prepareResponse(400, 'No file uploaded'));

      // Determine promptType (prefer body, else infer from mimetype)
      const providedType = (req.body.promptType || '').toString().toUpperCase();
      let promptType: 'IMAGE' | 'VIDEO';
      if (providedType === 'IMAGE' || providedType === 'VIDEO') {
        promptType = providedType as any;
      } else if (file.mimetype.startsWith('image/')) {
        promptType = 'IMAGE';
      } else {
        promptType = 'VIDEO';
      }

      // Read file buffer (from disk)
      const fs = await import('fs');
      const buffer = fs.readFileSync(file.path);

      // Call service to upload and update questionnaire
      const updated = await this.questionnaireService.updateQuestionMedia(
        questionnaireId,
        questionId,
        buffer,
        file.originalname,
        promptType
      );

      // Remove temporary file
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        // ignore
      }

      return res.json(prepareResponse(200, 'Media uploaded and question updated', updated));
    } catch (error) {
      return next(error);
    }
  };
}
