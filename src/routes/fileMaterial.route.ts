import { Router } from 'express';
import fileMaterialController from '@/controllers/fileMaterial.controller';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

router.post('/file-materials', authorize, fileMaterialController.uploadMaterial);
router.get('/file-materials', authorize, fileMaterialController.getMaterials);
router.get('/file-materials/public', authorize, fileMaterialController.getPublicMaterials);
router.get('/file-materials/my-materials', authorize, fileMaterialController.getMyMaterials);
router.get('/file-materials/stats', authorize, fileMaterialController.getMaterialStats);
router.get('/file-materials/:id', authorize, fileMaterialController.getMaterialById);
router.get('/file-materials/:id/download', authorize, fileMaterialController.downloadMaterial);
router.patch('/file-materials/:id', authorize, fileMaterialController.updateMaterial);
router.delete('/file-materials/:id', authorize, fileMaterialController.deleteMaterial);

export default router;
