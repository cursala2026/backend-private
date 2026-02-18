import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin, requireAdminOrCourseOwner, requireAdminOrVendedor } from '@/middlewares/adminSecurity.middleware';
import { courseController } from '@/controllers';
import { courseRepository } from '@/repositories';

const router = Router();

// 🟢 PÚBLICO: Imágenes de cursos (sin autenticación para permitir carga en navegador)
router.get('/:imageFileName/image', courseController.getCourseImage);

// 🟡 AUTENTICADO: Listar y ver cursos
router.get('/published', authorize, courseController.findPublishedCourses); // Cursos publicados para estudiantes
router.get('/teacher/:teacherId', authorize, courseController.findByTeacherId); // Cursos de un profesor

// 🟡 AUTENTICADO: Rutas de estudiantes (DEBEN IR ANTES DE /:courseId)
router.get('/me/courses', authorize, courseController.getStudentCourses); // Obtener cursos del estudiante

// 🟡 AUTENTICADO: Listar todos (solo admin y vendedor)
router.get('/', authorize, requireAdminOrVendedor, courseController.findAll); // Todos los cursos (solo admin/vendedor)

// 🟠 Administración: listado de categorías para selects (debe ir antes de /:courseId)
router.get('/categories', authorize, requireAdmin, courseController.getCategoriesForSelect);

// 🟡 AUTENTICADO: Rutas específicas por courseId
router.get('/:courseId', authorize, courseController.findOneById); // Ver detalles del curso
router.post('/:courseId/enroll', authorize, courseController.enrollStudent); // Inscribirse en un curso gratis
router.post('/:courseId/unenroll', authorize, courseController.unenrollStudent); // Desinscribirse de un curso

// 🔴 ADMIN: Gestión manual de estudiantes (asociar/desasociar)
router.post('/:courseId/enroll/:userId', authorize, requireAdmin, courseController.enrollStudentByAdmin); // Asociar estudiante manualmente
router.delete('/:courseId/unenroll/:userId', authorize, requireAdmin, courseController.unenrollStudentByAdmin); // Desasociar estudiante completamente
// 🔴 ADMIN: Duplicar curso con todas sus clases y cuestionarios
router.post('/:courseId/duplicate', authorize, requireAdmin, courseController.duplicateCourse);
router.post('/course', authorize, requireAdmin, courseController.create);
router.patch('/:courseId/teachers', authorize, requireAdminOrCourseOwner(courseRepository), courseController.updateTeachers);
router.patch('/:id', authorize, requireAdminOrCourseOwner(courseRepository), courseController.update);
router.delete('/:courseId/delete', authorize, requireAdmin, courseController.delete);
router.patch('/:courseId/status', authorize, requireAdmin, courseController.changeStatus);
router.patch('/:courseId/up', authorize, requireAdmin, courseController.moveUpOrder);
router.patch('/:courseId/down', authorize, requireAdmin, courseController.moveDownOrder);
router.patch('/:courseId/showOnHome', authorize, requireAdmin, courseController.changeShowOnHome);
router.patch('/:courseId/published', authorize, requireAdmin, courseController.changePublishedStatus);

export default router;
