import { ICompanySpecificData } from '@/models';
import CompanySpecificDataRepository from '@/repositories/companySpecificData.repository';

class CompanySpecificDataService {
  constructor(private readonly companySpecificDataRepository: CompanySpecificDataRepository) {}

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
    updateData: Partial<Pick<ICompanySpecificData, 'privacyPolicy'>>
  ): Promise<ICompanySpecificData> {
    try {
      if (!updateData.privacyPolicy) {
        throw new Error('Debes proporcionar la política de privacidad para actualizar.');
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
}

export default CompanySpecificDataService;
