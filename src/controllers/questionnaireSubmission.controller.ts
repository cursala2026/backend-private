import { NextFunction, Request, Response } from 'express';
import prepareResponse from '@/utils/api-response';
import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';
import { ensureString } from '@/utils/type-guards';

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

      const questionnaireId = ensureString(req.params.questionnaireId);
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
      const submissionId = ensureString(req.params.submissionId);
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

      const submissionId = ensureString(req.params.submissionId);
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
      const questionnaireId = ensureString(req.params.questionnaireId);
      const studentId = ensureString(req.params.studentId);

      // Recuperar studentId si el frontend envío un objeto accidentalmente (por ejemplo '[object Object]')
      let sid: any = studentId;
      if (!sid || String(sid) === '[object Object]') {
        if (req.body && typeof req.body.studentId === 'string') sid = req.body.studentId;
        else if (req.body && typeof req.body.student === 'object') sid = req.body.student._id || req.body.student.id;
        else if (req.query && typeof req.query.studentId === 'string') sid = req.query.studentId;
      }

      const isValidObjectId = (id: any) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
      if (!sid || !isValidObjectId(sid)) {
        return res.status(400).json(prepareResponse(400, 'El ID de estudiante es requerido y debe ser un ObjectId válido'));
      }

      const submissions = await this.submissionService.getStudentSubmissions(sid, questionnaireId);
      return res.json(prepareResponse(200, 'Envíos del estudiante obtenidos correctamente', submissions));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener reporte de calificaciones
   */
  getGradeReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionnaireId = ensureString(req.params.questionnaireId);

      const report = await this.submissionService.getGradeReport(questionnaireId);
      return res.json(prepareResponse(200, 'Grade report fetched successfully', report));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener envíos pendientes de calificación para un cuestionario
   */
  getPendingGrading = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionnaireId = ensureString(req.params.questionnaireId);
      const pending = await this.submissionService.getPendingByQuestionnaire(questionnaireId);
      return res.json(prepareResponse(200, 'Pending submissions fetched successfully', pending));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener envíos pendientes de calificación para el profesor (todas sus encuestas)
   */
  getPendingGradingByTeacher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json(prepareResponse(401, 'Not authenticated'));

      const teacherId = String(user._id);
      const pending = await this.submissionService.getPendingForTeacher(teacherId);
      return res.json(prepareResponse(200, 'Pending submissions for teacher fetched successfully', pending));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Obtener un envío por ID
   */
  getSubmissionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submissionId = ensureString(req.params.submissionId);

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
   * Resetear intentos de un estudiante para un cuestionario
   */
  resetStudentAttempts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionnaireId = ensureString(req.params.questionnaireId);
      let studentId: any = ensureString(req.params.studentId);

      // If frontend accidentally passed an object, try to recover from body or query
      if (!studentId || String(studentId) === '[object Object]') {
        if (req.body && typeof req.body.studentId === 'string') studentId = req.body.studentId;
        else if (req.body && typeof req.body.student === 'object') studentId = req.body.student._id || req.body.student.id;
        else if (req.query && typeof req.query.studentId === 'string') studentId = req.query.studentId;
      }

      // Validate basic ObjectId shape (24 hex chars)
      const isValidObjectId = (id: any) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);

      if (!studentId || !isValidObjectId(studentId)) {
        return res.status(400).json(prepareResponse(400, 'Student ID is required and must be a valid ObjectId'));
      }

      const result = await this.submissionService.resetStudentAttempts(studentId, questionnaireId);
      return res.json(prepareResponse(200, 'Student attempts reset successfully', result));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Eliminar todos los envíos de un cuestionario (administrador)
   */
  deleteAllByQuestionnaire = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionnaireId = ensureString(req.params.questionnaireId);
      const result = await this.submissionService.deleteAllByQuestionnaire(questionnaireId);
      return res.json(prepareResponse(200, 'All questionnaire submissions deleted successfully', result));
    } catch (error) {
      return next(error);
    }
  };
}
