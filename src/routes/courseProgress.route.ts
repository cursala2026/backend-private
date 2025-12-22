import { Router } from 'express';
import { courseProgressController } from '@/controllers/courseProgress.controller';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

// GET /progress - Obtener todos los progresos del usuario
router.get('/', authorize, (req, res) => courseProgressController.getAllProgress(req, res));

// GET /progress/:courseId - Obtener progreso en un curso específico
router.get('/:courseId', authorize, (req, res) => courseProgressController.getProgress(req, res));

// POST /progress/:courseId - Actualizar progreso de video
router.post('/:courseId', authorize, (req, res) => courseProgressController.updateProgress(req, res));

// POST /progress/:courseId/complete/:classId - Marcar clase como completada
router.post('/:courseId/complete/:classId', authorize, (req, res) =>
  courseProgressController.markCompleted(req, res)
);

// GET /progress/:courseId/class/:classId - Obtener progreso de una clase
router.get('/:courseId/class/:classId', authorize, (req, res) =>
  courseProgressController.getClassProgress(req, res)
);

// GET /progress/:courseId/can-access/:classId - Verificar si puede acceder a la clase
router.get('/:courseId/can-access/:classId', authorize, (req, res) =>
  courseProgressController.canAccessClass(req, res)
);

export default router;
