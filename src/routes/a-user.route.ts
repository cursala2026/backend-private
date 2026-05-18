import { Router } from 'express';
import { userController } from '../controllers';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin, requireAdminOrSelf, requireAdminOrVendedor } from '@/middlewares/adminSecurity.middleware';

const router = Router();

// 🟠 ALTO: Consultas administrativas de usuarios
// Esta ruta DEBE estar aquí arriba para evitar el error 404 durante el login
router.get('/interest-status/:userId', authorize, requireAdminOrSelf, userController.checkInterestsRequirement);

// GET routes (ordered by importance)
// 🔴 DEBUG: Only available in development environment

// 🟠 ALTO: Consultas administrativas de usuarios
// IMPORTANTE: Las rutas estáticas deben estar ANTES de las rutas con parámetros dinámicos
router.get('/getAllUsers', authorize, requireAdmin, userController.getAllUsers);
router.get('/getTeachers', authorize, requireAdmin, userController.getTeachers);
router.get('/', authorize, requireAdminOrVendedor, userController.getUsersPaginated);
router.get('/getUsersByAssignedCourses/:courseId', authorize, requireAdmin, userController.getUsersByAssignedCourses);
router.get('/getStudentsByTeacherCourses/:teacherId', authorize, userController.getStudentsByTeacherCourses);
router.get('/getAllStudentsFromAllCourses', authorize, requireAdmin, userController.getAllStudentsFromAllCourses);

// 🟡 MEDIO: Gestión de cursos asignados (requiere admin para asignaciones de otros usuarios)
router.get('/getAssignedCourses/:userId', authorize, userController.getAssignedCourses);
router.get('/getUnassignedCourses/:userId', authorize, userController.getUnassignedCourses);
router.get('/getAssignedCoursesEdit/:userId', authorize, requireAdmin, userController.getAssignedCoursesEdit);
router.get('/getUnassignedCoursesEdit/:userId', authorize, requireAdmin, userController.getUnassignedCoursesEdit);

// 🟢 BAJO: Accesibilidad de cursos (cualquier usuario autenticado)
router.get('/isCourseAccessible/:courseId', authorize, userController.isCourseAccessibleForUser);
router.get('/course-access-info/:courseId', authorize, userController.getCourseAccessInfo);

// Rutas con parámetros dinámicos - DEBEN estar al FINAL para evitar capturar rutas estáticas
router.get('/:userId', authorize, requireAdminOrSelf, userController.getUserById);

// POST routes (ordered by importance)
// 🔴 CRÍTICO: Modificar roles requiere verificación de email
// NOTE: Gestión dinámica de roles deshabilitada — roles son inmutables.
router.post('/create', authorize, requireAdmin, userController.createUser);
router.post('/addCountryToUser', authorize, requireAdmin, userController.addCountriesToUser);
router.post('/assignCourseToUser', authorize, requireAdmin, userController.assignCourseToUser);
router.post('/removeCourseFromUser', authorize, requireAdmin, userController.removeCourseFromUser);
router.post('/assignCourseToUserEdit', authorize, requireAdmin, userController.assignCourseToUserEdit);
router.post('/removeCourseFromUserEdit', authorize, requireAdmin, userController.removeCourseFromUserEdit);
router.post('/changueStatus', authorize, requireAdmin, userController.changueStatus);

// PATCH routes
router.patch('/updateUser/:userId', authorize, requireAdminOrSelf, userController.updateUser);
router.patch('/:userId', authorize, requireAdminOrSelf, userController.updateUser);
router.patch('/updateUserData/:userId', authorize, requireAdminOrSelf, userController.updateUserData);
router.patch('/updateLastConnection/:userId', authorize, userController.updateLastConnection);
router.patch('/:userId/toggle-status', authorize, requireAdmin, userController.toggleUserStatus);
router.patch('/:userId/interests', authorize, requireAdminOrSelf, userController.saveUserInterests);

// DELETE routes
router.delete('/deleteUser/:userId', authorize, requireAdmin, userController.deleteUser);
router.delete('/delete-self', authorize, userController.deleteSelfProfile);

export default router;
