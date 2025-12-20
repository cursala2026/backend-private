import { Router } from 'express';
import { userController } from '../controllers';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';

const router = Router();

// GET routes (ordered by importance)
// 🔴 DEBUG: Only available in development environment
if (process.env.NODE_ENV === 'development') {
    router.get('/debug/:userId', authorize, requireAdmin, userController.debugGetUserData);
    router.get('/test', userController.testEndpoint);
}

// 🟠 ALTO: Consultas administrativas de usuarios
router.get('/getUserById/:userId', authorize, requireAdmin, userController.getUserById);
router.get('/getAllUsers', authorize, requireAdmin, userController.getAllUsers);
router.get('/', authorize, requireAdmin, userController.getUsersPaginated);
router.get('/getUsersByAssignedCourses/:courseId', authorize, requireAdmin, userController.getUsersByAssignedCourses);
// 🟡 MEDIO: Gestión de cursos asignados (requiere admin para asignaciones de otros usuarios)
router.get('/getAssignedCourses/:userId', authorize, userController.getAssignedCourses);
router.get('/getUnassignedCourses/:userId', authorize, userController.getUnassignedCourses);
router.get('/getAssignedCoursesEdit/:userId', authorize, requireAdmin, userController.getAssignedCoursesEdit);
router.get('/getUnassignedCoursesEdit/:userId', authorize, requireAdmin, userController.getUnassignedCoursesEdit);
// 🟢 BAJO: Accesibilidad de cursos (cualquier usuario autenticado)
router.get('/isCourseAccessible/:courseId', authorize, userController.isCourseAccessibleForUser);
router.get('/course-access-info/:courseId', authorize, userController.getCourseAccessInfo);

// POST routes (ordered by importance)
// 🔴 CRÍTICO: Modificar roles requiere verificación de email
// 🔴 CRÍTICO: Modificar roles requiere verificación de email
// NOTE: Gestión dinámica de roles deshabilitada — roles son inmutables.
// Estas rutas quedan comentadas para evitar cambios accidentales en producción.
// Si en el futuro se reintroduce la funcionalidad, reimplementar aceptando role `code`.
// router.post('/addRoleToUser', authorize, requireAdmin, userController.addRoleToUser);
// router.post('/removeRoleFromUser', authorize, requireAdmin, userController.removeRoleFromUser);
// 🟠 ALTO: Operaciones administrativas que requieren rol admin
router.post('/create', authorize, requireAdmin, userController.createUser);
router.post('/addCountryToUser', authorize, requireAdmin, userController.addCountriesToUser);
router.post('/assignCourseToUser', authorize, requireAdmin, userController.assignCourseToUser);
router.post('/removeCourseFromUser', authorize, requireAdmin, userController.removeCourseFromUser);
router.post('/assignCourseToUserEdit', authorize, requireAdmin, userController.assignCourseToUserEdit);
router.post('/removeCourseFromUserEdit', authorize, requireAdmin, userController.removeCourseFromUserEdit);
router.post('/changueStatus', authorize, requireAdmin, userController.changueStatus);

// PATCH routes
// 🟠 ALTO: Actualizar datos de usuario requiere admin
router.patch('/updateUser/:userId', authorize, requireAdmin, userController.updateUser);
router.patch('/updateUserData/:userId', authorize, requireAdmin, userController.updateUserData);
router.patch('/updateLastConnection/:userId', authorize, userController.updateLastConnection);
router.patch('/:userId/toggle-status', authorize, requireAdmin, userController.toggleUserStatus);

// DELETE routes
// 🔴 CRÍTICO: Eliminar usuario requiere verificación de email
router.delete('/deleteUser/:userId', authorize, requireAdmin, userController.deleteUser);

export default router;
