import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { requireAdminOrQuestionnaireOwner } from '@/middlewares/questionnaire.middleware';
import { questionnaireController, questionnaireSubmissionController } from '@/controllers';
import { questionnaireRepository } from '@/repositories';
import { uploadQuestionMedia } from '@/utils/fileUpload.util';

const router = Router();

// ==================== QUESTIONNAIRE ROUTES ====================

// Create questionnaire
router.post('/', authorize, (req, res, next) => questionnaireController.create(req, res, next));

// Update questionnaire (admin or questionnaire owner)
router.patch(
  '/:questionnaireId',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  (req, res, next) => questionnaireController.update(req, res, next)
);

// Delete questionnaire (admin or questionnaire owner)
router.delete(
  '/:questionnaireId',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  (req, res, next) => questionnaireController.delete(req, res, next)
);

// Get questionnaire by ID
router.get('/:questionnaireId', authorize, (req, res, next) => questionnaireController.findById(req, res, next));

// ⚠️ Estas rutas estáticas DEBEN ir antes de /:questionnaireId para no ser capturadas por él
router.get('/course/:courseId', authorize, (req, res, next) => questionnaireController.findByCourse(req, res, next));
router.get('/professor/:professorId', authorize, (req, res, next) =>
  questionnaireController.findByProfessor(req, res, next)
);

// ==================== MEDIA ROUTES ====================

router.post(
  '/:questionnaireId/questions/:questionId/media',
  authorize,
  (req, res, next) => {
    const middleware = requireAdminOrQuestionnaireOwner(questionnaireRepository);
    return middleware(req, res, next);
  },
  uploadQuestionMedia.single('mediaFile'),
  (req, res, next) => questionnaireController.uploadQuestionMedia(req, res, next)
);

router.get(
  '/:questionnaireId/questions/:questionId/media-upload-progress',
  authorize,
  (req, res, next) => questionnaireController.getQuestionMediaUploadProgress(req, res, next)
);

// ==================== SUBMISSION ROUTES ====================

// ⚠️ Rutas estáticas de submissions ANTES de las dinámicas
router.patch('/submissions/:submissionId', authorize, (req, res, next) =>
  questionnaireSubmissionController.submitAnswers(req, res, next)
);

router.post('/submissions/:submissionId/grade', authorize, (req, res, next) =>
  questionnaireSubmissionController.gradeTextQuestions(req, res, next)
);

router.get('/submissions/:submissionId', authorize, (req, res, next) =>
  questionnaireSubmissionController.getSubmissionById(req, res, next)
);

// Rutas dinámicas de submissions
router.post('/:questionnaireId/submissions', authorize, (req, res, next) =>
  questionnaireSubmissionController.startSubmission(req, res, next)
);

router.get('/:questionnaireId/submissions/student/:studentId', authorize, (req, res, next) =>
  questionnaireSubmissionController.getStudentSubmissions(req, res, next)
);

router.get('/:questionnaireId/grade-report', authorize, (req, res, next) =>
  questionnaireSubmissionController.getGradeReport(req, res, next)
);

router.delete('/:questionnaireId/submissions/student/:studentId', authorize, requireAdmin, (req, res, next) =>
  questionnaireSubmissionController.resetStudentAttempts(req, res, next)
);

export default router;
