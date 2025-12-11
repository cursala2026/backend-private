
/* eslint-env jest */
import mongoose from 'mongoose';
import FAQService from '@/services/faq.service';
import FAQRepository from '@/repositories/faq.repository';
import { IFAQ } from '@/models';
jest.mock('@/repositories/faq.repository');
const mockFAQRepository = FAQRepository as jest.Mocked<typeof FAQRepository>;
describe('FAQService', () => {
  let faqService: FAQService;
  beforeEach(() => {
    jest.clearAllMocks();
    faqService = new FAQService(mockFAQRepository.prototype);
  });
  describe('getAllFAQs', () => {
    test('retrieves all FAQs successfully', async () => {
      const mockFAQs = [
        { _id: new mongoose.Types.ObjectId(), question: 'Q1', answer: 'A1', category: 'General', isActive: true, order: 1 },
      ] as unknown as IFAQ[];
      mockFAQRepository.prototype.getFAQs = jest.fn().mockResolvedValue(mockFAQs);
      const result = await faqService.getAllFAQs();
      expect(result).toEqual(mockFAQs);
      expect(mockFAQRepository.prototype.getFAQs).toHaveBeenCalledWith(false);
    });
    test('retrieves only active FAQs', async () => {
      const result = await faqService.getAllFAQs(true);
      expect(mockFAQRepository.prototype.getFAQs).toHaveBeenCalledWith(true);
    });
    test('handles error during retrieval', async () => {
      mockFAQRepository.prototype.getFAQs = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.getAllFAQs()).rejects.toThrow('Error retrieving FAQs: DB error');
    });
  });
  describe('getFAQsByCategory', () => {
    test('retrieves FAQs by category successfully', async () => {
      const mockFAQs = [
        { _id: new mongoose.Types.ObjectId(), question: 'Q1', answer: 'A1', category: 'Tech', isActive: true, order: 1 },
      ] as unknown as IFAQ[];
      mockFAQRepository.prototype.getFAQsByCategory = jest.fn().mockResolvedValue(mockFAQs);
      const result = await faqService.getFAQsByCategory('Tech');
      expect(result).toEqual(mockFAQs);
      expect(mockFAQRepository.prototype.getFAQsByCategory).toHaveBeenCalledWith('Tech', false);
    });
    test('throws error for empty category', async () => {
      await expect(faqService.getFAQsByCategory('')).rejects.toThrow('Category is required.');
    });
    test('handles error during retrieval', async () => {
      mockFAQRepository.prototype.getFAQsByCategory = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.getFAQsByCategory('Tech')).rejects.toThrow('Error retrieving FAQs by category: DB error');
    });
  });
  describe('getFAQById', () => {
    test('retrieves FAQ by ID successfully', async () => {
      const mockFAQ = { _id: new mongoose.Types.ObjectId(), question: 'Q1', answer: 'A1', category: 'General', isActive: true, order: 1 } as unknown as IFAQ;
      mockFAQRepository.prototype.getFAQById = jest.fn().mockResolvedValue(mockFAQ);
      const result = await faqService.getFAQById('1');
      expect(result).toEqual(mockFAQ);
    });
    test('throws error for empty ID', async () => {
      await expect(faqService.getFAQById('')).rejects.toThrow('FAQ ID is required.');
    });
    test('throws error when FAQ not found', async () => {
      mockFAQRepository.prototype.getFAQById = jest.fn().mockResolvedValue(null);
      await expect(faqService.getFAQById('1')).rejects.toThrow('FAQ not found.');
    });
    test('handles error during retrieval', async () => {
      mockFAQRepository.prototype.getFAQById = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.getFAQById('1')).rejects.toThrow('Error retrieving FAQ: DB error');
    });
  });
  describe('createFAQ', () => {
    test('creates FAQ successfully', async () => {
      const faqData: Omit<IFAQ, '_id'> = { question: 'Q1', answer: 'A1', category: 'General', isActive: true, order: 1 };
      const createdFAQ = { _id: new mongoose.Types.ObjectId(), ...faqData } as unknown as IFAQ;
      mockFAQRepository.prototype.createFAQ = jest.fn().mockResolvedValue(createdFAQ);
      const result = await faqService.createFAQ(faqData);
      expect(result).toEqual(createdFAQ);
      expect(mockFAQRepository.prototype.createFAQ).toHaveBeenCalledWith({
        question: 'Q1',
        answer: 'A1',
        category: 'General',
        isActive: true,
        order: 1,
      });
    });
    test('throws error for empty question', async () => {
      const faqData: Omit<IFAQ, '_id'> = { question: '', answer: 'A1', isActive: true, order: 1 };
      await expect(faqService.createFAQ(faqData)).rejects.toThrow('Question is required.');
    });
    test('throws error for empty answer', async () => {
      const faqData: Omit<IFAQ, '_id'> = { question: 'Q1', answer: '', isActive: true, order: 1 };
      await expect(faqService.createFAQ(faqData)).rejects.toThrow('Answer is required.');
    });
    test('throws error for question too long', async () => {
      const faqData: Omit<IFAQ, '_id'> = { question: 'a'.repeat(501), answer: 'A1', isActive: true, order: 1 };
      await expect(faqService.createFAQ(faqData)).rejects.toThrow('Question cannot exceed 500 characters.');
    });
    test('handles error during creation', async () => {
      const faqData: Omit<IFAQ, '_id'> = { question: 'Q1', answer: 'A1', isActive: true, order: 1 };
      mockFAQRepository.prototype.createFAQ = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.createFAQ(faqData)).rejects.toThrow('Error creating FAQ: DB error');
    });
  });
  describe('updateFAQ', () => {
    test('updates FAQ successfully', async () => {
      const updateData: Partial<Omit<IFAQ, '_id'>> = { question: 'Updated Q1' };
      const updatedFAQ = { _id: new mongoose.Types.ObjectId(), question: 'Updated Q1', answer: 'A1', category: 'General', isActive: true, order: 1 } as unknown as IFAQ;
      mockFAQRepository.prototype.updateFAQ = jest.fn().mockResolvedValue(updatedFAQ);
      const result = await faqService.updateFAQ('1', updateData);
      expect(result).toEqual(updatedFAQ);
    });
    test('throws error for empty ID', async () => {
      await expect(faqService.updateFAQ('', { question: 'Q1' })).rejects.toThrow('FAQ ID is required.');
    });
    test('throws error for empty question update', async () => {
      await expect(faqService.updateFAQ('1', { question: '' })).rejects.toThrow('Question cannot be empty.');
    });
    test('throws error when FAQ not found', async () => {
      mockFAQRepository.prototype.updateFAQ = jest.fn().mockResolvedValue(null);
      await expect(faqService.updateFAQ('1', { question: 'Q1' })).rejects.toThrow('FAQ not found.');
    });
    test('handles error during update', async () => {
      mockFAQRepository.prototype.updateFAQ = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.updateFAQ('1', { question: 'Q1' })).rejects.toThrow('Error updating FAQ: DB error');
    });
  });
  describe('deleteFAQ', () => {
    test('deletes FAQ successfully', async () => {
      const deletedFAQ = { _id: new mongoose.Types.ObjectId(), question: 'Q1', answer: 'A1', category: 'General', isActive: true, order: 1 } as unknown as IFAQ;
      mockFAQRepository.prototype.deleteFAQ = jest.fn().mockResolvedValue(deletedFAQ);
      const result = await faqService.deleteFAQ('1');
      expect(result).toEqual(deletedFAQ);
    });
    test('throws error for empty ID', async () => {
      await expect(faqService.deleteFAQ('')).rejects.toThrow('FAQ ID is required.');
    });
    test('throws error when FAQ not found', async () => {
      mockFAQRepository.prototype.deleteFAQ = jest.fn().mockResolvedValue(null);
      await expect(faqService.deleteFAQ('1')).rejects.toThrow('FAQ not found.');
    });
    test('handles error during deletion', async () => {
      mockFAQRepository.prototype.deleteFAQ = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.deleteFAQ('1')).rejects.toThrow('Error deleting FAQ: DB error');
    });
  });
  describe('getCategories', () => {
    test('retrieves categories successfully', async () => {
      const mockCategories = ['General', 'Tech'];
      mockFAQRepository.prototype.getCategories = jest.fn().mockResolvedValue(mockCategories);
      const result = await faqService.getCategories();
      expect(result).toEqual(mockCategories);
    });
    test('handles error during retrieval', async () => {
      mockFAQRepository.prototype.getCategories = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.getCategories()).rejects.toThrow('Error retrieving categories: DB error');
    });
  });
  describe('updateFAQOrder', () => {
    test('updates FAQ order successfully', async () => {
      const orderUpdates = [{ id: '1', order: 2 }];
      mockFAQRepository.prototype.updateFAQOrder = jest.fn().mockResolvedValue(1);
      const result = await faqService.updateFAQOrder(orderUpdates);
      expect(result).toEqual({ updatedCount: 1 });
    });
    test('throws error for empty order updates', async () => {
      await expect(faqService.updateFAQOrder([])).rejects.toThrow('Order updates array is required and cannot be empty.');
    });
    test('throws error for invalid order update', async () => {
      const orderUpdates = [{ id: '', order: -1 }];
      await expect(faqService.updateFAQOrder(orderUpdates)).rejects.toThrow('All update items must have a valid ID and non-negative order number.');
    });
    test('handles error during update', async () => {
      const orderUpdates = [{ id: '1', order: 2 }];
      mockFAQRepository.prototype.updateFAQOrder = jest.fn().mockRejectedValue(new Error('DB error'));
      await expect(faqService.updateFAQOrder(orderUpdates)).rejects.toThrow('Error updating FAQ order: DB error');
    });
  });
});
