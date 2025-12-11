import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { iWantToTrainController } from '@/controllers';

const router = Router();

router.get('/getAllIWantToTrain', authorize, iWantToTrainController.getAllIWantToTrain);
router.get('/getIWantToTrainById/:id', authorize, iWantToTrainController.getIWantToTrainById);
router.patch('/updateIWantToTrainById/:id', authorize, iWantToTrainController.updateIWantToTrainById);
router.delete('/deleteIWantToTrainById/:id', authorize, iWantToTrainController.deleteIWantToTrainById);

export default router;
