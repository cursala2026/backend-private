import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { logger, prepareResponse } from '../utils';
import PromotionalCodeService from '@/services/promotionalCode.service';
import { DiscountType, PromotionalCodeStatus } from '@/models/mongo/promotionalCode.model';

export default class PromotionalCodeController {
  constructor(private readonly promotionalCodeService: PromotionalCodeService) {}

  // Crear nuevo código promocional
  createPromotionalCode = async (req: Request, res: Response) => {
    try {
      const {
        code,
        name,
        description,
        discountType = DiscountType.PERCENTAGE,
        discountValue,
        applicableCourses = [],
        isGlobal = false,
        validFrom,
        validUntil,
        maxUses,
        maxUsesPerUser = 1,
        minimumPurchaseAmount,
      } = req.body;

      // Validaciones básicas
      if (!code || !name || discountValue === undefined) {
        return res.status(400).json(prepareResponse(400, 'Código, nombre y valor de descuento son obligatorios'));
      }

      if (discountValue <= 0) {
        return res.status(400).json(prepareResponse(400, 'El valor de descuento debe ser mayor a 0'));
      }

      if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
        return res.status(400).json(prepareResponse(400, 'El porcentaje de descuento no puede ser mayor a 100%'));
      }

      // Obtener usuario que crea el código
      const createdBy = req.user?._id;
      if (!createdBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const promotionalCodeData = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim(),
        discountType,
        discountValue: Number(discountValue),
        applicableCourses: isGlobal ? [] : applicableCourses,
        isGlobal,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        maxUsesPerUser: Number(maxUsesPerUser),
        minimumPurchaseAmount: minimumPurchaseAmount ? Number(minimumPurchaseAmount) : undefined,
        createdBy: new mongoose.Types.ObjectId(createdBy.toString()),
        status: PromotionalCodeStatus.ACTIVE,
      };

      const newCode = await this.promotionalCodeService.createPromotionalCode(promotionalCodeData);

      return res.status(201).json(prepareResponse(201, 'Código promocional creado exitosamente', newCode));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al crear código promocional: ${err.message}`);

      if (err.message.includes('Ya existe un código promocional')) {
        return res.status(400).json(prepareResponse(400, 'Ya existe un código promocional con ese nombre'));
      }

      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Obtener todos los códigos promocionales
  getAllPromotionalCodes = async (req: Request, res: Response) => {
    try {
      const codes = await this.promotionalCodeService.getAllPromotionalCodes();

      return res.json(prepareResponse(200, 'Códigos promocionales obtenidos exitosamente', codes));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al obtener códigos promocionales: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Obtener código promocional por ID
  getPromotionalCodeById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(prepareResponse(400, 'ID del código promocional es requerido'));
      }

      const code = await this.promotionalCodeService.getPromotionalCodeById(id);

      if (!code) {
        return res.status(404).json(prepareResponse(404, 'Código promocional no encontrado'));
      }

      return res.json(prepareResponse(200, 'Código promocional obtenido exitosamente', code));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al obtener código promocional: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Actualizar código promocional
  updatePromotionalCode = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json(prepareResponse(400, 'ID del código promocional es requerido'));
      }

      const modifiedBy = req.user?._id;
      if (!modifiedBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      // Validaciones
      if (updateData.discountValue !== undefined && updateData.discountValue <= 0) {
        return res.status(400).json(prepareResponse(400, 'El valor de descuento debe ser mayor a 0'));
      }

      if (updateData.discountType === DiscountType.PERCENTAGE && updateData.discountValue > 100) {
        return res.status(400).json(prepareResponse(400, 'El porcentaje de descuento no puede ser mayor a 100%'));
      }

      const updatedCode = await this.promotionalCodeService.updatePromotionalCode(
        id,
        updateData,
        new mongoose.Types.ObjectId(modifiedBy.toString())
      );

      if (!updatedCode) {
        return res.status(404).json(prepareResponse(404, 'Código promocional no encontrado'));
      }

      return res.json(prepareResponse(200, 'Código promocional actualizado exitosamente', updatedCode));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al actualizar código promocional: ${err.message}`);

