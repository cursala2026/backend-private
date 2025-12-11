import path from 'path';
import { sendEmail } from '../utils/emailer';
import config from '@/config';
import { IPaymentRequest } from '@/models';
import PaymentRepository from '@/repositories/payment.repository';

export default class PaymentService {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  /**
   * Submits a new payment request and sends notification emails
   * @param paymentData Payment request data including course information and payment ticket filename
   * @returns The created payment request
   */
  async submitPayment(paymentData: Partial<IPaymentRequest>): Promise<IPaymentRequest> {
    // First create the payment record in the database
    const result = await this.paymentRepository.submitPayment(paymentData);

    const ticketPath = path.join(__dirname, `../static/payments/${paymentData.paymentTicket}`);
    // Send notification email to the admin
    await sendEmail({
      email: config.INFO_EMAIL!,
      subject: 'Nuevo Pago Recibido - Cursala',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nuevo Pago Recibido</h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
      Se ha recibido un nuevo pago con los siguientes detalles:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Nombre:</td>
        <td style="padding: 8px 0; color: #34495e;">${paymentData.studentName || 'N/A'}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Email:</td>
        <td style="padding: 8px 0; color: #34495e;">${paymentData.studentEmail || 'N/A'}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Curso:</td>
        <td style="padding: 8px 0; color: #34495e;">${paymentData.courseName || 'N/A'}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Monto:</td>
        <td style="padding: 8px 0; color: #34495e;">
          ${
            paymentData.promotionalCodeApplied
              ? `
              <div>
                <span style="text-decoration: line-through; color: #7f8c8d;">$${paymentData.coursePrice}</span>
                <span style="color: #27ae60; font-weight: bold; margin-left: 8px;">$${paymentData.finalPrice}</span>
              </div>
              <div style="font-size: 12px; color: #27ae60; margin-top: 4px;">
                💰 Descuento aplicado: ${paymentData.promotionalCode}
                (-$${paymentData.discountAmount})
              </div>
            `
              : `$${paymentData.coursePrice || 'N/A'}`
          }
        </td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; vertical-align: top;">Fecha:</td>
        <td style="padding: 8px 0; color: #34495e;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
      </div>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
      Por favor, verifique el pago y active el acceso al curso para el usuario.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
      <p style="color: #7f8c8d; font-size: 14px;">
        <strong>Sistema de Notificaciones - Cursala</strong>
      </p>
      </div>
      </div>
      </div>
      `,
      attachments: paymentData.paymentTicket
        ? [
            {
              filename: paymentData.paymentTicket,
              path: ticketPath,
            },
          ]
        : [],
    });

    // Send confirmation email to the user
    if (paymentData.studentEmail) {
      await sendEmail({
        email: paymentData.studentEmail,
        subject: 'Confirmación de Pago - Cursala',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Confirmación de Pago</h2>
            
            <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
              Hola <strong>${paymentData.studentName || ''}</strong>,
            </p>
            
            <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
              ¡Gracias por tu pago! Hemos recibido tu comprobante de pago para el siguiente curso:
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Curso:</td>
                  <td style="padding: 8px 0; color: #34495e;">${paymentData.courseName || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Monto:</td>
                  <td style="padding: 8px 0; color: #34495e;">
                    ${
                      paymentData.promotionalCodeApplied
                        ? `
                        <div>
                          <span style="text-decoration: line-through; color: #7f8c8d;">$${paymentData.coursePrice}</span>
                          <span style="color: #27ae60; font-weight: bold; margin-left: 8px;">$${paymentData.finalPrice}</span>
                        </div>
                        <div style="font-size: 12px; color: #27ae60; margin-top: 4px;">
                          ¡Descuento aplicado con código ${paymentData.promotionalCode}!
                          Ahorraste $${paymentData.discountAmount}
                        </div>
                      `
                        : `$${paymentData.coursePrice || 'N/A'}`
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Fecha:</td>
                  <td style="padding: 8px 0; color: #34495e;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
              Nuestro equipo está procesando tu pago y en breve activará tu acceso al curso. 
              Recibirás una notificación cuando puedas acceder.
            </p>
            
            <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
              Si tienes alguna pregunta o inquietud, no dudes en contactarnos a <a href="mailto:${config.INFO_EMAIL}" style="color: #3498db;">${config.INFO_EMAIL}</a>.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #7f8c8d; font-size: 14px;">
                Saludos cordiales,<br>
                <strong>El Equipo de Cursala</strong>
              </p>
            </div>
          </div>
        </div>
        `,
      });
    }

    return result;
  }
}
