import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ICompanySpecificData } from '@/models';
import CompanySpecificDataRepository from '@/repositories/companySpecificData.repository';
import BunnyService from './bunny.service';

const CERTIFICATE_LOGOS_FOLDER = 'certificate-logos';
const MAX_LOGOS = 6;

class CompanySpecificDataService {
  private readonly bunnyService: BunnyService;

  constructor(private readonly companySpecificDataRepository: CompanySpecificDataRepository) {
    this.bunnyService = BunnyService.getInstance();
  }

  /**
   * Obtiene todos los datos específicos de la compañía
   * @returns Array de datos específicos de la compañía
   */
  async getAllCompanySpecificData(): Promise<ICompanySpecificData[]> {
    try {
      return await this.companySpecificDataRepository.getAll();
    } catch (error) {
      throw new Error(
        `Error al obtener los datos específicos de la compañía: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Actualiza la política de privacidad de la compañía
   * @param id ID del documento
   * @param updateData Objeto con el campo privacyPolicy a actualizar
   * @returns Documento actualizado
   */
  async updateCompanySpecificData(
    id: string,
    updateData: Partial<Pick<ICompanySpecificData, 'privacyPolicy' | 'termsOfService' | 'certificateLogos'>>
  ): Promise<ICompanySpecificData> {
    try {
      if (!updateData.privacyPolicy && !updateData.termsOfService && !updateData.certificateLogos) {
        throw new Error('Debes proporcionar al menos un campo para actualizar.');
      }

      const updatedData = await this.companySpecificDataRepository.updateCompanySpecificData(id, updateData);

      if (!updatedData) {
        throw new Error('No se encontró el documento de datos específicos de la compañía.');
      }

      return updatedData;
    } catch (error) {
      throw new Error(
        `Error al actualizar los datos específicos de la compañía: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Sube un logo institucional al certificado (máximo 6) y guarda su URL.
   */
  async addCertificateLogo(id: string, buffer: Buffer, originalName: string): Promise<ICompanySpecificData> {
    try {
      const docs = await this.companySpecificDataRepository.getAll();
      const doc = docs.find((d) => d._id.toString() === id);
      if (!doc) throw new Error('No se encontró el documento de datos específicos de la compañía.');

      const current = doc.certificateLogos || [];
      if (current.length >= MAX_LOGOS) {
        throw new Error(`No se pueden agregar más de ${MAX_LOGOS} logos al certificado.`);
      }

      const ext = path.extname(originalName).toLowerCase() || '.png';
      const fileName = `logo-${uuidv4()}${ext}`;
      const cdnUrl = await this.bunnyService.uploadFile(buffer, fileName, CERTIFICATE_LOGOS_FOLDER);

      const updatedLogos = [...current, cdnUrl];
      const updatedData = await this.companySpecificDataRepository.updateCompanySpecificData(id, { certificateLogos: updatedLogos });

      if (!updatedData) throw new Error('No se encontró el documento de datos específicos de la compañía.');
      return updatedData;
    } catch (error) {
      throw new Error(
        `Error al agregar logo al certificado: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Elimina un logo institucional del certificado por su índice en el array.
   */
  async removeCertificateLogo(id: string, index: number): Promise<ICompanySpecificData> {
    try {
      const docs = await this.companySpecificDataRepository.getAll();
      const doc = docs.find((d) => d._id.toString() === id);
      if (!doc) throw new Error('No se encontró el documento de datos específicos de la compañía.');

      const current = doc.certificateLogos || [];
      if (index < 0 || index >= current.length) {
        throw new Error(`Índice de logo inválido: ${index}`);
      }

      const logoUrl = current[index];
      const updatedLogos = current.filter((_, i) => i !== index);
      const updatedData = await this.companySpecificDataRepository.updateCompanySpecificData(id, { certificateLogos: updatedLogos });

      // Intentar borrar de Bunny (no crítico si falla)
      if (logoUrl) {
        this.bunnyService.deleteFile(logoUrl).catch(() => {});
      }

      if (!updatedData) throw new Error('No se encontró el documento de datos específicos de la compañía.');
      return updatedData;
    } catch (error) {
      throw new Error(
        `Error al eliminar logo del certificado: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default CompanySpecificDataService;
