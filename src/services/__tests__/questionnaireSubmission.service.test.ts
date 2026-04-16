import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';

jest.mock('@utils/emailer', () => ({ sendEmail: jest.fn() }));
jest.mock('@services/index', () => ({ notificationService: { sendNotification: jest.fn() } }));
jest.mock('@repositories/courseProgress.repository', () => ({ courseProgressRepository: { updateQuestionnaireProgress: jest.fn() } }));

import { sendEmail } from '@/utils/emailer';
import { notificationService } from '@/services/index';

describe('QuestionnaireSubmissionService.gradeTextQuestions (post-grading notifications)', () => {
  const mockSubmissionId = 'sub123';
  const mockProfessorId = '507f191e810c19729de860ea';

  const baseSubmission: any = {
    _id: mockSubmissionId,
    questionnaireId: 'q1',
    courseId: 'c1',
    studentId: 's1',
    studentName: 'Alumno Test',
    studentEmail: 'alumno@test.com',
    answers: [
      { questionId: 'qa', questionType: 'TEXT', textAnswer: 'resp', pointsAwarded: 0 },
    ],
    status: 'SUBMITTED',
  };

  const questionnaireMock: any = {
    _id: 'q1',
    title: 'Cuestionario Demo',
    questions: [{ _id: 'qa', type: 'TEXT', points: 10 }],
    courseId: 'c1',
  };

  const makeService = (submissionRepoOverrides = {}, questionnaireRepoOverrides = {}) => {
    const submissionRepository: any = Object.assign(
      {
        findById: jest.fn().mockResolvedValue(baseSubmission),
        update: jest.fn().mockImplementation(async (id, data) => ({ ...baseSubmission, ...data })),
      },
      submissionRepoOverrides
    );

    const questionnaireRepository: any = Object.assign(
      {
        findById: jest.fn().mockResolvedValue(questionnaireMock),
      },
      questionnaireRepoOverrides
    );

    return new QuestionnaireSubmissionService(submissionRepository, questionnaireRepository);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // default to development
    process.env.NODE_ENV = 'development';
  });

  test('in development: does NOT send email, but sends notification', async () => {
    const service = makeService();

    await service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 8 }], mockProfessorId, 'Buen trabajo');

    expect(sendEmail).not.toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
  });

  test('in production: sends email and notification', async () => {
    process.env.NODE_ENV = 'production';
    const service = makeService();

    await service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 9 }], mockProfessorId, 'Excelente');

    expect(sendEmail).toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
  });

  test('production but missing studentEmail: skips sendEmail, still sends notification', async () => {
    process.env.NODE_ENV = 'production';
    const service = makeService({ findById: jest.fn().mockResolvedValue({ ...baseSubmission, studentEmail: undefined }) });

    await service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 7 }], mockProfessorId, 'Sin email');

    expect(sendEmail).not.toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
  });

  test('notification service throws: should not propagate error (production)', async () => {
    process.env.NODE_ENV = 'production';
    (notificationService as any).sendNotification.mockImplementationOnce(() => { throw new Error('SSE down'); });
    const service = makeService();

    // Ensure sendEmail still attempts to run (we mock it but it won't throw)
    (sendEmail as jest.Mock).mockImplementationOnce(async () => Promise.resolve());

    await expect(
      service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 6 }], mockProfessorId, 'Notif fail')
    ).resolves.not.toThrow();

    expect(sendEmail).toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
  });

  test('sendEmail throws: should not propagate and still attempt notification', async () => {
    process.env.NODE_ENV = 'production';
    (sendEmail as jest.Mock).mockImplementationOnce(() => { throw new Error('SMTP error'); });
    const service = makeService();

    await expect(
      service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 10 }], mockProfessorId, 'Email fail')
    ).resolves.not.toThrow();

    expect(sendEmail).toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
  });

  test('re-grading an already GRADED submission should work and notify', async () => {
    process.env.NODE_ENV = 'development';
    const gradedSubmission = { ...baseSubmission, status: 'GRADED', finalScore: 80 };
    const service = makeService({ findById: jest.fn().mockResolvedValue(gradedSubmission) });

    await expect(
      service.gradeTextQuestions(mockSubmissionId, [{ questionId: 'qa', points: 9 }], mockProfessorId, 'Re-grading')
    ).resolves.not.toThrow();

    // In development, sendEmail not called, notification called
    expect(sendEmail).not.toHaveBeenCalled();
    expect((notificationService as any).sendNotification).toHaveBeenCalled();
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
