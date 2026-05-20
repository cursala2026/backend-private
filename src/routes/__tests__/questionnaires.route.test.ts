import express from 'express';
import request from 'supertest';
import questionnaireRoutes from '../questionnaires.route';

// Mock dependencies directly to avoid DB connection issues
jest.mock('@/middlewares/auth.middleware', () => ({
  authorize: (req: any, res: any, next: any) => next(),
}));
jest.mock('@/middlewares/adminSecurity.middleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => next(),
}));
jest.mock('@/middlewares/questionnaire.middleware', () => ({
  requireAdminOrQuestionnaireOwner: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('@/controllers', () => ({
  questionnaireController: {
    findById: jest.fn((req, res) => res.status(200).json({ method: 'findById', id: req.params.questionnaireId })),
    findByCourse: jest.fn((req, res) => res.status(200).json({ method: 'findByCourse', courseId: req.params.courseId })),
    findByProfessor: jest.fn((req, res) => res.status(200).json({ method: 'findByProfessor', professorId: req.params.professorId })),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    uploadQuestionMedia: jest.fn(),
    getQuestionMediaUploadProgress: jest.fn(),
  },
  questionnaireSubmissionController: {
    startSubmission: jest.fn(),
    submitAnswers: jest.fn(),
    gradeTextQuestions: jest.fn(),
    getStudentSubmissions: jest.fn(),
    getGradeReport: jest.fn(),
    getSubmissionById: jest.fn(),
    resetStudentAttempts: jest.fn(),
  }
}));

const app = express();
app.use(express.json());
app.use('/api/v1/questionnaires', questionnaireRoutes);

describe('Questionnaire Routes Order', () => {
  it('should correctly route /course/:courseId instead of treating it as /:id', async () => {
    const response = await request(app).get('/api/v1/questionnaires/course/course-1234');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      method: 'findByCourse',
      courseId: 'course-1234'
    });
  });

  it('should correctly route /professor/:professorId instead of treating it as /:id', async () => {
    const response = await request(app).get('/api/v1/questionnaires/professor/prof-1234');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      method: 'findByProfessor',
      professorId: 'prof-1234'
    });
  });

  it('should correctly route /:id for actual questionnaire IDs', async () => {
    const response = await request(app).get('/api/v1/questionnaires/64f1bcdef123456789012345');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      method: 'findById',
      id: '64f1bcdef123456789012345'
    });
  });
});
