import { sendEmail } from '../utils/emailer';
import { CorporateMails } from '@/models/enums';
import { IIWantToTrain } from '@/models/mongo/iwanttotrain.model';
import IWantToTrainRepository from '@/repositories/iwanttotrain.repository';

export default class IWantToTrainService {
  constructor(private readonly iwantToTrainRepository: IWantToTrainRepository) {}

  async getAllIWantToTrain() {
    return this.iwantToTrainRepository.findAll();
  }

  async getIWantToTrainById(id: string) {
    return this.iwantToTrainRepository.findById(id);
  }

  async createIWantToTrain(data: Partial<IIWantToTrain>) {
    const result = await this.iwantToTrainRepository.create(data);

    try {
      await sendEmail({
      email: CorporateMails.INFO,
      subject: 'Nueva Solicitud de Capacitación - Cursala',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nueva Solicitud de Capacitación Recibida</h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
      Se ha recibido una nueva solicitud de un profesor que quiere capacitar con los siguientes detalles:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <table style="width: 100%; border-collapse: collapse;">
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Nombre:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.name}</td>
      </tr>
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Email:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.email}</td>
      </tr>
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Teléfono:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.phonePrefix} ${data.phoneNumber}</td>
      </tr>
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; vertical-align: top;">Mensaje:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.message}</td>
      </tr>
      </table>
      </div>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
      Por favor, revise esta solicitud de capacitación y tome las acciones correspondientes.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
      <p style="color: #7f8c8d; font-size: 14px;">
      <strong>Sistema de Notificaciones - Cursala</strong>
      </p>
      </div>
      </div>
      </div>
      `,
      });
    } catch (emailErr) {
      // non-fatal: log and continue
      // eslint-disable-next-line no-console
      console.warn('Failed to send admin notification email for IWantToTrain:', emailErr);
    }
    try {
      await sendEmail({
      email: data.email!,
      subject: 'Solicitud de Capacitación Recibida - Cursala',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Solicitud de Capacitación Recibida</h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
        Hola <strong>${data.name}</strong>,
      </p>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
        ¡Gracias por tu interés en capacitar con nosotros! Hemos recibido tu solicitud con los siguientes detalles:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Nombre:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.name}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Email:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.email}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Teléfono:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.phonePrefix} ${data.phoneNumber}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; vertical-align: top;">Mensaje:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.message}</td>
        </tr>
        </table>
      </div>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
        Nuestro equipo revisará tu solicitud y te contactará pronto con más información sobre nuestros programas de capacitación.
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
    } catch (emailErr) {
      // non-fatal: log and continue
      // eslint-disable-next-line no-console
      console.warn('Failed to send user confirmation email for IWantToTrain:', emailErr);
    }

    return result;
  }

  async updateIWantToTrainById(id: string, data: Partial<IIWantToTrain>) {
    return this.iwantToTrainRepository.updateById(id, data);
  }

  async deleteIWantToTrainById(id: string) {
    return this.iwantToTrainRepository.deleteById(id);
  }
}
