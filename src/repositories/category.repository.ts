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
}

export default CategoryRepository;
