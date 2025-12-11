import fs from 'fs';
import path from 'path';
import { Types } from '@/models';
import mongoose from 'mongoose';
import { FileMaterialType, FileMaterialCategory, IFileMaterial } from '@models/mongo';
import { UserStatus } from '@models/enums';
import { uploadDirMaterials } from '@utils/fileUpload.util';
import { logger } from '../utils';
import { fileMaterialRepository } from '@/repositories';

interface CreateFileMaterialData {
  name: string;
  description?: string;
  type: FileMaterialType;
  category: FileMaterialCategory;
  isPublic: boolean;
  uploadedBy: string;
  file: {
    mimetype: string;
    filename: string;
    originalname: string;
    size: number;
  };
}

interface UpdateFileMaterialData {
  name?: string;
  description?: string;
  isPublic?: boolean;
  status?: UserStatus;
}

interface FileMaterialFilters {
  type?: FileMaterialType;
  category?: FileMaterialCategory;
  isPublic?: boolean;
  uploadedBy?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export class FileMaterialService {
  /**
   * Crear un nuevo material/plantilla
   */
  async createFileMaterial(data: CreateFileMaterialData): Promise<IFileMaterial> {
    try {
      // Verificar si ya existe un material con el mismo nombre
      const existingMaterial = await fileMaterialRepository.existsByName(data.name);
      if (existingMaterial) {
        throw new Error('Ya existe un material con este nombre');
      }

      // Determinar categoría automáticamente basado en el tipo MIME si no se especifica
      const { category: inputCategory } = data;
      let category = inputCategory;
      if (category === FileMaterialCategory.OTHER) {
        category = this.determineCategoryFromMimeType(data.file.mimetype);
      }

      // Usar el nombre asignado por multer (ya guardado en disco)
      const uniqueFileName = data.file.filename;

      // Construir URL del archivo
      const fileUrl = `/static/materials/${uniqueFileName}`;

      // Preparar datos para el repositorio
      const materialData = {
        name: data.name,
        description: data.description,
        fileName: uniqueFileName,
        originalFileName: data.file.originalname,
        fileUrl,
        fileSize: data.file.size,
        mimeType: data.file.mimetype,
        type: data.type,
        category,
        isPublic: data.isPublic,
        uploadedBy: new Types.ObjectId(data.uploadedBy),
      };

      // Crear el registro en la base de datos
      const createdMaterial = await fileMaterialRepository.create(materialData);

      return createdMaterial;
    } catch (error) {
      throw new Error(`Error al crear material: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener material por ID
   */
  async getFileMaterialById(id: string): Promise<IFileMaterial | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('ID de material inválido');
      }

      return await fileMaterialRepository.findById(id);
    } catch (error) {
      throw new Error(`Error al obtener material: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales con filtros y paginación
   */
  async getFileMaterials(filters: FileMaterialFilters = {}) {
    try {
      const { type, category, isPublic, uploadedBy, page = 1, limit = 10, sort = '-createdAt' } = filters;

      const rawQuery: Record<string, unknown> = {};
      if (type) rawQuery.type = type;
      if (category) rawQuery.category = category;
      if (isPublic !== undefined) rawQuery.isPublic = isPublic;
      if (uploadedBy) rawQuery.uploadedBy = String(uploadedBy);

      const options = { page, limit, sort };

      return await fileMaterialRepository.findWithPagination(rawQuery, options);
    } catch (error) {
      throw new Error(`Error al obtener materiales: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales públicos (para profesores y estudiantes)
   */
  async getPublicMaterials(
    type?: FileMaterialType,
    category?: FileMaterialCategory,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const options = { page, limit, sort: '-createdAt' };
      return await fileMaterialRepository.findPublicMaterials(type, category, options);
    } catch (error) {
      throw new Error(`Error al obtener materiales públicos: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener materiales subidos por un usuario
   */
  async getUserMaterials(userId: string, page: number = 1, limit: number = 10) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('ID de usuario inválido');
      }

      const options = { page, limit, sort: '-createdAt' };
      return await fileMaterialRepository.findByUser(userId, options);
    } catch (error) {
      throw new Error(`Error al obtener materiales del usuario: ${(error as Error).message}`);
    }
  }

  /**
   * Actualizar material
   */
  async updateFileMaterial(id: string, updateData: UpdateFileMaterialData): Promise<IFileMaterial | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('ID de material inválido');
      }

      // Verificar si el material existe
      const existingMaterial = await fileMaterialRepository.findById(id);
      if (!existingMaterial) {
        throw new Error('Material no encontrado');
      }

      // Verificar nombre único si se está actualizando el nombre
      if (updateData.name && updateData.name !== existingMaterial.name) {
        const nameExists = await fileMaterialRepository.existsByName(updateData.name, id);
        if (nameExists) {
          throw new Error('Ya existe un material con este nombre');
        }
      }

      return await fileMaterialRepository.updateById(id, updateData);
    } catch (error) {
      throw new Error(`Error al actualizar material: ${(error as Error).message}`);
    }
  }

  /**
   * Eliminar material (soft delete)
   */
  async deleteFileMaterial(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('ID de material inválido');
      }

      // Verificar si el material existe
      const existingMaterial = await fileMaterialRepository.findById(id);
      if (!existingMaterial) {
        throw new Error('Material no encontrado');
      }

      // Realizar soft delete
      const deletedMaterial = await fileMaterialRepository.deleteById(id);

      // Eliminar el archivo físico (best-effort)
      try {
        const filePath = path.join(uploadDirMaterials, existingMaterial.fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Ignoring file deletion errors as this is a best-effort operation
        logger.warn(`Failed to delete file ${existingMaterial.fileName}`, error);
      }

      return !!deletedMaterial;
    } catch (error) {
      throw new Error(`Error al eliminar material: ${(error as Error).message}`);
    }
  }

