import { NextFunction, Request, Response } from 'express';
import prepareResponse from '@/utils/api-response';
import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';

export default class QuestionnaireSubmissionController {
  constructor(private readonly submissionService: QuestionnaireSubmissionService) {}

  /**
   * Iniciar nuevo envío
   */
  startSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(prepareResponse(401, 'Not authenticated'));
      }

      const { questionnaireId } = req.params;
      const submission = await this.submissionService.startSubmission(user._id.toString(), questionnaireId);

      return res.status(201).json(prepareResponse(201, 'Submission started successfully', submission));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Enviar respuestas
   */
  submitAnswers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submissionId } = req.params;
      const { answers } = req.body;

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json(prepareResponse(400, 'Answers array is required'));
      }

      const submission = await this.submissionService.submitAnswers(submissionId, answers);
      return res.json(prepareResponse(200, 'Answers submitted successfully', submission));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Calificar preguntas de texto
   */
  gradeTextQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(prepareResponse(401, 'Not authenticated'));
      }

      const { submissionId } = req.params;
      const { gradedAnswers, overallFeedback } = req.body;

      if (!gradedAnswers || !Array.isArray(gradedAnswers)) {
        return res.status(400).json(prepareResponse(400, 'Graded answers array is required'));
      }

      const submission = await this.submissionService.gradeTextQuestions(
        submissionId,
        gradedAnswers,
        user._id.toString(),
        overallFeedback
      );

      return res.json(prepareResponse(200, 'Text questions graded successfully', submission));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener envíos de un estudiante
   */
  getStudentSubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId, studentId } = req.params;

      const submissions = await this.submissionService.getStudentSubmissions(studentId, questionnaireId);
      return res.json(prepareResponse(200, 'Student submissions fetched successfully', submissions));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener reporte de calificaciones
   */
  getGradeReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId } = req.params;

      const report = await this.submissionService.getGradeReport(questionnaireId);
      return res.json(prepareResponse(200, 'Grade report fetched successfully', report));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener un envío por ID
   */
  getSubmissionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submissionId } = req.params;

      const submission = await this.submissionService.getSubmissionById(submissionId);
      if (!submission) {
        return res.status(404).json(prepareResponse(404, 'Submission not found'));
      }

      return res.json(prepareResponse(200, 'Submission fetched successfully', submission));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener envíos pendientes de calificación
   */
  getPendingGrading = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId } = req.params;

      const submissions = await this.submissionService.getPendingGrading(questionnaireId);
      return res.json(prepareResponse(200, 'Pending grading fetched successfully', submissions));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener todos los exámenes pendientes de calificar para un profesor
   */
  getPendingGradingByTeacher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(prepareResponse(401, 'Not authenticated'));
      }

      const teacherId = user._id.toString();
      const submissions = await this.submissionService.getPendingGradingByTeacher(teacherId);
      return res.json(prepareResponse(200, 'Pending grading fetched successfully', submissions));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Resetear intentos de un estudiante para un cuestionario
   */
  resetStudentAttempts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId, studentId } = req.params;

      if (!studentId) {
        return res.status(400).json(prepareResponse(400, 'Student ID is required'));
      }

      const result = await this.submissionService.resetStudentAttempts(studentId, questionnaireId);
      return res.json(prepareResponse(200, 'Student attempts reset successfully', result));
    } catch (error) {
      return next(error);
    }
  };
}
