import { NextFunction, Response, Request } from 'express';
import prepareResponse from '../utils/api-response';
import CategoryService from '@/services/category.service';
import { ICategory } from '@/models';

export default class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  findOneById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const category = await this.categoryService.findOneById(categoryId);
      return res.json(prepareResponse(200, 'Category fetched successfully', category));
    } catch (error) {
      return next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;
      const categoryData = { name, description };
      try {
        const category = await this.categoryService.create(categoryData);
        return res.status(201).json(prepareResponse(201, 'Categoría creada exitosamente', category));
      } catch (serviceError) {
        const error = serviceError as Error;
        if (error.message.includes('validation failed') || error.message.includes('duplicate key') || error.message.includes('E11000')) {
          return res.status(400).json({ message: 'Error de validación', error: error.message });
        }
        return res.status(500).json({ message: 'Error al crear la categoría', error: error.message });
      }
    } catch (error) {
      return next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Buscar la categoría existente
      const existingCategory = await this.categoryService.findById(id);
      if (!existingCategory) {
        return res.status(404).json({ message: 'Categoría no encontrada' });
      }

      // Preparar objeto con los campos a actualizar de forma parcial
      const updateData: Partial<ICategory> = {};
      const { name, description } = req.body;
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      // Actualizar la categoría en la base de datos
      try {
        const updatedCategory = await this.categoryService.update(id, updateData);
        return res.json(prepareResponse(200, 'Categoría actualizada correctamente', updatedCategory));
      } catch (error) {
        const localErr = error as Error;
        if (localErr.message.includes('validation failed') || localErr.message.includes('duplicate key') || localErr.message.includes('E11000') || localErr.message.includes('not found')) {
          return res.status(400).json({ message: 'Error de validación', error: localErr.message });
        }
        return res.status(500).json({ message: 'Error inesperado', error: localErr.message });
      }
    } catch (error) {
      return next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const category = await this.categoryService.delete(categoryId);
      return res.json(prepareResponse(200, 'Categoría eliminada correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.categoryService.findAll();
      return res.json(prepareResponse(200, 'Categorías obtenidas correctamente', categories));
    } catch (error) {
      return next(error);
    }
  };
  // Only CRUD methods remain (id, name, description)
}
