import { FileMaterialSchema, IFileMaterial, FileMaterialType, FileMaterialCategory, FileMaterialDoc } from '@/models/mongo/fileMaterial.model';
import { Connection, Model, Types } from '@/models';
import { UserStatus } from '@/models';
import mongoose from 'mongoose';

class FileMaterialRepository {
  private readonly model: Model<IFileMaterial>;
  private anyModel: import('@/models/mongo/genericMongo.model').AnyModel<IFileMaterial>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IFileMaterial>('FileMaterial', FileMaterialSchema, 'filematerials');
    this.anyModel = this.model as import('@/models/mongo/genericMongo.model').AnyModel<IFileMaterial>;
  }

  /**
   * Crear un nuevo material/plantilla
   */
  async create(data: {
    name: string;
    description?: string;
    fileName: string;
    originalFileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    type: FileMaterialType;
    category: FileMaterialCategory;
    isPublic: boolean;
    uploadedBy: string | unknown;
  }): Promise<FileMaterialDoc | IFileMaterial> {
    try {
      // Accept both string IDs and ObjectId; normalize uploadedBy to ObjectId | undefined.
      const uploadedBy = typeof data.uploadedBy === 'string'
        ? (new Types.ObjectId(data.uploadedBy) as unknown as IFileMaterial['uploadedBy'])
        : (data.uploadedBy as unknown as IFileMaterial['uploadedBy'] | undefined);
      const payload: Partial<IFileMaterial> = { ...data, uploadedBy };
      const created = (await this.anyModel.create(payload) as unknown) as FileMaterialDoc;
      return created;
    } catch (error) {
      throw new Error(`Error al crear el material: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener material por ID
   */
  async findById(id: string): Promise<FileMaterialDoc | IFileMaterial | null> {
    try {
      return (await this.model.findById(id).populate('uploadedBy', 'firstName lastName email').exec()) as FileMaterialDoc | null;
    } catch (error) {
      throw new Error(`Error al buscar material por ID: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales con paginación y filtros
   */
  async findWithPagination(
    query: Record<string, unknown> = {},
    options: { page?: number; limit?: number; sort?: string } = {}
  ): Promise<unknown> {
    try {
      const { page = 1, limit = 10, sort = '-createdAt' } = options;

      const filter = ({
        status: UserStatus.ACTIVE,
        ...query,
      } as unknown) as import('mongoose').QueryFilter<IFileMaterial>;

      const mongooseOptions = {
        page,
        limit,
        sort,
        populate: { path: 'uploadedBy', select: 'firstName lastName email' },
        lean: false,
      };

      if (typeof this.anyModel.paginate !== 'function') {
        throw new Error('Pagination plugin not available on model');
      }
      // paginate is declared in augmentation `src/types/mongoose-paginate.d.ts`
      return await this.anyModel.paginate(filter, mongooseOptions);
    } catch (error) {
      throw new Error(`Error al obtener materiales paginados: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales públicos (para profesores/estudiantes)
   */
  async findPublicMaterials(
    type?: FileMaterialType,
    category?: FileMaterialCategory,
    options: { page?: number; limit?: number; sort?: string } = {}
  ): Promise<unknown> {
    try {
      const query: Record<string, unknown> = { isPublic: true, status: UserStatus.ACTIVE };
      if (type) query.type = type;
      if (category) query.category = category;
      return await this.findWithPagination(query, options);
    } catch (error) {
      throw new Error(`Error al obtener materiales públicos: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales subidos por un usuario específico
   */
  async findByUser(userId: string, options: { page?: number; limit?: number; sort?: string } = {}): Promise<unknown> {
    try {
      const rawQuery = { uploadedBy: String(userId), status: UserStatus.ACTIVE };
      return await this.findWithPagination(rawQuery as unknown as import('mongoose').QueryFilter<IFileMaterial>, options);
    } catch (error) {
      throw new Error(`Error al obtener materiales del usuario: ${(error as Error).message}`);
    }
  }

  /**
   * Actualizar material por ID
   */
  async updateById(
    id: string,
    updateData: { name?: string; description?: string; isPublic?: boolean; status?: UserStatus }
  ): Promise<FileMaterialDoc | IFileMaterial | null> {
    try {
      return (await this.model
        .findByIdAndUpdate(id, { ...updateData, updatedAt: new Date() }, { new: true, runValidators: true })
        .populate('uploadedBy', 'firstName lastName email')
        .exec()) as FileMaterialDoc | null;
    } catch (error) {
      throw new Error(`Error al actualizar material: ${(error as Error).message}`);
    }
  }

  /**
   * Eliminar material (soft delete)
   */
  async deleteById(id: string): Promise<FileMaterialDoc | IFileMaterial | null> {
    try {
      return (await this.model
        .findByIdAndUpdate(id, { status: UserStatus.INACTIVE, updatedAt: new Date() }, { new: true })
        .exec()) as FileMaterialDoc | null;
    } catch (error) {
      throw new Error(`Error al eliminar material: ${(error as Error).message}`);
    }
  }

  /**
   * Incrementar contador de descargas
   */
  async incrementDownloadCount(id: string): Promise<FileMaterialDoc | IFileMaterial | null> {
    try {
      return (await this.model
        .findByIdAndUpdate(id, { $inc: { downloadCount: 1 }, updatedAt: new Date() }, { new: true })
        .exec()) as FileMaterialDoc | null;
    } catch (error) {
      throw new Error(`Error al incrementar contador de descargas: ${(error as Error).message}`);
    }
  }

  /**
   * Verificar si existe un material con el mismo nombre
   */
  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    try {
      const query: Record<string, unknown> = { name, status: UserStatus.ACTIVE };
      if (excludeId) query._id = { $ne: excludeId };
      const count = await this.model.countDocuments(query).exec();
      return count > 0;
    } catch (error) {
      throw new Error(`Error al verificar existencia del material: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener estadísticas de materiales
   */
  async getStats(): Promise<{ totalMaterials: number; totalDownloads: number }> {
    try {
      const pipeline = [
        { $match: { status: UserStatus.ACTIVE } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalDownloads: { $sum: '$downloadCount' },
            byType: { $push: { type: '$type', count: 1 } },
            byCategory: { $push: { category: '$category', count: 1 } },
          },
        },
      ];

      if (typeof this.anyModel.aggregate !== 'function') {
        throw new Error('Aggregate not available on model');
      }
      const result = await this.anyModel.aggregate(pipeline) as unknown[];
      const r = (result[0] as unknown) as { total?: number; totalDownloads?: number } | undefined;
      const total = r?.total ?? 0;
      const totalDownloads = r?.totalDownloads ?? 0;
      return { totalMaterials: total, totalDownloads };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${(error as Error).message}`);
    }
  }
}

export default FileMaterialRepository;
