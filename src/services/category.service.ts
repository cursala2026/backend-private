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
}
