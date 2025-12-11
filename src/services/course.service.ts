import fs from 'fs';
import path from 'path';
import { ICourse, Types } from '@/models';
import CourseRepository from '@/repositories/course.repository';
import UserRepository from '@/repositories/user.repository';

export default class CourseService {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository
  ) {}

  async findOneById(id: string) {
    return this.courseRepository.findOneById(id);
  }

  async findById(id: string): Promise<ICourse | null> {
    return this.courseRepository.findById(id);
  }

  async update(id: string, updateData: Partial<ICourse>, unsetFields?: string[]): Promise<ICourse> {
    return this.courseRepository.update(id, updateData, unsetFields);
  }

  async create(courseData: Partial<ICourse>): Promise<ICourse> {
    return this.courseRepository.create(courseData);
  }

  async delete(id: string): Promise<ICourse | null> {
    return this.courseRepository.delete(id);
  }

  async findAll(): Promise<ICourse[]> {
    return this.courseRepository.findAll();
  }

  async findPublishedCourses(): Promise<ICourse[]> {
    return this.courseRepository.findPublishedCourses();
  }

  async changeStatus(courseId: string, status: string): Promise<ICourse | null> {
    return this.courseRepository.changeStatus(courseId, status);
  }

  async moveUpOrder(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.moveUpOrder(courseId);
  }

  async moveDownOrder(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.moveDownOrder(courseId);
  }

  async getCourseImage(imageFileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(__dirname, '../static/images', imageFileName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading course image: ${error.message}`);
      }
      throw new Error('Unknown error reading course image');
    }
  }

  async findForHome(): Promise<Array<Omit<ICourse, '_id'> & { _id: string }>> {
    return this.courseRepository.findForHome();
  }

  async changeShowOnHome(courseId: string): Promise<ICourse | null> {
    return this.courseRepository.changeShowOnHome(courseId);
  }

  async assignMainTeacher(courseId: string, mainTeacherId: string): Promise<ICourse> {
    // If mainTeacherId is empty or null, remove the main teacher
    if (!mainTeacherId || mainTeacherId === '') {
      return this.courseRepository.assignMainTeacher(courseId, null);
    }

    // Validate that the user exists
    const teacher = await this.userRepository.getUserById(mainTeacherId);
    if (!teacher) {
      throw new Error('El usuario especificado como profesor principal no existe.');
    }

    // Assign the main teacher to the course
    return this.courseRepository.assignMainTeacher(courseId, new Types.ObjectId(mainTeacherId));
  }
}
