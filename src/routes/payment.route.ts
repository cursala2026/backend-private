import { Router } from 'express';
import { paymentController } from '@/controllers';

const router = Router();

// Rutas para pagos tradicionales
router.post('/payment/submit-form', paymentController.submitPaymentFormData);

// Rutas para MercadoPago
router.post('/payments/create-preference', paymentController.createPaymentPreference);
router.get('/payments/status/:paymentId', paymentController.getPaymentStatus);
router.get('/payments/details/:paymentId', paymentController.getPaymentDetails);
router.post('/payments/webhook', paymentController.handleWebhook);
router.post('/payments/register-success', paymentController.registerSuccessfulPayment);

export default router;
