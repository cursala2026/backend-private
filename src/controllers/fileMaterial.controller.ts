import { Request, Response } from 'express';
import { FileMaterialType, FileMaterialCategory } from '@/models';
import { UserStatus } from '@/models';
import { uploadFiles } from '@utils/fileUpload.util';
import { logger } from '../utils';
import { fileMaterialService } from '@/services';
import { ensureString } from '@utils/type-guards';

export class FileMaterialController {
  /**
   * Subir nuevo material/plantilla
   * POST /api/file-materials
   */
  uploadMaterial = async (req: Request, res: Response) => {
    uploadFiles.single('materialFile')(req, res, async (err: unknown) => {
      try {
        if (err) {
          const uploadErr = err as unknown;
          const message = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          return res.status(400).json({
            success: false,
            message: `Error de carga: ${message}`,
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No se ha subido ningún archivo',
          });
        }

        const { name, description, type, category, isPublic } = req.body;
        const authUser = (req as Request & { user?: { _id?: string } }).user;
        const userId = authUser?._id;

        // Validaciones
        if (!name || !type) {
          return res.status(400).json({
            success: false,
            message: 'El nombre y tipo son obligatorios',
          });
        }

        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
          });
        }

        // Validar tipo y categoría
        if (!Object.values(FileMaterialType).includes(type)) {
          return res.status(400).json({
            success: false,
            message: 'Tipo de material inválido',
          });
        }

        if (category && !Object.values(FileMaterialCategory).includes(category)) {
          return res.status(400).json({
            success: false,
            message: 'Categoría de material inválida',
          });
        }

        const materialData = {
          name: name.trim(),
          description: description?.trim(),
          type: type as FileMaterialType,
          category: (category as FileMaterialCategory) || FileMaterialCategory.OTHER,
          isPublic: isPublic === 'true' || isPublic === true,
          uploadedBy: userId,
          file: req.file,
        };

        const material = await fileMaterialService.createFileMaterial(materialData);

        res.status(201).json({
          success: true,
          message: 'Material subido exitosamente',
          data: material,
        });
      } catch (error) {
        logger.error('Error uploading material:', error);
        res.status(500).json({
          success: false,
          message: (error as Error).message,
        });
      }
    });
  };

  /**
   * Obtener todos los materiales con filtros
   * GET /api/file-materials
   */
  getMaterials = async (req: Request, res: Response) => {
    try {
      const { type, category, isPublic, uploadedBy, page = 1, limit = 10, sort = '-createdAt' } = req.query;

      const filters: { type?: FileMaterialType; category?: FileMaterialCategory; isPublic?: boolean; uploadedBy?: string; page?: number; limit?: number; sort?: string } = {};
      if (type) filters.type = type as unknown as FileMaterialType;
      if (category) filters.category = category as unknown as FileMaterialCategory;
      if (isPublic !== undefined) filters.isPublic = isPublic === 'true';
      if (uploadedBy) filters.uploadedBy = String(uploadedBy);

      filters.page = parseInt(page as string, 10);
      filters.limit = parseInt(limit as string, 10);
      filters.sort = String(sort);

      const materials = await fileMaterialService.getFileMaterials(filters);

      res.status(200).json({
        success: true,
        message: 'Materiales obtenidos exitosamente',
        data: materials,
      });
    } catch (error) {
      logger.error('Error getting materials:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Obtener materiales públicos (para profesores y estudiantes)
   * GET /api/file-materials/public
   */
  getPublicMaterials = async (req: Request, res: Response) => {
    try {
      const { type, category, page = 1, limit = 10 } = req.query;

      const materials = await fileMaterialService.getPublicMaterials(
        type as FileMaterialType,
        category as FileMaterialCategory,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Materiales públicos obtenidos exitosamente',
        data: materials,
      });
    } catch (error) {
      logger.error('Error getting public materials:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Obtener material por ID
   * GET /api/file-materials/:id
   */
  getMaterialById = async (req: Request, res: Response) => {
    try {
      const id = ensureString(req.params.id);

      const material = await fileMaterialService.getFileMaterialById(id);

      if (!material) {
        return res.status(404).json({
          success: false,
          message: 'Material no encontrado',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Material obtenido exitosamente',
        data: material,
      });
    } catch (error) {
      logger.error('Error getting material by ID:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Obtener materiales del usuario actual
   * GET /api/file-materials/my-materials
   */
  getMyMaterials = async (req: Request, res: Response) => {
    try {
      const authUser = (req as Request & { user?: { _id?: string } }).user;
      const userId = authUser?._id;
      const { page = 1, limit = 10 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      const materials = await fileMaterialService.getUserMaterials(
        userId,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.status(200).json({
        success: true,
        message: 'Mis materiales obtenidos exitosamente',
        data: materials,
      });
    } catch (error) {
      logger.error('Error getting user materials:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Actualizar material
   * PUT /api/file-materials/:id
   */
  updateMaterial = async (req: Request, res: Response) => {
    try {
      const id = ensureString(req.params.id);
      const { name, description, isPublic, status } = req.body;
      const authUser = (req as Request & { user?: { _id?: string } }).user;
      const userId = authUser?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      // Verificar que el usuario puede editar este material
      const existingMaterial = await fileMaterialService.getFileMaterialById(id);
      if (!existingMaterial) {
        return res.status(404).json({
          success: false,
          message: 'Material no encontrado',
        });
      }

      if (existingMaterial.uploadedBy.toString() !== userId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para editar este material',
        });
      }

      const updateData: { name?: string; description?: string; isPublic?: boolean; status?: UserStatus } = {};
      if (name !== undefined) updateData.name = String(name).trim();
      if (description !== undefined) updateData.description = String(description).trim();
      if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
      if (status !== undefined) updateData.status = status as unknown as UserStatus;

      const updatedMaterial = await fileMaterialService.updateFileMaterial(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Material actualizado exitosamente',
        data: updatedMaterial,
      });
    } catch (error) {
      logger.error('Error updating material:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Eliminar material
   * DELETE /api/file-materials/:id
   */
  deleteMaterial = async (req: Request, res: Response) => {
    try {
      const id = ensureString(req.params.id);
      const authUser = (req as Request & { user?: { _id?: string } }).user;
      const userId = authUser?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      // Verificar existencia del material
      const existingMaterial = await fileMaterialService.getFileMaterialById(id);
      if (!existingMaterial) {
        return res.status(404).json({
          success: false,
          message: 'Material no encontrado',
        });
      }

      // Ya no se valida que el usuario sea el propietario; cualquier autenticado puede eliminar
      const deleted = await fileMaterialService.deleteFileMaterial(id);

      res.status(200).json({
        success: true,
        message: 'Material eliminado exitosamente',
        data: { deleted },
      });
    } catch (error) {
      logger.error('Error deleting material:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Descargar material
   * GET /api/file-materials/:id/download
   */
  downloadMaterial = async (req: Request, res: Response) => {
    try {
      const id = ensureString(req.params.id);
      const authUser = (req as Request & { user?: { _id?: string } }).user;
      const userId = authUser?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      // Verificar permisos de acceso
      const hasAccess = await fileMaterialService.validateMaterialAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para descargar este material',
        });
      }

      const { filePath, fileName } = await fileMaterialService.downloadMaterial(id);

      // Configurar headers para la descarga
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      // Enviar archivo
      res.sendFile(filePath);
    } catch (error) {
      logger.error('Error downloading material:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };

  /**
   * Obtener estadísticas de materiales
   * GET /api/file-materials/stats
   */
  getMaterialStats = async (req: Request, res: Response) => {
    try {
      const stats = await fileMaterialService.getMaterialStats();

      res.status(200).json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting material stats:', error);
      res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  };
}

export default new FileMaterialController();
