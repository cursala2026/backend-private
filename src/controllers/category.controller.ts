import { NextFunction, Response, Request } from 'express';
import prepareResponse from '../utils/api-response';
import CategoryService from '@/services/category.service';
import { ICategory } from '@/models';
import { uploadFiles, deleteOldFile } from '@/utils/fileUpload.util';

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
      uploadFiles.single('imageFile')(req, res, async (err: unknown) => {
        if (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return res.status(400).json({ message: errorMessage });
        }

        try {
          const { name, description } = req.body;
          const imageUrl = req.file ? req.file.filename : undefined;

          const categoryData = {
            name,
            description,
            imageUrl,
          };

          let category;
          try {
            category = await this.categoryService.create(categoryData);
          } catch (serviceError) {
            const error = serviceError as Error;
            // Check if it's a validation error (should be 400)
            if (
              error.message.includes('validation failed') ||
              error.message.includes('duplicate key') ||
              error.message.includes('E11000')
            ) {
              return res.status(400).json({ message: 'Error de validación', error: error.message });
            }
            // Otherwise it's a server error (500)
            return res.status(500).json({ message: 'Error al crear la categoría', error: error.message });
          }

          return res.json(prepareResponse(201, 'Categoría creada exitosamente', category));
        } catch (error) {
          return res.status(500).json({ message: 'Error inesperado', error: (error as Error).message });
        }
      });
    } catch (error) {
      return next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      uploadFiles.single('imageFile')(req, res, async (err: unknown) => {
        if (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return res.status(400).json({ message: errorMessage });
        }

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

          // Si se envía un nuevo archivo, eliminar el anterior y asignar el nuevo filename
          if (req.file) {
            if (existingCategory.imageUrl) {
              // Usar la función centralizada para eliminar archivos
              deleteOldFile(existingCategory.imageUrl, 'images');
            }
            updateData.imageUrl = req.file.filename;
          }

          // Actualizar la categoría en la base de datos
          const updatedCategory = await this.categoryService.update(id, updateData);
          return res.json(prepareResponse(200, 'Categoría actualizada correctamente', updatedCategory));
        } catch (error) {
          const localErr = error as Error;
          // Check if it's a validation error (should be 400)
          if (
            localErr.message.includes('validation failed') ||
            localErr.message.includes('duplicate key') ||
            localErr.message.includes('E11000') ||
            localErr.message.includes('not found')
          ) {
            return res.status(400).json({ message: 'Error de validación', error: localErr.message });
          }
          return res.status(500).json({ message: 'Error inesperado', error: localErr.message });
        }
      });
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

  addCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, courseId } = req.params;
      const category = await this.categoryService.addCourse(categoryId, courseId);
      return res.json(prepareResponse(200, 'Curso añadido a la categoría correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  removeCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, courseId } = req.params;
      const category = await this.categoryService.removeCourse(categoryId, courseId);
      return res.json(prepareResponse(200, 'Curso removido de la categoría correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const { status } = req.body;
      const category = await this.categoryService.changeStatus(categoryId, status);
      return res.json(prepareResponse(200, 'Estado de la categoría cambiado correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  moveUpOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const category = await this.categoryService.moveUpOrder(categoryId);
      return res.json(prepareResponse(200, 'Orden de la categoría subido correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  moveDownOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const category = await this.categoryService.moveDownOrder(categoryId);
      return res.json(prepareResponse(200, 'Orden de la categoría bajado correctamente', category));
    } catch (error) {
      return next(error);
    }
  };

  getCategoryImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageFileName } = req.params;
      const fileBuffer = await this.categoryService.getCategoryImage(imageFileName);

      if (!fileBuffer) {
        return res.status(404).json({ message: 'Image not found' });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Agrega un curso a una categoría.
   * @param req - Request object.
   * @param res - Response object.
   * @param next - Next function.
   */
  addCourseToCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, courseId } = req.params;

      const updatedCategory = await this.categoryService.addCourseToCategory(courseId, categoryId);

      if (!updatedCategory) {
        return res.status(404).json(prepareResponse(404, 'Categoría o curso no encontrado'));
      }

      return res.json(prepareResponse(200, 'Curso agregado a la categoría exitosamente', updatedCategory));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Quita un curso de una categoría.
   * @param req - Request object.
   * @param res - Response object.
   * @param next - Next function.
   */
  removeCourseFromCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, courseId } = req.params;

      const updatedCategory = await this.categoryService.removeCourseFromCategory(courseId, categoryId);

      if (!updatedCategory) {
        return res.status(404).json(prepareResponse(404, 'Categoría o curso no encontrado'));
      }

      return res.json(prepareResponse(200, 'Curso eliminado de la categoría exitosamente', updatedCategory));
    } catch (error) {
      return next(error);
    }
  };

  getCoursesByCategoryAggregate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const courses = await this.categoryService.getCoursesByCategoryAggregate(categoryId);
      return res.json(prepareResponse(200, 'Cursos obtenidos correctamente', courses));
    } catch (error) {
      return next(error);
    }
  };

  getCoursesNotInCategoryAggregate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId } = req.params;
      const courses = await this.categoryService.getCoursesNotInCategoryAggregate(categoryId);
      return res.json(prepareResponse(200, 'Cursos no obtenidos correctamente', courses));
    } catch (error) {
      return next(error);
    }
  };
}
