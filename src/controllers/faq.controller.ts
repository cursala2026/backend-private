import { NextFunction, Request, Response } from 'express';
import prepareResponse from '../utils/api-response';
import FAQService from '@/services/faq.service';
import { ensureString } from '../utils/type-guards'; // Importación crítica del control de tipos

export default class FAQController {
  constructor(private readonly faqService: FAQService) {}

  /**
   * Get all FAQs
   */
  getAllFAQs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.query.activeOnly también es string | string[] | ParsedQs...
      const activeOnly = req.query.activeOnly;
      const isActiveOnly = activeOnly === 'true';

      const faqs = await this.faqService.getAllFAQs(isActiveOnly);
      return res.json(prepareResponse(200, 'FAQs fetched successfully', faqs));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get FAQs by category
   */
  getFAQsByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // APLICACIÓN DE CONTROL: Línea 46 del log de error
      const category = ensureString(req.params.category);
      const isActiveOnly = req.query.activeOnly === 'true';

      const faqs = await this.faqService.getFAQsByCategory(category, isActiveOnly);
      return res.json(prepareResponse(200, 'FAQs fetched successfully', faqs));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get FAQ by ID
   */
  getFAQById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // APLICACIÓN DE CONTROL: Línea 32 del log de error
      const id = ensureString(req.params.id);

      const faq = await this.faqService.getFAQById(id);
      return res.json(prepareResponse(200, 'FAQ fetched successfully', faq));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Create new FAQ
   */
  createFAQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const faqData = req.body;
      const newFAQ = await this.faqService.createFAQ(faqData);
      return res.status(201).json(prepareResponse(201, 'FAQ created successfully', newFAQ));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Update FAQ
   */
  updateFAQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // APLICACIÓN DE CONTROL: Línea 75 del log de error
      const id = ensureString(req.params.id);
      const updateData = req.body;

      const updatedFAQ = await this.faqService.updateFAQ(id, updateData);
      return res.json(prepareResponse(200, 'FAQ updated successfully', updatedFAQ));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Delete FAQ
   */
  deleteFAQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // APLICACIÓN DE CONTROL: Línea 89 del log de error
      const id = ensureString(req.params.id);

      const deletedFAQ = await this.faqService.deleteFAQ(id);
      return res.json(prepareResponse(200, 'FAQ deleted successfully', deletedFAQ));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Get all categories
   */
  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.faqService.getCategories();
      return res.json(prepareResponse(200, 'Categories fetched successfully', categories));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Update FAQ order
   */
  updateFAQOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderUpdates } = req.body;
      const result = await this.faqService.updateFAQOrder(orderUpdates);
      return res.json(prepareResponse(200, 'FAQ order updated successfully', result));
    } catch (error) {
      return next(error);
    }
  };
}
