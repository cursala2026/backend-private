import { Request, Response, NextFunction } from 'express';
import QuestionnaireSubmissionController from '../questionnaireSubmission.controller';
import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';

jest.mock('@/services/questionnaireSubmission.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('QuestionnaireSubmissionController', () => {
  let controller: QuestionnaireSubmissionController;
  let mockService: jest.Mocked<QuestionnaireSubmissionService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const VALID_OID = 'a1b2c3d4e5f6a1b2c3d4e5f6'; // 24 hex chars
  const mockSubmission = { _id: 'sub-1', questionnaireId: 'q-1', userId: 'user-1' };
  const mockUser = { _id: 'user-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new QuestionnaireSubmissionService({} as any, {} as any) as jest.Mocked<QuestionnaireSubmissionService>;
    controller = new QuestionnaireSubmissionController(mockService);
    req = { body: {}, params: {}, query: {}, user: mockUser as any };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  // ─────────────────────────────────────────
  describe('startSubmission', () => {
    it('should start a submission successfully', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.startSubmission.mockResolvedValue(mockSubmission as any);

      await controller.startSubmission(req as Request, res as Response, next);

      expect(mockService.startSubmission).toHaveBeenCalledWith('user-1', 'q-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201, data: mockSubmission }));
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { questionnaireId: 'q-1' };

      await controller.startSubmission(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockService.startSubmission).not.toHaveBeenCalled();
    });

    it('should call next on service error', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.startSubmission.mockRejectedValue(new Error('fail'));

      await controller.startSubmission(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('submitAnswers', () => {
    it('should submit answers successfully', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { answers: [{ questionId: 'q1', answer: 'A' }] };
      mockService.submitAnswers.mockResolvedValue(mockSubmission as any);

      await controller.submitAnswers(req as Request, res as Response, next);

      expect(mockService.submitAnswers).toHaveBeenCalledWith('sub-1', req.body.answers);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if answers is missing', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = {};

      await controller.submitAnswers(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.submitAnswers).not.toHaveBeenCalled();
    });

    it('should return 400 if answers is not an array', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { answers: 'not-an-array' };

      await controller.submitAnswers(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next on service error', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { answers: [] };
      mockService.submitAnswers.mockRejectedValue(new Error('fail'));

      await controller.submitAnswers(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('gradeTextQuestions', () => {
    it('should grade text questions successfully', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { gradedAnswers: [{ questionId: 'q1', score: 5 }], overallFeedback: 'Good' };
      mockService.gradeTextQuestions.mockResolvedValue(mockSubmission as any);

      await controller.gradeTextQuestions(req as Request, res as Response, next);

      expect(mockService.gradeTextQuestions).toHaveBeenCalledWith(
        'sub-1',
        req.body.gradedAnswers,
        'user-1',
        'Good'
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { submissionId: 'sub-1' };

      await controller.gradeTextQuestions(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockService.gradeTextQuestions).not.toHaveBeenCalled();
    });

    it('should return 400 if gradedAnswers is not an array', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { gradedAnswers: 'wrong' };

      await controller.gradeTextQuestions(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next on service error', async () => {
      req.params = { submissionId: 'sub-1' };
      req.body = { gradedAnswers: [] };
      mockService.gradeTextQuestions.mockRejectedValue(new Error('fail'));

      await controller.gradeTextQuestions(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('getStudentSubmissions', () => {
    it('should return submissions with valid ObjectId from params', async () => {
      req.params = { questionnaireId: 'q-1', studentId: VALID_OID };
      const submissions = [mockSubmission];
      mockService.getStudentSubmissions.mockResolvedValue(submissions as any);

      await controller.getStudentSubmissions(req as Request, res as Response, next);

      expect(mockService.getStudentSubmissions).toHaveBeenCalledWith(VALID_OID, 'q-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should recover studentId from body if params has [object Object]', async () => {
      req.params = { questionnaireId: 'q-1', studentId: '[object Object]' };
      req.body = { studentId: VALID_OID };
      mockService.getStudentSubmissions.mockResolvedValue([] as any);

      await controller.getStudentSubmissions(req as Request, res as Response, next);

      expect(mockService.getStudentSubmissions).toHaveBeenCalledWith(VALID_OID, 'q-1');
    });

    it('should recover studentId from query if params is invalid', async () => {
      req.params = { questionnaireId: 'q-1', studentId: '' };
      req.query = { studentId: VALID_OID };
      mockService.getStudentSubmissions.mockResolvedValue([] as any);

      await controller.getStudentSubmissions(req as Request, res as Response, next);

      expect(mockService.getStudentSubmissions).toHaveBeenCalledWith(VALID_OID, 'q-1');
    });

    it('should return 400 for invalid ObjectId', async () => {
      req.params = { questionnaireId: 'q-1', studentId: 'not-a-valid-id' };

      await controller.getStudentSubmissions(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.getStudentSubmissions).not.toHaveBeenCalled();
    });

    it('should call next on service error', async () => {
      req.params = { questionnaireId: 'q-1', studentId: VALID_OID };
      mockService.getStudentSubmissions.mockRejectedValue(new Error('fail'));

      await controller.getStudentSubmissions(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('getGradeReport', () => {
    it('should return grade report', async () => {
      req.params = { questionnaireId: 'q-1' };
      const report = { average: 8.5, total: 10 };
      mockService.getGradeReport.mockResolvedValue(report as any);

      await controller.getGradeReport(req as Request, res as Response, next);

      expect(mockService.getGradeReport).toHaveBeenCalledWith('q-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: report }));
    });

    it('should call next on error', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.getGradeReport.mockRejectedValue(new Error('fail'));
      await controller.getGradeReport(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('getPendingGrading', () => {
    it('should return pending submissions for a questionnaire', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.getPendingByQuestionnaire.mockResolvedValue([mockSubmission] as any);

      await controller.getPendingGrading(req as Request, res as Response, next);

      expect(mockService.getPendingByQuestionnaire).toHaveBeenCalledWith('q-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.getPendingByQuestionnaire.mockRejectedValue(new Error('fail'));
      await controller.getPendingGrading(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('getPendingGradingByTeacher', () => {
    it('should return pending submissions for teacher', async () => {
      mockService.getPendingForTeacher.mockResolvedValue([mockSubmission] as any);

      await controller.getPendingGradingByTeacher(req as Request, res as Response, next);

      expect(mockService.getPendingForTeacher).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 401 if not authenticated', async () => {
      req.user = undefined;

      await controller.getPendingGradingByTeacher(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockService.getPendingForTeacher).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      mockService.getPendingForTeacher.mockRejectedValue(new Error('fail'));
      await controller.getPendingGradingByTeacher(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('getSubmissionById', () => {
    it('should return submission by id', async () => {
      req.params = { submissionId: 'sub-1' };
      mockService.getSubmissionById.mockResolvedValue(mockSubmission as any);

      await controller.getSubmissionById(req as Request, res as Response, next);

      expect(mockService.getSubmissionById).toHaveBeenCalledWith('sub-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockSubmission }));
    });

    it('should return 404 if submission not found', async () => {
      req.params = { submissionId: 'no-existe' };
      mockService.getSubmissionById.mockResolvedValue(null as any);

      await controller.getSubmissionById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { submissionId: 'sub-1' };
      mockService.getSubmissionById.mockRejectedValue(new Error('fail'));
      await controller.getSubmissionById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('resetStudentAttempts', () => {
    it('should reset student attempts with valid ObjectId', async () => {
      req.params = { questionnaireId: 'q-1', studentId: VALID_OID };
      const result = { deleted: 3 };
      mockService.resetStudentAttempts.mockResolvedValue(result as any);

      await controller.resetStudentAttempts(req as Request, res as Response, next);

      expect(mockService.resetStudentAttempts).toHaveBeenCalledWith(VALID_OID, 'q-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should recover studentId from body if params is invalid', async () => {
      req.params = { questionnaireId: 'q-1', studentId: '[object Object]' };
      req.body = { studentId: VALID_OID };
      mockService.resetStudentAttempts.mockResolvedValue({} as any);

      await controller.resetStudentAttempts(req as Request, res as Response, next);

      expect(mockService.resetStudentAttempts).toHaveBeenCalledWith(VALID_OID, 'q-1');
    });

    it('should return 400 for invalid ObjectId', async () => {
      req.params = { questionnaireId: 'q-1', studentId: 'bad-id' };

      await controller.resetStudentAttempts(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.resetStudentAttempts).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      req.params = { questionnaireId: 'q-1', studentId: VALID_OID };
      mockService.resetStudentAttempts.mockRejectedValue(new Error('fail'));
      await controller.resetStudentAttempts(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─────────────────────────────────────────
  describe('deleteAllByQuestionnaire', () => {
    it('should delete all submissions for a questionnaire', async () => {
      req.params = { questionnaireId: 'q-1' };
      const result = { deletedCount: 5 };
      mockService.deleteAllByQuestionnaire.mockResolvedValue(result as any);

      await controller.deleteAllByQuestionnaire(req as Request, res as Response, next);

      expect(mockService.deleteAllByQuestionnaire).toHaveBeenCalledWith('q-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: result }));
    });

    it('should call next on error', async () => {
      req.params = { questionnaireId: 'q-1' };
      mockService.deleteAllByQuestionnaire.mockRejectedValue(new Error('fail'));
      await controller.deleteAllByQuestionnaire(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
