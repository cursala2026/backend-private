import { Router } from 'express';
import { userController } from '../controllers';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin, requireAdminOrSelf, requireAdminOrVendedor } from '@/middlewares/adminSecurity.middleware';

const router = Router();

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
router.get('/:userId/should-show-interests', authorize, requireAdminOrSelf, userController.checkInterestsRequirement);
// Rutas con parámetros dinámicos - DEBEN estar al FINAL para evitar capturar rutas estáticas
router.get('/getUserById/:userId', authorize, requireAdmin, userController.getUserById);
router.get('/:userId', authorize, requireAdminOrSelf, userController.getUserById);
router.get('/getUserById/:userId', authorize, requireAdmin, userController.getUserById);
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
// Permite que los usuarios actualicen su propio perfil (incluyendo foto) o que admin actualice cualquier perfil
router.patch('/updateUserData/:userId', authorize, requireAdminOrSelf, userController.updateUserData);
router.patch('/updateLastConnection/:userId', authorize, userController.updateLastConnection);
router.patch('/:userId/toggle-status', authorize, requireAdmin, userController.toggleUserStatus);
router.patch('/:userId/interests', authorize, requireAdminOrSelf, userController.saveUserInterests);
// DELETE routes
// 🔴 CRÍTICO: Eliminar usuario requiere verificación de email
router.delete('/deleteUser/:userId', authorize, requireAdmin, userController.deleteUser);
// Permite que un usuario elimine su propio perfil
router.delete('/delete-self', authorize, userController.deleteSelfProfile);

export default router;
