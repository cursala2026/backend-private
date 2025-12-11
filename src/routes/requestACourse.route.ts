import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requestACourseController } from '@/controllers';

const router = Router();

router.get('/getAllRequestACourse', authorize, requestACourseController.getAllRequestACourse);
router.get('/getRequestACourseById/:id', authorize, requestACourseController.getRequestACourseById);
router.patch('/updateRequestACourseById/:id', authorize, requestACourseController.updateRequestACourseById);
router.delete('/deleteRequestACourseById/:id', authorize, requestACourseController.deleteRequestACourseById);

export default router;
