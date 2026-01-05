import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { requireAdminOrQuestionnaireOwner } from '@/middlewares/questionnaire.middleware';
import { questionnaireController, questionnaireSubmissionController } from '@/controllers';
import { questionnaireRepository } from '@/repositories';
import { uploadFiles } from '@/utils/fileUpload.util';
import QuestionnaireController from '@/controllers/questionnaire.controller';
import QuestionnaireService from '@/services/questionnaire.service';
import QuestionnaireRepository from '@/repositories/questionnaire.repository';

const router = Router();

// Endpoint para subir/actualizar media de una pregunta
router.post(
  '/:questionnaireId/questions/:questionId/media',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  uploadFiles.single('mediaFile'),
  (req, res, next) => questionnaireController.uploadQuestionMedia(req, res, next)
);

// ==================== QUESTIONNAIRE ROUTES ====================

// Create questionnaire (authenticated users - validation in service)
router.post('/', authorize, (req, res, next) => questionnaireController.create(req, res, next));

// Update questionnaire (admin or course owner)
router.patch(
  '/:id',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  (req, res, next) => questionnaireController.update(req, res, next)
);

// Delete questionnaire (admin or course owner)
router.delete(
  '/:id',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  (req, res, next) => questionnaireController.delete(req, res, next)
);

// Get questionnaire by ID (authenticated users)
router.get('/:id', authorize, (req, res, next) => questionnaireController.findById(req, res, next));

// Get all questionnaires for a course
router.get('/course/:courseId', authorize, (req, res, next) => questionnaireController.findByCourse(req, res, next));

// Get all questionnaires by professor
router.get('/professor/:professorId', authorize, (req, res, next) =>
  questionnaireController.findByProfessor(req, res, next)
);

// ==================== SUBMISSION ROUTES ====================

// Start a new submission (students)
router.post('/:questionnaireId/submissions', authorize, (req, res, next) =>
  questionnaireSubmissionController.startSubmission(req, res, next)
);

// Submit answers (students - owner validation in controller)
router.patch('/submissions/:submissionId', authorize, (req, res, next) =>
  questionnaireSubmissionController.submitAnswers(req, res, next)
);

// Grade text questions (professors/admins)
router.post('/submissions/:submissionId/grade', authorize, (req, res, next) =>
  questionnaireSubmissionController.gradeTextQuestions(req, res, next)
);

// Get student submissions (authenticated users)
router.get('/:questionnaireId/submissions/student/:studentId', authorize, (req, res, next) =>
  questionnaireSubmissionController.getStudentSubmissions(req, res, next)
);

// Get grade report (professors/admins)
router.get('/:questionnaireId/grade-report', authorize, (req, res, next) =>
  questionnaireSubmissionController.getGradeReport(req, res, next)
);

// Get single submission
router.get('/submissions/:submissionId', authorize, (req, res, next) =>
  questionnaireSubmissionController.getSubmissionById(req, res, next)
);

// Reset student attempts (professors/admins)
router.delete('/:questionnaireId/submissions/student/:studentId', authorize, (req, res, next) =>
  questionnaireSubmissionController.resetStudentAttempts(req, res, next)
);

export default router;
