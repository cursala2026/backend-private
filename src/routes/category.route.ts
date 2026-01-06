import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { categoryController } from '@/controllers';

const router = Router();

// CRUD básico de categorías: id, name, description
router.get('/categories', authorize, categoryController.findAll);
router.get('/category/:categoryId', authorize, categoryController.findOneById);

// Administración de categorías (solo admin)
router.post('/category', authorize, requireAdmin, categoryController.create);
router.patch('/category/:id', authorize, requireAdmin, categoryController.update);
router.delete('/category/:categoryId/delete', authorize, requireAdmin, categoryController.delete);

export default router;
