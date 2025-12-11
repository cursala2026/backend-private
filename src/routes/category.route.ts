import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { categoryController } from '@/controllers';

const router = Router();

// 🟡 AUTENTICADO: Ver categorías y cursos
router.get('/categories', authorize, categoryController.findAll);
router.get('/category/:categoryId', authorize, categoryController.findOneById);
router.get('/category/:imageFileName/image', authorize, categoryController.getCategoryImage);
router.get('/categories/:categoryId/courses', authorize, categoryController.getCoursesByCategoryAggregate);
router.get(
  '/categories/:categoryId/coursesnotassigned',
  authorize,
  categoryController.getCoursesNotInCategoryAggregate
);

// 🟠 ALTO: Administración de categorías requiere admin
router.post('/category', authorize, requireAdmin, categoryController.create);
router.patch('/category/:id', authorize, requireAdmin, categoryController.update);
router.delete('/category/:categoryId/delete', authorize, requireAdmin, categoryController.delete);
router.patch('/category/:categoryId/status', authorize, requireAdmin, categoryController.changeStatus);
router.patch('/category/:categoryId/up', authorize, requireAdmin, categoryController.moveUpOrder);
router.patch('/category/:categoryId/down', authorize, requireAdmin, categoryController.moveDownOrder);

// 🟠 ALTO: Gestión de cursos en categorías requiere admin
router.post('/category/:categoryId/course/:courseId', authorize, requireAdmin, categoryController.addCourse);
router.delete('/category/:categoryId/course/:courseId', authorize, requireAdmin, categoryController.removeCourse);
router.patch('/categories/:categoryId/add-course/:courseId', authorize, requireAdmin, categoryController.addCourseToCategory);
router.patch('/categories/:categoryId/remove-course/:courseId', authorize, requireAdmin, categoryController.removeCourseFromCategory);

export default router;
