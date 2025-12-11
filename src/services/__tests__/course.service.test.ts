
/* eslint-env jest */
import fs from 'fs';
import path from 'path';
import CourseService from '@/services/course.service';
import CourseRepository from '@/repositories/course.repository';
import UserRepository from '@/repositories/user.repository';
jest.mock('fs');
jest.mock('path');
jest.mock('@/repositories/course.repository');
jest.mock('@/repositories/user.repository');
const mockCourseRepository: any = {
  findOneById: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  findPublishedCourses: jest.fn(),
  changeStatus: jest.fn(),
  moveUpOrder: jest.fn(),
  moveDownOrder: jest.fn(),
  findForHome: jest.fn(),
  changeShowOnHome: jest.fn(),
  assignMainTeacher: jest.fn(),
};
const mockUserRepository: any = {
  getUserById: jest.fn(),
};

let courseService: CourseService;

beforeEach(() => {
  jest.clearAllMocks();
  courseService = new CourseService(mockCourseRepository, mockUserRepository);
});
describe('CourseService', () => {
  describe('findOneById', () => {
    test('finds course by id', async () => {
      const course = { id: '1', name: 'Course 1' };
      mockCourseRepository.findOneById.mockResolvedValue(course);
      const result = await courseService.findOneById('1');
      expect(result).toEqual(course);
      expect(mockCourseRepository.findOneById).toHaveBeenCalledWith('1');
    });
  });
  describe('create', () => {
    test('creates course', async () => {
      const courseData = { name: 'New Course' };
      const created = { id: '1', ...courseData };
      mockCourseRepository.create.mockResolvedValue(created);
      const result = await courseService.create(courseData);
      expect(result).toEqual(created);
      expect(mockCourseRepository.create).toHaveBeenCalledWith(courseData);
    });
  });
  describe('update', () => {
    test('updates course', async () => {
      const updateData = { name: 'Updated' };
      const updated = { id: '1', name: 'Updated' };
      mockCourseRepository.update.mockResolvedValue(updated);
      const result = await courseService.update('1', updateData);
      expect(result).toEqual(updated);
      expect(mockCourseRepository.update).toHaveBeenCalledWith('1', updateData, undefined);
    });
  });
  describe('delete', () => {
    test('deletes course', async () => {
      const deleted = { id: '1' };
      mockCourseRepository.delete.mockResolvedValue(deleted);
      const result = await courseService.delete('1');
      expect(result).toEqual(deleted);
      expect(mockCourseRepository.delete).toHaveBeenCalledWith('1');
    });
  });
  describe('findAll', () => {
    test('finds all courses', async () => {
      const courses = [{ id: '1' }];
      mockCourseRepository.findAll.mockResolvedValue(courses);
      const result = await courseService.findAll();
      expect(result).toEqual(courses);
      expect(mockCourseRepository.findAll).toHaveBeenCalled();
    });
  });
  describe('findPublishedCourses', () => {
    test('finds published courses', async () => {
      const courses = [{ id: '1', status: 'PUBLISHED' }];
      mockCourseRepository.findPublishedCourses.mockResolvedValue(courses);
      const result = await courseService.findPublishedCourses();
      expect(result).toEqual(courses);
      expect(mockCourseRepository.findPublishedCourses).toHaveBeenCalled();
    });
  });
  describe('changeStatus', () => {
    test('changes course status', async () => {
      const updated = { id: '1', status: 'ACTIVE' };
      mockCourseRepository.changeStatus.mockResolvedValue(updated);
      const result = await courseService.changeStatus('1', 'ACTIVE');
      expect(result).toEqual(updated);
      expect(mockCourseRepository.changeStatus).toHaveBeenCalledWith('1', 'ACTIVE');
    });
  });
  describe('getCourseImage', () => {
    test('returns image buffer', async () => {
      const buffer = Buffer.from('image');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(buffer);
      const result = await courseService.getCourseImage('img.jpg');
      expect(result).toEqual(buffer);
    });
    test('returns null if file not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await courseService.getCourseImage('nonexistent.jpg');
      expect(result).toBeNull();
    });
  });
  describe('assignMainTeacher', () => {
    test('assigns main teacher successfully', async () => {
      const teacher = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011' };
      const updated = { id: '1', mainTeacherId: '507f1f77bcf86cd799439011' };
      mockUserRepository.getUserById.mockResolvedValue(teacher);
      mockCourseRepository.assignMainTeacher.mockResolvedValue(updated);
      const result = await courseService.assignMainTeacher('1', '507f1f77bcf86cd799439011');
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockCourseRepository.assignMainTeacher).toHaveBeenCalled();
    });
    test('removes main teacher if empty id', async () => {
      const updated = { id: '1', mainTeacherId: null };
      mockCourseRepository.assignMainTeacher.mockResolvedValue(updated);
      const result = await courseService.assignMainTeacher('1', '');
      expect(mockCourseRepository.assignMainTeacher).toHaveBeenCalledWith('1', null);
    });
    test('throws error if teacher not found', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);
      await expect(courseService.assignMainTeacher('1', '507f1f77bcf86cd799439011')).rejects.toThrow('El usuario especificado como profesor principal no existe.');
    });
  });
});
