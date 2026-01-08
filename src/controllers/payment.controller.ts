import { NextFunction, Request, Response } from 'express';
import { logger, prepareResponse } from '../utils';
import { IPaymentRequest } from '@/models';
import PaymentService from '@/services/payment.service';
import MercadoPagoPaymentService from '@/services/mercadoPagoPayment.service';
import { mercadoPagoRepository } from '@/repositories';
import * as MercadoPagoService from '@/services/mercadoPago.service';
import { uploadPaymentTicket } from '@/services/payment-upload.service';
import { promotionalCodeService } from '@/services';

// Re-exportar para compatibilidad con rutas
export { uploadPaymentTicket } from '@/services/payment-upload.service';

export default class PaymentController {
  private readonly mercadoPagoPaymentService: MercadoPagoPaymentService;

  constructor(private readonly paymentService: PaymentService) {
    this.mercadoPagoPaymentService = new MercadoPagoPaymentService(mercadoPagoRepository);
  }

  // Endpoint para crear preferencia de pago de MercadoPago
  createPaymentPreference = async (req: Request, res: Response) => {
    try {
      // No log of the entire body to avoid leaking PII; log minimal fields instead
      logger.info('Creating MercadoPago payment preference', {
        itemsCount: Array.isArray(req.body?.items) ? req.body.items.length : 0,
        payerEmail: req.body?.payer?.email,
        externalReference: req.body?.externalReference,
      });

      // Validar configuración de MercadoPago
      MercadoPagoService.validateMercadoPagoConfig();

      const {
        items,
        payer,
        paymentMethods,
        backUrls,
        autoReturn,
        externalReference,
        notificationUrl,
        additionalInfo,
        metadata,
      } = req.body;

      // Validaciones básicas
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json(prepareResponse(400, 'Items are required'));
      }

      if (!payer || !payer.email) {
        return res.status(400).json(prepareResponse(400, 'Payer email is required'));
      }

      if (!payer.first_name || !payer.last_name) {
        return res.status(400).json(prepareResponse(400, 'Payer first_name and last_name are required'));
      }

      // Validar que el precio no sea 0 o negativo
      const totalAmount = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      if (totalAmount <= 0) {
        return res
          .status(400)
          .json(
            prepareResponse(
              400,
              'El monto del pago debe ser mayor a 0. Los cursos gratuitos no requieren checkout de MercadoPago.'
            )
          );
      }

      const preference = await MercadoPagoService.createPaymentPreference({
        items,
        payer,
        payment_methods: paymentMethods,
        back_urls: backUrls,
        auto_return: autoReturn,
        external_reference: externalReference,
        notification_url: notificationUrl,
        additional_info: additionalInfo,
        metadata,
      });

      return res.json(prepareResponse(200, 'Payment preference created successfully', preference));
    } catch (error) {
      logger.error(`Error creating payment preference: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error creating payment preference', { error: (error as Error).message }));
    }
  };

  // Endpoint para verificar estado de pago
  getPaymentStatus = async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json(prepareResponse(400, 'Payment ID is required'));
      }

      const paymentInfo = await MercadoPagoService.getPaymentInfo(paymentId);

      prepareResponse(200, 'Payment status retrieved successfully', {
        id: paymentInfo.id,
        status: paymentInfo.status,
        status_detail: paymentInfo.status_detail,
        amount: paymentInfo.transaction_amount,
        external_reference: paymentInfo.external_reference,
        date_created: paymentInfo.date_created,
        payer: {
          email: paymentInfo.payer?.email,
          id: paymentInfo.payer?.id,
        },
      })
    } catch (error) {
      logger.error(`Error getting payment status: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error getting payment status', { error: (error as Error).message }));
    }
  };

