import { IFAQ } from '@/models';
import FAQRepository from '@/repositories/faq.repository';

class FAQService {
  constructor(private readonly faqRepository: FAQRepository) {}

  /**
   * Retrieves all FAQs
   * @param activeOnly Whether to retrieve only active FAQs
   * @returns Array of FAQs
   */
  async getAllFAQs(activeOnly: boolean = false): Promise<IFAQ[]> {
    try {
      return await this.faqRepository.getFAQs(activeOnly);
    } catch (error) {
      throw new Error(`Error retrieving FAQs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves FAQs by category
   * @param category FAQ category
   * @param activeOnly Whether to retrieve only active FAQs
   * @returns Array of FAQs in the specified category
   */
  async getFAQsByCategory(category: string, activeOnly: boolean = false): Promise<IFAQ[]> {
    try {
      if (!category || category.trim() === '') {
        throw new Error('Category is required.');
      }
      return await this.faqRepository.getFAQsByCategory(category.trim(), activeOnly);
    } catch (error) {
      throw new Error(`Error retrieving FAQs by category: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves a single FAQ by ID
   * @param id FAQ ID
   * @returns FAQ object
   */
  async getFAQById(id: string): Promise<IFAQ> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('FAQ ID is required.');
      }

      const faq = await this.faqRepository.getFAQById(id.trim());

      if (!faq) {
        throw new Error('FAQ not found.');
      }

      return faq;
    } catch (error) {
      throw new Error(`Error retrieving FAQ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a new FAQ
   * @param faqData FAQ data to create
   * @returns Created FAQ
   */
  async createFAQ(faqData: Omit<IFAQ, '_id'>): Promise<IFAQ> {
    try {
      // Validate required fields
      if (!faqData.question || faqData.question.trim() === '') {
        throw new Error('Question is required.');
      }

      if (!faqData.answer || faqData.answer.trim() === '') {
        throw new Error('Answer is required.');
      }

      // Validate field lengths
      if (faqData.question.length > 500) {
        throw new Error('Question cannot exceed 500 characters.');
      }

      if (faqData.answer.length > 2000) {
        throw new Error('Answer cannot exceed 2000 characters.');
      }

      if (faqData.category && faqData.category.length > 100) {
        throw new Error('Category cannot exceed 100 characters.');
      }

      // Clean and prepare data
      const cleanData: Omit<IFAQ, '_id'> = {
        question: faqData.question.trim(),
        answer: faqData.answer.trim(),
        category: faqData.category?.trim() || 'General',
        isActive: faqData.isActive !== undefined ? faqData.isActive : true,
        order: faqData.order || 0,
      };

      return await this.faqRepository.createFAQ(cleanData);
    } catch (error) {
      throw new Error(`Error creating FAQ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates an existing FAQ
   * @param id FAQ ID
   * @param updateData Partial FAQ data to update
   * @returns Updated FAQ
   */
  async updateFAQ(id: string, updateData: Partial<Omit<IFAQ, '_id'>>): Promise<IFAQ> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('FAQ ID is required.');
      }

      // Validate and prepare update data
      const cleanUpdateData: Partial<Omit<IFAQ, '_id'>> = {};

      if (updateData.question !== undefined) {
        if (!updateData.question || updateData.question.trim() === '') {
          throw new Error('Question cannot be empty.');
        }
        if (updateData.question.length > 500) {
          throw new Error('Question cannot exceed 500 characters.');
        }
        cleanUpdateData.question = updateData.question.trim();
      }

      if (updateData.answer !== undefined) {
        if (!updateData.answer || updateData.answer.trim() === '') {
          throw new Error('Answer cannot be empty.');
        }
        if (updateData.answer.length > 2000) {
          throw new Error('Answer cannot exceed 2000 characters.');
        }
        cleanUpdateData.answer = updateData.answer.trim();
      }

      if (updateData.category !== undefined) {
        if (updateData.category && updateData.category.length > 100) {
          throw new Error('Category cannot exceed 100 characters.');
        }
        cleanUpdateData.category = updateData.category?.trim() || 'General';
      }

      if (updateData.isActive !== undefined) {
        cleanUpdateData.isActive = updateData.isActive;
      }

      if (updateData.order !== undefined) {
        cleanUpdateData.order = updateData.order;
      }

      const updatedFAQ = await this.faqRepository.updateFAQ(id.trim(), cleanUpdateData);

      if (!updatedFAQ) {
        throw new Error('FAQ not found.');
      }

      return updatedFAQ;
    } catch (error) {
      throw new Error(`Error updating FAQ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes an FAQ by ID
   * @param id FAQ ID
   * @returns Deleted FAQ
   */
  async deleteFAQ(id: string): Promise<IFAQ> {
    try {
      if (!id || id.trim() === '') {
        throw new Error('FAQ ID is required.');
      }

      const deletedFAQ = await this.faqRepository.deleteFAQ(id.trim());

      if (!deletedFAQ) {
        throw new Error('FAQ not found.');
      }

      return deletedFAQ;
    } catch (error) {
      throw new Error(`Error deleting FAQ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all unique categories
   * @returns Array of unique category names
   */
  async getCategories(): Promise<string[]> {
    try {
      return await this.faqRepository.getCategories();
    } catch (error) {
      throw new Error(`Error retrieving categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates the order of multiple FAQs
   * @param orderUpdates Array of {id, order} objects
   * @returns Number of updated documents
   */
  async updateFAQOrder(orderUpdates: Array<{ id: string; order: number }>): Promise<{ updatedCount: number }> {
    try {
      if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
        throw new Error('Order updates array is required and cannot be empty.');
      }

      // Validate order updates
      const hasInvalidUpdate = orderUpdates.some(
        (update) => !update.id || update.id.trim() === '' || typeof update.order !== 'number' || update.order < 0
      );

      if (hasInvalidUpdate) {
        throw new Error('All update items must have a valid ID and non-negative order number.');
      }

      const updatedCount = await this.faqRepository.updateFAQOrder(orderUpdates);

      return { updatedCount };
    } catch (error) {
      throw new Error(`Error updating FAQ order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default FAQService;
