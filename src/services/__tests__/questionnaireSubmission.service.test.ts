import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';

// --- MOCKS DE DEPENDENCIAS ---
jest.mock('@utils/emailer', () => ({ sendEmail: jest.fn() }));
jest.mock('@services/index', () => ({ 
  notificationService: { sendNotification: jest.fn() } 
}));
jest.mock('@repositories/courseProgress.repository', () => ({ 
  courseProgressRepository: { updateQuestionnaireProgress: jest.fn() } 
}));
// Mock de configuración para evitar problemas de entorno
jest.mock('@/config', () => ({
  __esModule: true,
  default: {
    FRONTEND_DOMAIN: 'http://localhost:3000'
  }
}));

import { sendEmail } from '@/utils/emailer';
import { notificationService } from '@/services/index';
import { courseProgressRepository } from '@repositories/courseProgress.repository';

describe('QuestionnaireSubmissionService Unit Tests', () => {
  const mockSubmissionId = new Types.ObjectId().toString();
  const mockProfessorId = new Types.ObjectId().toString();
  const mockQuestionId = new Types.ObjectId().toString();
  const mockCourseId = new Types.ObjectId().toString();
  const mockStudentId = new Types.ObjectId().toString();

  const baseSubmission: any = {
    _id: mockSubmissionId,
    questionnaireId: new Types.ObjectId().toString(),
    courseId: mockCourseId,
    studentId: mockStudentId,
    studentName: 'Alumno Test',
    studentEmail: 'alumno@test.com',
    answers: [
      { questionId: mockQuestionId, questionType: 'TEXT', textAnswer: 'Respuesta de prueba', pointsAwarded: 0 },
    ],
    status: 'SUBMITTED',
    attemptNumber: 1
  };

  const questionnaireMock: any = {
    _id: baseSubmission.questionnaireId,
    title: 'Cuestionario de Auditoría',
    questions: [{ _id: mockQuestionId, type: 'TEXT', points: 10, required: true, questionText: 'Pregunta 1' }],
    courseId: mockCourseId,
    isSurvey: false, // Default: examen
    createdBy: mockProfessorId
  };

  const makeService = (submissionRepoOverrides: any = {}, questionnaireRepoOverrides: any = {}) => {
    const submissionRepository: any = {
      findById: jest.fn().mockImplementation(async () => ({ ...baseSubmission, ...submissionRepoOverrides })),
      update: jest.fn().mockImplementation(async (id: any, data: any) => ({ ...baseSubmission, ...data })),
      findByIdWithStudent: jest.fn().mockImplementation(async () => ({ ...baseSubmission, ...submissionRepoOverrides })),
      findByStudentAndQuestionnaire: jest.fn().mockImplementation(async () => [baseSubmission]),
      getNextAttemptNumber: jest.fn().mockImplementation(async () => 2)
    };

    const questionnaireRepository: any = {
      findById: jest.fn().mockImplementation(async () => ({ ...questionnaireMock, ...questionnaireRepoOverrides })),
    };

    return new QuestionnaireSubmissionService(submissionRepository, questionnaireRepository);
  };


  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  // ==========================================================
  // SECCIÓN 1: LÓGICA DE ENCUESTAS (TASK #14)
  // ==========================================================
  describe('Task #14: Survey Implementation', () => {
    test('should mark submission as GRADED and score 100 if isSurvey is true', async () => {
      const service = makeService(
        { status: 'IN_PROGRESS' }, 
        { isSurvey: true, questions: [{ _id: mockQuestionId, type: 'MULTIPLE_CHOICE', required: true, points: 10 }] }
      );

      const answers = [{ 
      questionId: mockQuestionId, 
      selectedOptionId: new Types.ObjectId().toString(),
      questionType: 'MULTIPLE_CHOICE'
      } as any];
      
      const result = await service.submitAnswers(mockSubmissionId, answers);

      expect(result.status).toBe('GRADED');
      expect(result.finalScore).toBe(100);
      expect(result.autoGradedScore).toBe(100);
      
      // Validar actualización de progreso
      expect(courseProgressRepository.updateQuestionnaireProgress).toHaveBeenCalledWith(
        mockStudentId,
        mockCourseId,
        baseSubmission.questionnaireId,
        100
      );
    });

    test('should still enforce required questions even if it is a survey', async () => {
      const service = makeService({ status: 'IN_PROGRESS' }, { isSurvey: true });
      
      await expect(service.submitAnswers(mockSubmissionId, []))
        .rejects.toThrow(/is required/);
    });
  });

  // ==========================================================
  // SECCIÓN 2: NOTIFICACIONES (ORIGINAL)
  // ==========================================================
  describe('Post-Grading Notifications', () => {
    test('in development: does NOT send email, but sends notification', async () => {
      const service = makeService();
      await service.gradeTextQuestions(mockSubmissionId, [{ questionId: mockQuestionId, points: 8 }], mockProfessorId, 'Buen trabajo');
      expect(sendEmail).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    test('in production: sends email and notification', async () => {
      process.env.NODE_ENV = 'production';
      const service = makeService();
      await service.gradeTextQuestions(mockSubmissionId, [{ questionId: mockQuestionId, points: 9 }], mockProfessorId, 'Excelente');
      expect(sendEmail).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    test('production but missing studentEmail: skips sendEmail, still sends notification', async () => {
      process.env.NODE_ENV = 'production';
      const service = makeService({ studentEmail: undefined });
      await service.gradeTextQuestions(mockSubmissionId, [{ questionId: mockQuestionId, points: 7 }], mockProfessorId, 'Sin email');
      expect(sendEmail).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // SECCIÓN 3: MANEJO DE ERRORES Y CASOS BORDE
  // ==========================================================
  describe('Error Handling', () => {
    test('notification service throws: should not propagate error', async () => {
      (notificationService.sendNotification as jest.Mock).mockImplementationOnce(() => { throw new Error('SSE down'); });
      const service = makeService();
      await expect(
        service.gradeTextQuestions(mockSubmissionId, [{ questionId: mockQuestionId, points: 6 }], mockProfessorId)
      ).resolves.not.toThrow();
    });

    test('should throw error if submission is not found', async () => {
      const submissionRepository: any = { findById: jest.fn().mockImplementation(async () => null) };
      const service = new QuestionnaireSubmissionService(submissionRepository, {} as any);
      await expect(service.submitAnswers('none', [])).rejects.toThrow('Submission not found');
    });

    test('re-grading an already GRADED submission should work', async () => {
      const service = makeService({ status: 'GRADED' });
      await expect(
        service.gradeTextQuestions(mockSubmissionId, [{ questionId: mockQuestionId, points: 10 }], mockProfessorId)
      ).resolves.not.toThrow();
    });
  });
test('Surveys: should mark as passed automatically when grading', async () => {
    const surveyMock: any = { _id: 's123', isSurvey: true, questions: [], courseId: 'c1' };
    const service = makeService({}, { findById: jest.fn().mockResolvedValue(surveyMock) });
    
    // Al ser encuesta, no debería fallar el proceso de corrección
    const result = await (service as any).gradeTextQuestions(mockSubmissionId, [], mockProfessorId, 'Encuesta OK');
    expect(result).toBeDefined();
  });
// Test del Trabajo 2: Integración de Encuestas
  describe('Surveys Integration', () => {
    test('should identify if a course includes a survey component', async () => {
      const courseWithSurvey = { 
        id: 'survey-101', 
        name: 'Curso con Encuesta', 
        hasSurvey: true,
        modules: [{ name: 'Feedback', isSurvey: true }]
      };
      
      mockCourseRepository.findOneById.mockResolvedValue(courseWithSurvey);

      const result = await courseService.findOneById('survey-101');

      expect(result).toEqual(courseWithSurvey);
      expect((result as any).hasSurvey).toBe(true);
      expect(mockCourseRepository.findOneById).toHaveBeenCalledWith('survey-101');
    });
  });

});
