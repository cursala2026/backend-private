import { CompanySpecificData, Connection, ICompanySpecificData, Model, Types } from '@/models';

class CompanySpecificDataRepository {
  private readonly model: Model<ICompanySpecificData>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<ICompanySpecificData>(
      'CompanySpecificData',
      CompanySpecificData.schema,
      'companySpecificData'
    );
  }

  /**
   * Obtiene todos los datos específicos de la compañía
   */
  async getAll(): Promise<ICompanySpecificData[]> {
    return this.model.find({});
  }

  /**
   * Actualiza parcialmente un campo específico
   * @param id ID del documento
   * @param updateData Objeto con el campo a actualizar
   */
  async updateCompanySpecificData(
    id: string,
    updateData: Partial<Pick<ICompanySpecificData, 'privacyPolicy' | 'termsOfService' | 'certificateLogos'>>
  ): Promise<ICompanySpecificData | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID proporcionado no es válido.');
    }
    return this.model.findByIdAndUpdate(id, updateData, { new: true });
  }
}

export default CompanySpecificDataRepository;