  // Endpoint para obtener detalles de pago
  getPaymentDetails = async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json(prepareResponse(400, 'Payment ID is required'));
      }

      const paymentInfo = await MercadoPagoService.getPaymentInfo(paymentId);

      return res.json(prepareResponse(200, 'Payment details retrieved successfully', paymentInfo));
    } catch (error) {
      logger.error(`Error getting payment details: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error getting payment details', { error: (error as Error).message }));
    }
  };

  // Webhook para notificaciones de MercadoPago
  handleWebhook = async (req: Request, res: Response) => {
    try {
      // Log minimal webhook info to keep logs useful but avoid storing sensitive data
      logger.info('Received MercadoPago webhook', {
        query: req.query,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
        },
      });

      const webhookData = req.body;

      // Procesar la notificación usando el nuevo servicio
      const paymentRecord = await this.mercadoPagoPaymentService.processWebhookNotification(webhookData);

      if (paymentRecord) {
        logger.info('Payment webhook processed successfully with database storage and emails', {
          paymentId: paymentRecord.paymentId,
          status: paymentRecord.status,
          amount: paymentRecord.transactionAmount,
          studentEmail: paymentRecord.studentEmail,
        });
      } else {
        logger.info('Webhook processed but no payment record created (non-payment notification)');
      }

      // MercadoPago espera una respuesta 200 para confirmar que recibimos la notificación
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error(`Error processing webhook: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error processing webhook', { error: (error as Error).message }));
    }
  };

  // Endpoint para registrar pago exitoso
  registerSuccessfulPayment = async (req: Request, res: Response) => {
    try {
      const { paymentId, courseId, studentEmail, amount, externalReference } = req.body;

      if (!paymentId || !courseId || !studentEmail) {
        return res.status(400).json(prepareResponse(400, 'PaymentId, courseId, and studentEmail are required'));
      }

      // Registrar el pago usando el nuevo servicio
      const paymentRecord = await this.mercadoPagoPaymentService.registerSuccessfulPayment({
        paymentId,
        courseId,
        studentEmail,
        amount: amount || 0,
        externalReference: externalReference || `course_${courseId}_${Date.now()}`,
      });

      logger.info('Successful payment registered with email notifications', {
        paymentId,
        courseId,
        studentEmail,
        amount: paymentRecord.transactionAmount,
      });

      return res.json(
        prepareResponse(200, 'Payment registered successfully with email confirmations sent', {
          paymentId: paymentRecord.paymentId,
          status: paymentRecord.status,
          amount: paymentRecord.transactionAmount,
          accessGranted: paymentRecord.accessGranted,
          emailsSent: true,
        })
      );
    } catch (error) {
      logger.error(`Error registering successful payment: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error registering payment', { error: (error as Error).message }));
    }
  };

  submitPaymentFormData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Usamos multer para manejar la subida del archivo
      uploadPaymentTicket.single('paymentTicket')(req, res, async (err: unknown) => {
        if (err) {
          const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
          return res.status(400).json(prepareResponse(400, errorMessage));
        }

        try {
          // Verificar que el archivo de comprobante de pago fue subido
          if (!req.file) {
            return res.status(400).json(prepareResponse(400, 'El comprobante de pago es obligatorio'));
          }

          // Extraemos los datos del body
          const {
            courseId,
            courseName,
            coursePrice,
            finalPrice,
            studentName,
            studentEmail,
            comments,
            modality,
            startDate,
            days,
            time,
            promotionalCodeApplied,
            promotionalCode,
            discountAmount,
            discountType,
          } = req.body;

          // Preparar los datos para el servicio
          const paymentData = {
            courseId,
            courseName,
            coursePrice: Number(coursePrice),
            finalPrice: finalPrice ? Number(finalPrice) : undefined,
            studentName,
            studentEmail,
            comments,
            modality,
            startDate: startDate ? new Date(startDate) : undefined,
            days: typeof days === 'string' ? JSON.parse(days) : days,
            time,
            paymentTicket: req.file.filename, // Guardamos solo el nombre del archivo

            // Campos promocionales
            promotionalCodeApplied: promotionalCodeApplied === 'true',
            promotionalCode: promotionalCode || undefined,
            discountAmount: discountAmount ? Number(discountAmount) : undefined,
            discountType: discountType || undefined,
          };

          // Enviar al servicio para procesamiento
          const payment = await this.paymentService.submitPayment(paymentData);

          return res.json(prepareResponse(201, 'Solicitud de pago enviada correctamente', payment));
        } catch (error) {
          logger.error(`Error al enviar pago: ${(error as Error).message}`);
          return res.status(500).json(prepareResponse(500, 'Error inesperado', { error: (error as Error).message }));
        }
      });
    } catch (error) {
      return next(error);
    }
  };

  // Crear PaymentRequest provisional (autenticado)
  createPaymentRequest = async (req: Request, res: Response) => {
    try {
      const {
        courseId,
        courseName,
        coursePrice,
        finalPrice,
        studentName,
        studentEmail,
        promotionalCodeApplied,
        promotionalCode,
        discountAmount,
        discountType,
      } = req.body;

      if (!courseId || !courseName || coursePrice === undefined || !studentEmail || !studentName) {
        return res.status(400).json(prepareResponse(400, 'courseId, courseName, coursePrice, studentName y studentEmail son requeridos'));
      }

      const paymentData: Partial<IPaymentRequest> = {
        courseId,
        courseName,
        coursePrice: Number(coursePrice),
        finalPrice: finalPrice ? Number(finalPrice) : undefined,
        studentName,
        studentEmail,
        promotionalCodeApplied: promotionalCodeApplied === true || promotionalCodeApplied === 'true',
        promotionalCode: promotionalCode || undefined,
        discountAmount: discountAmount ? Number(discountAmount) : undefined,
        discountType: discountType || undefined,
      };

      const payment = await this.paymentService.createPaymentRequest(paymentData);

      return res.status(201).json(prepareResponse(201, 'PaymentRequest provisional creado', { paymentRequestId: payment._id }));
    } catch (error) {
      logger.error(`Error creating provisional payment request: ${(error as Error).message}`);
      return res.status(500).json(prepareResponse(500, 'Error creando PaymentRequest', { error: (error as Error).message }));
    }
  };

  // Validar código promocional y crear PaymentRequest en una sola llamada
  validateAndCreatePaymentRequest = async (req: Request, res: Response) => {
    try {
      const {
        courseId,
        courseName,
        coursePrice,
        studentName,
        studentEmail,
        promotionalCode,
        userId,
      } = req.body;

      if (!courseId || !courseName || coursePrice === undefined || !studentEmail || !studentName) {
        return res
          .status(400)
          .json(prepareResponse(400, 'courseId, courseName, coursePrice, studentName y studentEmail son requeridos'));
      }

      // Determinar userId para validación (prefiere el body, luego req.user)
      const userIdToValidate = userId || req.user?._id;

      let finalPrice: number | undefined = undefined;
      let discountAmount: number | undefined = undefined;
      let discountType: string | undefined = undefined;

      if (promotionalCode) {
        const validation = await promotionalCodeService.validatePromotionalCode(
          promotionalCode.trim().toUpperCase(),
          courseId,
          userIdToValidate ? String(userIdToValidate) : `anonymous_${Date.now()}`,
          Number(coursePrice)
        );

        if (!validation.isValid) {
          return res.status(400).json(prepareResponse(400, validation.message, validation));
        }

        finalPrice = validation.finalPrice;
        discountAmount = validation.discountAmount;
        discountType = (validation.promotionalCode && (validation.promotionalCode as any).discountType) || undefined;
      }

      const paymentData: Partial<IPaymentRequest> = {
        courseId,
        courseName,
        coursePrice: Number(coursePrice),
        finalPrice: finalPrice !== undefined ? Number(finalPrice) : undefined,
        studentName,
        studentEmail,
        promotionalCodeApplied: Boolean(promotionalCode),
        promotionalCode: promotionalCode || undefined,
        discountAmount: discountAmount !== undefined ? Number(discountAmount) : undefined,
        discountType: discountType || undefined,
      };

      const payment = await this.paymentService.createPaymentRequest(paymentData);

      return res.status(201).json(
        prepareResponse(201, 'PaymentRequest provisional creado (validación incluida)', {
          paymentRequestId: payment._id,
          finalPrice: payment.finalPrice,
        })
      );
    } catch (error) {
      logger.error(`Error creating validated PaymentRequest: ${(error as Error).message}`);
      return res.status(500).json(prepareResponse(500, 'Error creando PaymentRequest validado', { error: (error as Error).message }));
    }
  };

  // Endpoint para obtener estadísticas de pagos de MercadoPago
  getPaymentStats = async (req: Request, res: Response) => {
    try {
      const stats = await this.mercadoPagoPaymentService.getPaymentStats();

      return res.json(prepareResponse(200, 'Payment stats retrieved successfully', stats));
    } catch (error) {
      logger.error(`Error getting payment stats: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error getting payment stats', { error: (error as Error).message }));
    }
  };

  // Endpoint para obtener lista de pagos de MercadoPago
  getAllPayments = async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const payments = await this.mercadoPagoPaymentService.getAllPayments(limit);

      return res.json(prepareResponse(200, 'Payments retrieved successfully', payments));
    } catch (error) {
      logger.error(`Error getting payments: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error getting payments', { error: (error as Error).message }));
    }
  };

  // Endpoint para verificar si un pago existe
  checkPaymentExists = async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json(prepareResponse(400, 'Payment ID is required'));
      }

      const payment = await this.mercadoPagoPaymentService.getPaymentByAnyId(paymentId);

      if (!payment) {
        return res
          .status(404)
          .json(prepareResponse(404, 'Payment not found', { exists: false }));
      }

      return res.json(
        prepareResponse(200, 'Payment exists', {
          exists: true,
          payment: {
            _id: payment._id,
            paymentId: payment.paymentId,
            studentEmail: payment.studentEmail,
            amount: payment.transactionAmount,
            status: payment.status,
            courseId: payment.courseId,
          },
        })
      );
    } catch (error) {
      logger.error(`Error checking payment: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error checking payment', { error: (error as Error).message }));
    }
  };

  // Endpoint para eliminar pagos antiguos
  // bulk delete endpoint removed; keep single delete only

  // Endpoint para eliminar un pago específico
  deletePayment = async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json(prepareResponse(400, 'ID de pago requerido'));
      }

      logger.info('Intentando eliminar pago', { paymentId });

      const result = await this.mercadoPagoPaymentService.deletePayment(paymentId);

      if (result.deletedCount === 0) {
        logger.warn('Pago no encontrado para eliminar', { paymentId });
        return res
          .status(404)
          .json(
            prepareResponse(
              404,
              'Pago no encontrado. El ID de pago puede ser incorrecto o el pago ya fue eliminado.'
            )
          );
      }

      logger.info('Pago eliminado exitosamente', { paymentId });
      return res.json(prepareResponse(200, 'Pago eliminado exitosamente', { deletedCount: result.deletedCount }));
    } catch (error) {
      logger.error(`Error al eliminar pago: ${(error as Error).message}`);
      return res
        .status(500)
        .json(prepareResponse(500, 'Error al eliminar pago', { error: (error as Error).message }));
    }
  };
}
