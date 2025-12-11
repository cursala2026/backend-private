import { sendEmail } from '../utils/emailer';
import { IRequestACourse } from '@/models/mongo/requestACourse.model';
import RequestACourseRepository from '@/repositories/requestACourse.repository';
import { CorporateMails } from '@/models/enums';

export default class RequestACourseService {
  constructor(private readonly requestACourseRepository: RequestACourseRepository) {}

  async getAllRequestACourse() {
    return this.requestACourseRepository.findAll();
  }

  async getRequestACourseById(id: string) {
    return this.requestACourseRepository.findById(id);
  }

  async createRequestACourse(data: Partial<IRequestACourse>) {
    const result = await this.requestACourseRepository.create(data);

    await sendEmail({
      email: CorporateMails.INFO,
      subject: 'Nueva Solicitud de Capacitación - Cursala',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Nueva Solicitud de Curso Recibida</h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
      Se ha recibido una nueva solicitud de curso con los siguientes detalles:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <table style="width: 100%; border-collapse: collapse;">
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Nombre:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.name}</td>
      </tr>
      <tr>
      <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Empresa:</td>
      <td style="padding: 8px 0; color: #34495e;">${data.company}</td>
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
      Por favor, revise esta solicitud y tome las acciones correspondientes.
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
    await sendEmail({
      email: data.email!,
      subject: 'Solicitud de Capacitacion Recibida - Cursala',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">Solicitud de Curso Recibida</h2>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 20px;">
        Hola <strong>${data.name}</strong>,
      </p>
      
      <p style="color: #34495e; font-size: 16px; margin-bottom: 30px;">
        ¡Gracias por tu interés en nuestros cursos! Hemos recibido tu solicitud con los siguientes detalles:
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold; width: 30%;">Nombre:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.name}</td>
        </tr>
        <tr>
        <td style="padding: 8px 0; color: #2c3e50; font-weight: bold;">Empresa/Persona:</td>
        <td style="padding: 8px 0; color: #34495e;">${data.company}</td>
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
        Nuestro equipo revisará tu solicitud y te contactará pronto con más información.
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

    return result;
  }

  async updateRequestACourseById(id: string, data: Partial<IRequestACourse>) {
    return this.requestACourseRepository.updateById(id, data);
  }

  async deleteRequestACourseById(id: string) {
    return this.requestACourseRepository.deleteById(id);
  }
}
