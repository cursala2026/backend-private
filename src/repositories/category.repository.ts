import { CategorySchema, Connection, ICategory, Model, Types } from '@/models';

class CategoryRepository {
  private readonly model: Model<ICategory>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<ICategory>('Category', CategorySchema, 'categories');
  }

  /**
   * Finds a single category by ID.
   * @param id - The category's unique identifier.
   * @returns A promise that resolves to the category object if found, or null.
   */
  async findOneById(id: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de categoría proporcionado no es válido.');
    }
    const res = await this.model.findById(id).exec();
    return res as unknown as ICategory | null;
  }

  async findById(id: string): Promise<ICategory | null> {
    const res = await this.model.findById(id).exec();
    return res as unknown as ICategory | null;
  }

  // Actualiza la categoría y devuelve el registro actualizado
  async update(id: string, updateData: Partial<ICategory>): Promise<ICategory> {
    const updateQ = updateData as unknown as import('mongoose').UpdateQuery<ICategory>;
    const updatedCategory = await this.model.findByIdAndUpdate(id, updateQ, { new: true }).exec();
    if (!updatedCategory) {
      throw new Error('Category not found.');
    }
    return updatedCategory as unknown as ICategory;
  }

  /**
   * Creates a new category.
   * @param categoryData - The category data to create.
   * @returns A promise that resolves to the created category.
   */
  async create(categoryData: Partial<ICategory>): Promise<ICategory> {
    const lastCategory = await this.model.findOne().sort({ order: -1 }).exec();
    const nextOrder = lastCategory ? (lastCategory as unknown as ICategory).order + 1 : 1;

    const payload = { ...(categoryData as Partial<ICategory>), status: 'ACTIVE', order: nextOrder } as Partial<ICategory>;
    const created = await this.model.create(payload);
    return created as unknown as ICategory;
  }

  /**
   * Deletes a category.
   * @param id - The category's unique identifier.
   * @returns A promise that resolves to the deleted category.
   */
  async delete(id: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de categoría proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndDelete(id).exec();
    return res as unknown as ICategory | null;
  }

  /**
   * Lists all categories.
   * @returns A promise that resolves to an array of categories.
   */
  async findAll(): Promise<ICategory[]> {
    const res = await this.model.find().sort({ order: 1 }).exec();
    return res as unknown as ICategory[];
  }

  /**
   * Adds a course to a category.
   * @param categoryId - The category's unique identifier.
   * @param courseId - The course's unique identifier to add.
   * @returns A promise that resolves to the updated category.
   */
  async addCourse(categoryId: string, courseId: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(courseId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const res = await this.model.findByIdAndUpdate(
      categoryId,
      {
        $addToSet: { courses: courseId },
        $inc: { 'meta.totalCourses': 1 },
      },
      { new: true }
    ).exec();

    return res as unknown as ICategory | null;
  }

  /**
   * Removes a course from a category.
   * @param categoryId - The category's unique identifier.
   * @param courseId - The course's unique identifier to remove.
   * @returns A promise that resolves to the updated category.
   */
  async removeCourse(categoryId: string, courseId: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(courseId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const res = await this.model.findByIdAndUpdate(
      categoryId,
      {
        $pull: { courses: courseId },
        $inc: { 'meta.totalCourses': -1 },
      },
      { new: true }
    ).exec();

    return res as unknown as ICategory | null;
  }

  /**
   * Changes the status of a category.
   * @param categoryId - The category's unique identifier.
   * @param status - The new status.
   * @returns A promise that resolves to the updated category.
   */
  async changeStatus(categoryId: string, status: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new Error('El ID de categoría proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndUpdate(categoryId, { $set: { status } }, { new: true }).exec();
    return res as unknown as ICategory | null;
  }

  async moveUpOrder(categoryId: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new Error('The provided category ID is not valid.');
    }

    const currentCategory = await this.model.findById(categoryId).exec() as unknown as ICategory | null;
    if (!currentCategory) {
      throw new Error('Category not found.');
    }

    // Find the category that is immediately above
    const upperCategory = await this.model.findOne({ order: { $lt: currentCategory.order } }).sort({ order: -1 }).exec() as unknown as ICategory | null;

    if (!upperCategory) {
      // The category is already in the highest position.
      return currentCategory;
    }

    // Swap the 'order' values
    const tempOrder = (currentCategory as ICategory).order;
    (currentCategory as ICategory).order = (upperCategory as ICategory).order;
    (upperCategory as ICategory).order = tempOrder;

    // Save both categories simultaneously.
    await Promise.all([((currentCategory as unknown) as ICategory & { save: () => Promise<ICategory> }).save(), ((upperCategory as unknown) as ICategory & { save: () => Promise<ICategory> }).save()]);

    return currentCategory;
  }

  /**
   * Baja el orden de una categoría (la mueve hacia abajo).
   * Busca la categoría que se encuentra inmediatamente por debajo (con un `order` mayor)
   * y, si la encuentra, intercambia los valores de `order`.
   *
   * @param categoryId - El ID de la categoría a mover.
   * @returns Una promesa que resuelve con la categoría actualizada.
   */
  async moveDownOrder(categoryId: string): Promise<ICategory | null> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new Error('The provided category ID is not valid.');
    }

    const currentCategory = await this.model.findById(categoryId).exec() as unknown as ICategory | null;
    if (!currentCategory) {
      throw new Error('Category not found.');
    }

    // Find the category that is immediately below
    const lowerCategory = await this.model.findOne({ order: { $gt: currentCategory.order } }).sort({ order: 1 }).exec() as unknown as ICategory | null;

    if (!lowerCategory) {
      // The category is already in the lowest position.
      return currentCategory as unknown as ICategory | null;
    }

    // Swap the 'order' values
    const tempOrder = (currentCategory as ICategory).order;
    (currentCategory as ICategory).order = (lowerCategory as ICategory).order;
    (lowerCategory as ICategory).order = tempOrder;

    // Save both categories simultaneously.
    await Promise.all([((currentCategory as unknown) as ICategory & { save: () => Promise<ICategory> }).save(), ((lowerCategory as unknown) as ICategory & { save: () => Promise<ICategory> }).save()]);

    return currentCategory as unknown as ICategory | null;
  }

  /**
   * Agrega un courseId a la categoría.
   * @param categoryId - ID de la categoría.
   * @param courseId - ID del curso a agregar.
   * @returns La categoría actualizada.
   */
  async addCourseToCategory(courseId: string, categoryId: string): Promise<ICategory> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new Error('El ID de la categoría proporcionado no es válido.');
    }
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    const updatedCategory = await this.model.findByIdAndUpdate(
      categoryId,
      { $addToSet: { courses: courseId } }, // Agrega el courseId al array "courses"
      { new: true }
    ).exec() as unknown as ICategory | null;

    if (!updatedCategory) {
      throw new Error('Categoría no encontrada.');
    }

    return updatedCategory;
  }

  /**
   * Quita un courseId de la categoría.
   * @param categoryId - ID de la categoría.
   * @param courseId - ID del curso a quitar.
   * @returns La categoría actualizada.
   */
  async removeCourseFromCategory(courseId: string, categoryId: string): Promise<ICategory> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new Error('El ID de la categoría proporcionado no es válido.');
    }
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    const updatedCategory = await this.model.findByIdAndUpdate(
      categoryId,
      { $pull: { courses: courseId } }, // Elimina el courseId del array "courses"
      { new: true }
    ).exec();

    if (!updatedCategory) {
      throw new Error('Categoría no encontrada.');
    }

    return updatedCategory as unknown as ICategory;
  }

  async getCoursesByCategoryAggregate(categoryId: string): Promise<{ name: string; courseId: string }[]> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error('El ID de categoría proporcionado no es válido.');
      }

      const result = await this.model.aggregate([
        { $match: { _id: new Types.ObjectId(categoryId) } },
        {
          $lookup: {
            from: 'courses',
            localField: 'courses',
            foreignField: '_id',
            as: 'courseDetails',
          },
        },
        {
          $project: {
            _id: 0,
            courses: {
              $map: {
                input: '$courseDetails',
                as: 'course',
                in: {
                  name: '$$course.name',
                  courseId: { $toString: '$$course._id' },
                },
              },
            },
          },
        },
        { $unwind: '$courses' },
        { $replaceRoot: { newRoot: '$courses' } },
      ]);

      return result as unknown as { name: string; courseId: string }[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error al obtener los cursos de la categoría: ${error.message}`);
      } else {
        throw new Error('Error desconocido al obtener los cursos de la categoría');
      }
    }
  }

  async getCoursesNotInCategoryAggregate(categoryId: string): Promise<{ name: string; courseId: string }[]> {
    try {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error('El ID de categoría proporcionado no es válido.');
      }

      // Obtén la categoría y sus cursos asignados
      const category = await this.model.findById(categoryId, { courses: 1 }).exec() as unknown as { courses?: unknown[] } | null;
      if (!category) {
        throw new Error('Categoría no encontrada.');
      }

      // Lista de IDs de cursos ya asignados a la categoría
      const assignedCourseIds = ((category?.courses as unknown[]) || []).map((id) => String(id));

      // Busca directamente los cursos que NO están asignados a la categoría
      const CourseModel = this.connection.model<{ _id: Types.ObjectId; name: string }>('Course');

      const result = await CourseModel.find({ _id: { $nin: assignedCourseIds } }, { name: 1 }).lean().exec();

      // Mapea el resultado al formato deseado (tipado local)
      return (result as unknown[]).map((course: unknown) => {
        const c = course as unknown as { _id: Types.ObjectId; name: string };
        return {
          name: c.name,
          courseId: String(c._id),
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error al obtener los cursos no asociados: ${error.message}`);
      } else {
        throw new Error('Error desconocido al obtener los cursos no asociados');
      }
    }
  }

  /**
   * Cuenta el total de categorías
   * @returns El número total de categorías
   */
  async countCategories(): Promise<number> {
    return this.model.countDocuments();
  }
}

export default CategoryRepository;
