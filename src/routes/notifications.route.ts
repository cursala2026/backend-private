import { Router } from 'express';
import { authorize } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/adminSecurity.middleware';
import {
  getNonEnrolledConfig,
  updateNonEnrolledConfig,
  getCourseStartConfig,
  updateCourseStartConfig,
  getNoEnrollmentUsers,
  getRecommendedCourses,
  getCourseStart,
  sendTestNoEnrollmentEmail,
  sendTestCourseStartEmail
} from '../controllers/adminNotifications.controller';

const router = Router();

// Configuración de notificaciones de no inscriptos
router.get('/non-enrolled', authorize, requireAdmin, getNonEnrolledConfig);
router.put('/non-enrolled', authorize, requireAdmin, updateNonEnrolledConfig);

// Configuración de cursos que empiezan
router.get('/course-start-config', authorize, requireAdmin, getCourseStartConfig);
router.put('/course-start-config', authorize, requireAdmin, updateCourseStartConfig);

// Listado de usuarios sin cursos
router.get('/no-enrollment', authorize, requireAdmin, getNoEnrollmentUsers);

// Cursos recomendados
router.get('/recommended-courses', authorize, requireAdmin, getRecommendedCourses);

// Cursos que empiezan
router.get('/courses-start', authorize, requireAdmin, getCourseStart);

// Enviar email de prueba
router.post('/test-no-enrollment', authorize, requireAdmin, sendTestNoEnrollmentEmail);
router.post('/test-course-start', authorize, requireAdmin, sendTestCourseStartEmail);

export default router;
