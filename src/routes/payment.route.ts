import { Router } from 'express';
import { paymentController } from '@/controllers';
import { authorize } from '@/middlewares/auth.middleware';

const router = Router();

// Rutas para pagos tradicionales
router.post('/submit-form', paymentController.submitPaymentFormData);
router.post('/requests', authorize, paymentController.createPaymentRequest);
router.post('/requests/validate-create', authorize, paymentController.validateAndCreatePaymentRequest);

// Rutas para MercadoPago
router.post('/create-preference', paymentController.createPaymentPreference);
router.get('/status/:paymentId', paymentController.getPaymentStatus);
router.get('/details/:paymentId', paymentController.getPaymentDetails);
router.get('/check/:paymentId', paymentController.checkPaymentExists);
router.post('/webhook', paymentController.handleWebhook);
router.post('/register-success', paymentController.registerSuccessfulPayment);
router.get('/stats', paymentController.getPaymentStats);
router.get('/all', paymentController.getAllPayments);
router.delete('/:paymentId', paymentController.deletePayment);

export default router;
