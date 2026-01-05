import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { logger, maskSensitiveFields } from '../utils';

// Validar token de acceso según entorno
const getAccessToken = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const testToken = process.env.MERCADOPAGO_ACCESS_TOKEN_TEST;
  const prodToken = process.env.MERCADOPAGO_ACCESS_TOKEN_PROD;
  const fallbackToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Usar el token que esté disponible, priorizando el específico del entorno
  let token: string | undefined;

  if (isDevelopment) {
    token = testToken || fallbackToken;
    if (!token) {
      throw new Error(
        'MERCADOPAGO_ACCESS_TOKEN is required for development. Set MERCADOPAGO_ACCESS_TOKEN in your .env file.'
      );
    }
    if (token.startsWith('TEST-')) {
      logger.info('🔧 Using MercadoPago TEST environment');
    } else {
      logger.warn('⚠️ Development environment detected but using non-TEST token');
    }
    return token;
  }
  token = prodToken || fallbackToken;
  if (!token) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN is required for production');
  }
  if (token.startsWith('APP_USR-')) {
    logger.info('🚀 Using MercadoPago PRODUCTION environment');
  } else {
    logger.warn('⚠️ Production environment detected but using non-PROD token');
  }
  return token;
};

// Configuración de MercadoPago
const mercadoPagoConfig = new MercadoPagoConfig({
  accessToken: getAccessToken(),
  options: {
    timeout: 5000,
    idempotencyKey: 'abc',
  },
});

const preference = new Preference(mercadoPagoConfig);
const payment = new Payment(mercadoPagoConfig);

interface PaymentItem {
  id: string;
  title: string;
  description: string;
  quantity: number;
  currency_id: string;
  unit_price: number;
  category_id?: string;
}

interface PaymentPayer {
  first_name: string;
  last_name: string;
  email: string;
  phone?: {
    area_code?: string;
    number?: string;
  };
  identification?: {
    type?: string;
    number?: string;
  };
  address?: {
    street_name?: string;
    street_number?: number;
    zip_code?: string;
  };
}

interface CreatePreferenceData {
  items: PaymentItem[];
  payer: PaymentPayer;
  payment_methods?: {
    excluded_payment_types?: unknown[];
    excluded_payment_methods?: unknown[];
    installments?: number;
  };
  back_urls?: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: string;
  external_reference?: string;
  notification_url?: string;
  additional_info?: {
    payer?: {
      first_name?: string;
      last_name?: string;
      phone?: {
        area_code?: string;
        number?: string;
      };
      address?: {
        street_name?: string;
        street_number?: number;
        zip_code?: string;
      };
    };
    items?: PaymentItem[];
  };
  metadata?: {
    device_id?: string;
  };
}

/**
 * Crear una preferencia de pago en MercadoPago
 */