      if (err.message.includes('Ya existe un código promocional')) {
        return res.status(400).json(prepareResponse(400, 'Ya existe un código promocional con ese nombre'));
      }

      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Pausar código promocional
  pausePromotionalCode = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(prepareResponse(400, 'ID del código promocional es requerido'));
      }

      const modifiedBy = req.user?._id;
      if (!modifiedBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const pausedCode = await this.promotionalCodeService.pausePromotionalCode(
        id,
        new mongoose.Types.ObjectId(modifiedBy.toString())
      );

      if (!pausedCode) {
        return res.status(404).json(prepareResponse(404, 'Código promocional no encontrado'));
      }

      return res.json(prepareResponse(200, 'Código promocional pausado exitosamente', pausedCode));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al pausar código promocional: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Activar código promocional
  activatePromotionalCode = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(prepareResponse(400, 'ID del código promocional es requerido'));
      }

      const modifiedBy = req.user?._id;
      if (!modifiedBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const activatedCode = await this.promotionalCodeService.activatePromotionalCode(
        id,
        new mongoose.Types.ObjectId(modifiedBy.toString())
      );

      if (!activatedCode) {
        return res.status(404).json(prepareResponse(404, 'Código promocional no encontrado'));
      }

      return res.json(prepareResponse(200, 'Código promocional activado exitosamente', activatedCode));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al activar código promocional: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Eliminar código promocional
  deletePromotionalCode = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json(prepareResponse(400, 'ID del código promocional es requerido'));
      }

      const modifiedBy = req.user?._id;
      if (!modifiedBy) {
        return res.status(401).json(prepareResponse(401, 'Usuario no autenticado'));
      }

      const deletedCode = await this.promotionalCodeService.deletePromotionalCode(
        id,
        new mongoose.Types.ObjectId(modifiedBy.toString())
      );

      if (!deletedCode) {
        return res.status(404).json(prepareResponse(404, 'Código promocional no encontrado'));
      }

      return res.json(prepareResponse(200, 'Código promocional eliminado exitosamente', deletedCode));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al eliminar código promocional: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Validar código promocional
  validatePromotionalCode = async (req: Request, res: Response) => {
    try {
      const { code, courseId, originalPrice, userId } = req.body;

      if (!code || !courseId || originalPrice === undefined) {
        return res.status(400).json(prepareResponse(400, 'Código, ID del curso y precio original son requeridos'));
      }

      // Usar userId del body si está presente, sino del usuario autenticado, sino usar un ID temporal
      let userIdToValidate = userId || req.user?._id;

      // Si no hay userId disponible, usar un ID temporal para validación básica
      if (!userIdToValidate) {
        userIdToValidate = `anonymous_${Date.now()}`;
      }

      const validation = await this.promotionalCodeService.validatePromotionalCode(
        code.trim().toUpperCase(),
        courseId,
        userIdToValidate.toString(),
        Number(originalPrice)
      );

      return res.json(prepareResponse(200, validation.message, validation));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al validar código promocional: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Obtener estadísticas
  getPromotionalCodeStats = async (req: Request, res: Response) => {
    try {
      const stats = await this.promotionalCodeService.getPromotionalCodeStats();

      return res.json(prepareResponse(200, 'Estadísticas obtenidas exitosamente', stats));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al obtener estadísticas: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };

  // Público: dado un conjunto de IDs de cursos, devolver cuáles tienen promociones activas
  getCoursesWithActivePromotions = async (req: Request, res: Response) => {
    try {
      const { courseIds } = req.body as { courseIds?: string[] };

      if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json(prepareResponse(400, 'Se requiere un arreglo de IDs de cursos'));
      }

      const result = await this.promotionalCodeService.getActivePromotionsForCourses(courseIds);

      return res.json(prepareResponse(200, 'Mapa de cursos con promociones activas', result));
    } catch (error) {
      const err = error as Error;
      logger.error(`Error al obtener cursos con promociones: ${err.message}`);
      return res.status(500).json(prepareResponse(500, 'Error interno del servidor', { error: err.message }));
    }
  };
}
