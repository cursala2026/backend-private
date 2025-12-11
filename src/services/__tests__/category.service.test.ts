/* eslint-env jest */
import CategoryService from '@/services/category.service';
import { ICategory } from '@/models';

const mockCategoryRepository: any = {
    findOneById: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findAll: jest.fn(),
    addCourse: jest.fn(),
    removeCourse: jest.fn(),
    changeStatus: jest.fn(),
    moveUpOrder: jest.fn(),
    moveDownOrder: jest.fn(),
    addCourseToCategory: jest.fn(),
    removeCourseFromCategory: jest.fn(),
    getCoursesByCategoryAggregate: jest.fn(),
    getCoursesNotInCategoryAggregate: jest.fn(),
};
let categoryService: CategoryService;
beforeEach(() => {
    jest.clearAllMocks();
    categoryService = new CategoryService(mockCategoryRepository);
});
describe('CategoryService - Basic CRUD', () => {
    test('findOneById calls repository method', async () => {
        const mockCategory: any = { _id: '123', name: 'Test Category' };
        mockCategoryRepository.findOneById.mockResolvedValue(mockCategory);
        const result = await categoryService.findOneById('123');
        expect(mockCategoryRepository.findOneById).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockCategory);
    });
    test('findById calls repository method', async () => {
        const mockCategory: any = { _id: '123', name: 'Test Category' };
        mockCategoryRepository.findById.mockResolvedValue(mockCategory);
        const result = await categoryService.findById('123');
        expect(mockCategoryRepository.findById).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockCategory);
    });
    test('create calls repository method', async () => {
        const categoryData: Partial<ICategory> = { name: 'New Category' };
        const createdCategory: any = { _id: '456', ...categoryData };
        mockCategoryRepository.create.mockResolvedValue(createdCategory);
        const result = await categoryService.create(categoryData);
        expect(mockCategoryRepository.create).toHaveBeenCalledWith(categoryData);
        expect(result).toEqual(createdCategory);
    });
    test('update calls repository method', async () => {
        const updateData: Partial<ICategory> = { name: 'Updated Category' };
        const updatedCategory: any = { _id: '123', ...updateData };
        mockCategoryRepository.update.mockResolvedValue(updatedCategory);
        const result = await categoryService.update('123', updateData);
        expect(mockCategoryRepository.update).toHaveBeenCalledWith('123', updateData);
        expect(result).toEqual(updatedCategory);
    });
    test('delete calls repository method', async () => {
        const deletedCategory: any = { _id: '123', name: 'Deleted' };
        mockCategoryRepository.delete.mockResolvedValue(deletedCategory);
        const result = await categoryService.delete('123');
        expect(mockCategoryRepository.delete).toHaveBeenCalledWith('123');
        expect(result).toEqual(deletedCategory);
    });
    test('findAll calls repository method', async () => {
        const mockCategories: any[] = [
            { _id: '1', name: 'Cat1' },
            { _id: '2', name: 'Cat2' },
        ];
        mockCategoryRepository.findAll.mockResolvedValue(mockCategories);
        const result = await categoryService.findAll();
        expect(mockCategoryRepository.findAll).toHaveBeenCalled();
        expect(result).toEqual(mockCategories);
    });
});
describe('CategoryService - Course Management', () => {
    test('addCourse calls repository method', async () => {
        const updatedCategory: any = { _id: '123', courses: ['course1'] };
        mockCategoryRepository.addCourse.mockResolvedValue(updatedCategory);
        const result = await categoryService.addCourse('123', 'course1');
        expect(mockCategoryRepository.addCourse).toHaveBeenCalledWith('123', 'course1');
        expect(result).toEqual(updatedCategory);
    });
    test('removeCourse calls repository method', async () => {
        const updatedCategory: any = { _id: '123', courses: [] };
        mockCategoryRepository.removeCourse.mockResolvedValue(updatedCategory);
        const result = await categoryService.removeCourse('123', 'course1');
        expect(mockCategoryRepository.removeCourse).toHaveBeenCalledWith('123', 'course1');
        expect(result).toEqual(updatedCategory);
    });
    test('addCourseToCategory calls repository method', async () => {
        const updatedCategory: any = { _id: '123', courses: ['course1'] };
        mockCategoryRepository.addCourseToCategory.mockResolvedValue(updatedCategory);
        const result = await categoryService.addCourseToCategory('course1', '123');
        expect(mockCategoryRepository.addCourseToCategory).toHaveBeenCalledWith('course1', '123');
        expect(result).toEqual(updatedCategory);
    });
    test('removeCourseFromCategory calls repository method', async () => {
        const updatedCategory: any = { _id: '123', courses: [] };
        mockCategoryRepository.removeCourseFromCategory.mockResolvedValue(updatedCategory);
        const result = await categoryService.removeCourseFromCategory('course1', '123');
        expect(mockCategoryRepository.removeCourseFromCategory).toHaveBeenCalledWith('course1', '123');
        expect(result).toEqual(updatedCategory);
    });
    test('getCoursesByCategoryAggregate calls repository method', async () => {
        const mockCourses = [{ name: 'Course1', courseId: 'c1' }];
        mockCategoryRepository.getCoursesByCategoryAggregate.mockResolvedValue(mockCourses);
        const result = await categoryService.getCoursesByCategoryAggregate('123');
        expect(mockCategoryRepository.getCoursesByCategoryAggregate).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockCourses);
    });
    test('getCoursesNotInCategoryAggregate calls repository method', async () => {
        const mockCourses = [{ name: 'Course2', courseId: 'c2' }];
        mockCategoryRepository.getCoursesNotInCategoryAggregate.mockResolvedValue(mockCourses);
        const result = await categoryService.getCoursesNotInCategoryAggregate('123');
        expect(mockCategoryRepository.getCoursesNotInCategoryAggregate).toHaveBeenCalledWith('123');
        expect(result).toEqual(mockCourses);
    });
});
describe('CategoryService - Status and Ordering', () => {
    test('changeStatus calls repository method', async () => {
        const updatedCategory: any = { _id: '123', status: 'ACTIVE' };
        mockCategoryRepository.changeStatus.mockResolvedValue(updatedCategory);
        const result = await categoryService.changeStatus('123', 'ACTIVE');
        expect(mockCategoryRepository.changeStatus).toHaveBeenCalledWith('123', 'ACTIVE');
        expect(result).toEqual(updatedCategory);
    });
    test('moveUpOrder calls repository method', async () => {
        const updatedCategory: any = { _id: '123', order: 1 };
        mockCategoryRepository.moveUpOrder.mockResolvedValue(updatedCategory);
        const result = await categoryService.moveUpOrder('123');
        expect(mockCategoryRepository.moveUpOrder).toHaveBeenCalledWith('123');
        expect(result).toEqual(updatedCategory);
    });
    test('moveDownOrder calls repository method', async () => {
        const updatedCategory: any = { _id: '123', order: 3 };
        mockCategoryRepository.moveDownOrder.mockResolvedValue(updatedCategory);
        const result = await categoryService.moveDownOrder('123');
        expect(mockCategoryRepository.moveDownOrder).toHaveBeenCalledWith('123');
        expect(result).toEqual(updatedCategory);
    });
});
