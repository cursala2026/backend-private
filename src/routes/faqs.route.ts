import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { faqController } from '@/controllers';

const router = Router();

// Protected routes (require authentication for management)
router.post('/', authorize, faqController.createFAQ);
router.patch('/:id', authorize, faqController.updateFAQ);
router.delete('/:id', authorize, faqController.deleteFAQ);
router.patch('/order/update', authorize, faqController.updateFAQOrder);

export default router;
