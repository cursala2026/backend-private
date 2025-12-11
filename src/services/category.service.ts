import fs from 'fs';
import path from 'path';
import { ICategory } from '@/models';
import CategoryRepository from '@/repositories/category.repository';

export default class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findOneById(id: string) {
    return this.categoryRepository.findOneById(id);
  }

  async findById(id: string): Promise<ICategory | null> {
    return this.categoryRepository.findById(id);
  }

  async update(id: string, updateData: Partial<ICategory>): Promise<ICategory> {
    return this.categoryRepository.update(id, updateData);
  }

  async create(categoryData: Partial<ICategory>): Promise<ICategory> {
    return this.categoryRepository.create(categoryData);
  }

  async delete(id: string): Promise<ICategory | null> {
    return this.categoryRepository.delete(id);
  }

  async findAll(): Promise<ICategory[]> {
    return this.categoryRepository.findAll();
  }

  async addCourse(categoryId: string, courseId: string): Promise<ICategory | null> {
    return this.categoryRepository.addCourse(categoryId, courseId);
  }

  async removeCourse(categoryId: string, courseId: string): Promise<ICategory | null> {
    return this.categoryRepository.removeCourse(categoryId, courseId);
  }

  async changeStatus(categoryId: string, status: string): Promise<ICategory | null> {
    return this.categoryRepository.changeStatus(categoryId, status);
  }

  async moveUpOrder(categoryId: string): Promise<ICategory | null> {
    return this.categoryRepository.moveUpOrder(categoryId);
  }

  async moveDownOrder(categoryId: string): Promise<ICategory | null> {
    return this.categoryRepository.moveDownOrder(categoryId);
  }

  async getCategoryImage(imageFileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(__dirname, '../static/images', imageFileName);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileBuffer = fs.readFileSync(filePath);
      return fileBuffer;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error while reading image file: ${error.message}`);
      } else {
        throw new Error('Unknown error while reading image file');
      }
    }
  }

  async addCourseToCategory(courseId: string, categoryId: string): Promise<ICategory | null> {
    return this.categoryRepository.addCourseToCategory(courseId, categoryId);
  }

  async removeCourseFromCategory(courseId: string, categoryId: string): Promise<ICategory | null> {
    return this.categoryRepository.removeCourseFromCategory(courseId, categoryId);
  }

  async getCoursesByCategoryAggregate(categoryId: string): Promise<{ name: string; courseId: string }[]> {
    return this.categoryRepository.getCoursesByCategoryAggregate(categoryId);
  }

  async getCoursesNotInCategoryAggregate(categoryId: string): Promise<{ name: string; courseId: string }[]> {
    return this.categoryRepository.getCoursesNotInCategoryAggregate(categoryId);
  }
}
