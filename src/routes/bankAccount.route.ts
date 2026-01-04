import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/adminSecurity.middleware';
import { bankAccountController } from '@/controllers';

const router = Router();

// 🟠 ALTO: Ver cuentas bancarias requiere admin
router.get('/bank-accounts', authorize, requireAdmin, bankAccountController.getAllBankAccounts);
// Ruta para estudiantes
router.get('/student', authorize, bankAccountController.getBankAccountsForStudent);
// 🟠 ALTO: Modificar cuentas bancarias requiere admin (sin verificación adicional para desarrollo)
router.patch('/bank-account/:id', authorize, requireAdmin, bankAccountController.updateBankAccount);

export default router;
