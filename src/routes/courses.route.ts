import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { courseController } from '@/controllers';

const router = Router();

// 🟢 PÚBLICO: Imágenes de cursos (sin autenticación para permitir carga en navegador)
router.get('/:imageFileName/image', courseController.getCourseImage);

// 🟡 AUTENTICADO: Listar y ver cursos
router.get('/', authorize, requireAdmin, courseController.findAll);
router.get('/:courseId', authorize, courseController.findOneById);

// 🟠 ALTO: Administración de cursos requiere admin
router.post('/course', authorize, requireAdmin, courseController.create);
router.patch('/:id', authorize, requireAdmin, courseController.update);
router.delete('/:courseId/delete', authorize, requireAdmin, courseController.delete);
router.patch('/:courseId/status', authorize, requireAdmin, courseController.changeStatus);
router.patch('/:courseId/up', authorize, requireAdmin, courseController.moveUpOrder);
router.patch('/:courseId/down', authorize, requireAdmin, courseController.moveDownOrder);
router.patch('/:courseId/showOnHome', authorize, requireAdmin, courseController.changeShowOnHome);
router.patch('/:courseId/main-teacher', authorize, requireAdmin, courseController.assignMainTeacher);
router.patch('/:courseId/published', authorize, requireAdmin, courseController.changePublishedStatus);

export default router;
