import { Router } from 'express';
import fileMaterialController from '@/controllers/fileMaterial.controller';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdminOrProfessor, requireAdmin } from '@/middlewares/adminSecurity.middleware';

const router = Router();

router.get('/', authorize, requireAdminOrProfessor, fileMaterialController.getMaterials);
router.get('/folders', authorize, requireAdminOrProfessor, fileMaterialController.getDistinctFolders);
router.get('/public', authorize, requireAdminOrProfessor, fileMaterialController.getPublicMaterials);
router.get('/my-materials', authorize, fileMaterialController.getMyMaterials);
router.get('/stats', authorize, fileMaterialController.getMaterialStats);
router.get('/:id', authorize, fileMaterialController.getMaterialById);
router.get('/:id/download', authorize, requireAdminOrProfessor, fileMaterialController.downloadMaterial);

router.post('/', authorize, requireAdmin, fileMaterialController.uploadMaterial);
router.patch('/:id', authorize, requireAdmin, fileMaterialController.updateMaterial);
router.delete('/:id', authorize, requireAdmin, fileMaterialController.deleteMaterial);

export default router;