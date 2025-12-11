import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { businessTrainingController } from '@/controllers';

const router = Router();

router.get('/getAllBusinessTrainings', authorize, businessTrainingController.getAllBusinessTrainings);
router.get('/getBusinessTrainingById/:id', authorize, businessTrainingController.getBusinessTrainingById);
router.patch('/updateBusinessTrainingById/:id', authorize, businessTrainingController.updateBusinessTrainingById);
router.delete('/deleteBusinessTrainingById/:id', authorize, businessTrainingController.deleteBusinessTrainingById);

export default router;
