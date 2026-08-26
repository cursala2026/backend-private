import { Router } from 'express';
import fileMaterialController from '@/controllers/fileMaterial.controller';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';

const router = Router();

router.post('/', authorize, fileMaterialController.uploadMaterial);
router.get('/', authorize, fileMaterialController.getMaterials);
router.get('/public', authorize, fileMaterialController.getPublicMaterials);
router.get('/my-materials', authorize, fileMaterialController.getMyMaterials);
router.get('/stats', authorize, fileMaterialController.getMaterialStats);
router.get('/:id', authorize, fileMaterialController.getMaterialById);
router.get('/:id/download', authorize, fileMaterialController.downloadMaterial);
router.patch('/:id', authorize, fileMaterialController.updateMaterial);
router.delete('/:id', authorize, fileMaterialController.deleteMaterial);

export default router;