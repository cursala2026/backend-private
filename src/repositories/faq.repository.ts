import { FAQSchema, IFAQ, FAQModel, Connection, Model, Types } from '@/models';

class FAQRepository {
  private readonly model: Model<FAQModel>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<FAQModel>('FAQ', FAQSchema, 'faqs');
  }

  /**
   * Retrieves all FAQs from the database, sorted by category and order
   * @param activeOnly Whether to retrieve only active FAQs
   * @returns Array of FAQs
   */
  async getFAQs(activeOnly: boolean = false): Promise<IFAQ[]> {
    const filter = activeOnly ? { isActive: true } : {};
    const res = await this.model.find(filter).sort({ category: 1, order: 1 }).exec();
    return res as unknown as IFAQ[];
  }

  /**
   * Retrieves FAQs by category
   * @param category FAQ category
   * @param activeOnly Whether to retrieve only active FAQs
   * @returns Array of FAQs in the specified category
   */
  async getFAQsByCategory(category: string, activeOnly: boolean = false): Promise<IFAQ[]> {
    const filter: Record<string, unknown> = { category };
    if (activeOnly) {
      filter.isActive = true;
    }
    const res = await this.model.find(filter).sort({ order: 1 }).exec();
    return res as unknown as IFAQ[];
  }

  /**
   * Retrieves a single FAQ by ID
   * @param id FAQ ID
   * @returns FAQ object or null if not found
   */
  async getFAQById(id: string): Promise<IFAQ | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('The provided FAQ ID is not valid.');
    }
    const res = await this.model.findById(id).exec();
    return res as unknown as IFAQ | null;
  }

  /**
   * Creates a new FAQ
   * @param faqData FAQ data to create
   * @returns Created FAQ
   */
  async createFAQ(faqData: Omit<IFAQ, '_id'>): Promise<IFAQ> {
    const created = await this.model.create(faqData as Partial<IFAQ>);
    return created as unknown as IFAQ;
  }

  /**
   * Updates an existing FAQ
   * @param id FAQ ID
   * @param updateData Partial FAQ data to update
   * @returns Updated FAQ or null if not found
   */
  async updateFAQ(id: string, updateData: Partial<Omit<IFAQ, '_id'>>): Promise<IFAQ | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('The provided FAQ ID is not valid.');
    }
    const updateQ = updateData as unknown as import('mongoose').UpdateQuery<IFAQ>;
    const res = await this.model.findByIdAndUpdate(id, updateQ, { new: true }).exec();
    return res as unknown as IFAQ | null;
  }

  /**
   * Deletes an FAQ by ID
   * @param id FAQ ID
   * @returns Deleted FAQ or null if not found
   */
  async deleteFAQ(id: string): Promise<IFAQ | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('The provided FAQ ID is not valid.');
    }
    const res = await this.model.findByIdAndDelete(id).exec();
    return res as unknown as IFAQ | null;
  }

  /**
   * Gets all unique categories
   * @returns Array of unique category names
   */
  async getCategories(): Promise<string[]> {
    const categories = await this.model.distinct('category');
    return categories.filter(Boolean); // Remove null/undefined values
  }

  /**
   * Updates the order of multiple FAQs
   * @param orderUpdates Array of {id, order} objects
   * @returns Number of updated documents
   */
  async updateFAQOrder(orderUpdates: Array<{ id: string; order: number }>): Promise<number> {
    let updatedCount = 0;

    const bulkOps = orderUpdates
      .filter((update) => Types.ObjectId.isValid(update.id))
      .map((update) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(update.id) },
          update: { order: update.order },
        },
      }));

    if (bulkOps.length > 0) {
      const result = await this.model.bulkWrite(bulkOps as unknown as Parameters<typeof this.model.bulkWrite>[0]);
      updatedCount = result.modifiedCount;
    }

    return updatedCount;
  }
}

export default FAQRepository;
