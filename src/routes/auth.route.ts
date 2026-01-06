import { Router } from 'express';
import { authLimiter } from '@/middlewares/rateLimit.middleware';
import { authController } from '../controllers';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, authController.login);
/**
 * @route   POST /auth/reset-password/initiate
 * @desc    Initiate password reset
 * @access  Public
 */
router.post('/reset-password/initiate', authLimiter, authController.initiateResetPassword);
/**
 * @route   POST /auth/reset-password/complete
 * @desc    Complete password reset
 * @access  Public
 */
router.post('/reset-password/complete', authLimiter, authController.completeResetPassword);
/**
 * @route   GET /auth/current-user
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/current-user', authorize, authController.currentUser);
/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, authController.registerUser);

export default router;