export const createPaymentPreference = async (data: CreatePreferenceData) => {
  try {
    logger.info('Creating MercadoPago payment preference', {
      body: maskSensitiveFields(data),
    });

    // Configurar URLs con valores por defecto
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
    // Usar WEBHOOK_URL (ngrok) si está disponible, sino usar BACKEND_URL
    const webhookBaseUrl = (process.env.WEBHOOK_URL || backendUrl).replace(/\/$/, '');
    const backendApiUrl = `${backendUrl}/api/v1`;
    const webhookApiUrl = `${webhookBaseUrl}/api/v1`;

    logger.info('Webhook configuration', {
      webhookBaseUrl: webhookBaseUrl,
      webhookUrl: `${webhookApiUrl}/payment/webhook`,
      isNgrok: !!process.env.WEBHOOK_URL,
    });

    // Definir back_urls simples sin query parameters para evitar problemas con auto_return
    const backUrls = {
      success: data.back_urls?.success || `${frontendUrl}/alumno/payment/success`,
      failure: data.back_urls?.failure || `${frontendUrl}/alumno/payment/failure`,
      pending: data.back_urls?.pending || `${frontendUrl}/alumno/payment/pending`,
    };

    // Preparar datos base de la preferencia (campos requeridos por el tipo)
    const preferenceData: Record<string, unknown> = {
      items: data.items,
      payer: {
        first_name: data.payer.first_name,
        last_name: data.payer.last_name,
        email: data.payer.email,
        ...(data.payer.phone && { phone: data.payer.phone }),
        ...(data.payer.identification && { identification: data.payer.identification }),
        ...(data.payer.address && { address: data.payer.address }),
      },
      purpose: 'wallet_purchase', // Fuerza el contexto de compra vía billetera (permite dinero en cuenta)
      payment_methods: data.payment_methods || {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 12,
      },
      back_urls: backUrls,
      external_reference: data.external_reference,
      notification_url: data.notification_url || `${webhookApiUrl}/payment/webhook`,
      statement_descriptor: 'CURSALA',
    };

    // Agregar campos opcionales si están disponibles
    if (data.additional_info) {
      preferenceData.additional_info = data.additional_info;
    }

    if (data.metadata) {
      preferenceData.metadata = data.metadata;
    }

    logger.info('Preference data for MercadoPago', {
      preferenceData: JSON.stringify(maskSensitiveFields(preferenceData), null, 2),
    });

    // Estructurar la petición de forma explícita
    // NOTA: auto_return requiere que back_urls también sean HTTPS (no solo el webhook)
    // En desarrollo local con frontend en http://localhost:4200, no podemos usar auto_return
    // El usuario debe hacer clic en "Volver al sitio" manualmente
    const createBody: any = {
      body: {
        items: preferenceData.items,
        payer: preferenceData.payer,
        payment_methods: preferenceData.payment_methods,
        back_urls: {
          success: backUrls.success,
          failure: backUrls.failure,
          pending: backUrls.pending,
        },
        external_reference: preferenceData.external_reference,
        notification_url: preferenceData.notification_url,
        statement_descriptor: preferenceData.statement_descriptor,
      }
    };

    // Agregar campos opcionales solo si existen
    if (preferenceData.additional_info) {
      createBody.body.additional_info = preferenceData.additional_info;
    }
    if (preferenceData.metadata) {
      createBody.body.metadata = preferenceData.metadata;
    }

    const response = await preference.create(createBody as unknown as Parameters<typeof preference.create>[0]);

    // Determinar qué URL usar según el modo de MercadoPago
    const mode = process.env.MERCADOPAGO_MODE || 'production';
    const preferredInitPoint = mode === 'sandbox' ? response.sandbox_init_point : response.init_point;

    logger.info('Payment preference created successfully', {
      preferenceId: response.id,
      mode: mode,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
      preferredInitPoint: preferredInitPoint,
    });

    return {
      id: response.id,
      initPoint: preferredInitPoint || response.init_point || response.sandbox_init_point,
      sandboxInitPoint: response.sandbox_init_point,
      mode: mode,
    };
  } catch (error: unknown) {
    const err = error as { message?: string; cause?: unknown; apiResponse?: unknown; status?: number; details?: unknown; stack?: string };
    // Log detallado del error de MercadoPago
    logger.error('❌ MercadoPago API Error Details', {
      message: err.message,
      cause: err.cause,
      apiResponse: maskSensitiveFields(err.apiResponse as unknown),
      status: err.status,
      details: err.details,
      stack: err.stack,
    });

    // Extraer mensaje específico del error
    let errorMessage = 'Error al crear la preferencia de pago';

    const apiBody = (err as unknown as { apiResponse?: { body?: unknown } }).apiResponse?.body;
    if (apiBody) {
      errorMessage = `MercadoPago API Error: ${JSON.stringify(apiBody)}`;
    } else if (err.message) {
      errorMessage = `MercadoPago Error: ${err.message}`;
    }

    throw new Error(errorMessage);
  }
};

/**
 * Obtener información de un pago
 */
export const getPaymentInfo = async (paymentId: string) => {
  try {
    logger.info('Getting payment information', { paymentId });

    const paymentInfo = await payment.get({ id: paymentId });

    logger.info('Payment information retrieved', {
      paymentId,
      status: paymentInfo.status,
      amount: paymentInfo.transaction_amount,
    });

    return paymentInfo;
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Error getting payment information', {
      paymentId,
      error: err.message,
    });
    throw new Error(`Error al obtener información del pago: ${err.message}`);
  }
};

/**
 * Procesar notificación de webhook
 */
export const processWebhookNotification = async (notificationData: unknown) => {
  try {
    const notif = notificationData as { type?: string; data?: { id?: string } };
    logger.info('Processing webhook notification', {
      type: notif.type,
      id: notif.data?.id,
    });

    if (notif.type === 'payment' && notif.data?.id) {
      const paymentId = notif.data.id;
      const paymentInfo = await getPaymentInfo(paymentId);

      logger.info('Webhook payment processed', {
        paymentId,
        status: paymentInfo.status,
        externalReference: paymentInfo.external_reference,
      });

      return {
        paymentId,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail,
        amount: paymentInfo.transaction_amount,
        externalReference: paymentInfo.external_reference,
        payer: {
          email: paymentInfo.payer?.email,
          id: paymentInfo.payer?.id,
        },
        transactionDate: paymentInfo.date_created,
      };
    }

    return null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Error processing webhook notification', {
      error: err.message,
      notificationData: maskSensitiveFields(notificationData as unknown),
    });
    throw new Error(`Error al procesar notificación de webhook: ${err.message}`);
  }
};

/**
 * Validar configuración de MercadoPago
 */
export const validateMercadoPagoConfig = () => {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN environment variable is required');
  }

  return true;
};
