import { Router } from 'express';
import { authLimiter } from '@/middlewares/rateLimit.middleware';
import { authController } from '../controllers';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

router.post('/login', authLimiter, authController.login);
router.post('/reset-password/initiate', authLimiter, authController.initiateResetPassword);
router.post('/reset-password/complete', authLimiter, authController.completeResetPassword);
router.get('/current-user', authorize, authController.currentUser);
router.post('/register', authLimiter, authController.registerUser);

export default router;