  /**
   * Descargar material
   */
  async downloadMaterial(id: string): Promise<{ filePath: string; fileName: string }> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('ID de material inválido');
      }

      const material = await fileMaterialRepository.findById(id);
      if (!material || material.status !== UserStatus.ACTIVE) {
        throw new Error('Material no encontrado o no disponible');
      }

      // Incrementar contador de descargas
      await fileMaterialRepository.incrementDownloadCount(id);

      // Ruta directa (sin fallback extra)
      const filePath = path.join(uploadDirMaterials, material.fileName);

      if (!fs.existsSync(filePath)) {
        throw new Error('Archivo no encontrado en el servidor');
      }

      return {
        filePath,
        fileName: material.originalFileName,
      };
    } catch (error) {
      throw new Error(`Error al descargar material: ${(error as Error).message}`);
    }
  }

  /**
   * Obtener estadísticas de materiales
   */
  async getMaterialStats() {
    try {
      return await fileMaterialRepository.getStats();
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${(error as Error).message}`);
    }
  }

  /**
   * Determinar categoría basado en tipo MIME
   */
  private determineCategoryFromMimeType(mimeType: string): FileMaterialCategory {
    if (mimeType === 'application/pdf') {
      return FileMaterialCategory.PDF;
    }

    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return FileMaterialCategory.WORD;
    }

    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return FileMaterialCategory.EXCEL;
    }

    if (
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      return FileMaterialCategory.POWERPOINT;
    }

    if (mimeType.startsWith('image/')) {
      return FileMaterialCategory.IMAGE;
    }

    return FileMaterialCategory.OTHER;
  }

  /**
   * Validar permisos de acceso al material
   */
  async validateMaterialAccess(materialId: string, userId: string): Promise<boolean> {
    try {
      const material = await fileMaterialRepository.findById(materialId);

      if (!material || material.status !== UserStatus.ACTIVE) {
        return false;
      }

      // Si el material es público, cualquier usuario autenticado puede acceder
      if (material.isPublic) {
        return true;
      }

      // Si no es público, solo el propietario puede acceder
      return material.uploadedBy.toString() === userId;
    } catch (error) {
      return false;
    }
  }
}

export const fileMaterialService = new FileMaterialService();
