/* eslint-env jest */
import CourseService from '@/services/course.service';

jest.mock('@/utils/emailer', () => ({ sendEmail: jest.fn() }));

const { sendEmail } = require('@/utils/emailer');

describe('CourseService - teachers notifications', () => {
  let mockCourseRepository: any;
  let mockUserRepository: any;
  let courseService: CourseService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCourseRepository = {
      findOneById: jest.fn(),
      updateTeachersAtomic: jest.fn(),
      update: jest.fn(),
    } as any;

    mockUserRepository = {
      getUserById: jest.fn().mockImplementation((id: string) => Promise.resolve({ _id: id, email: `${id}@example.com`, firstName: `User${id}` })),
    } as any;

    courseService = new CourseService(mockCourseRepository, mockUserRepository);
  });

  test('updateTeachers calls repo and notifies added and removed teachers', async () => {
    const courseId = 'course1';
    const course = { _id: courseId, title: 'Curso X', teachers: ['t1'] };

    mockCourseRepository.findOneById.mockResolvedValue(course);
    mockCourseRepository.updateTeachersAtomic.mockResolvedValue({ _id: courseId, title: 'Curso X' });

    await courseService.updateTeachers(courseId, { add: ['t2'], remove: ['t1'] });

    expect(mockCourseRepository.updateTeachersAtomic).toHaveBeenCalledWith(courseId, ['t2'], ['t1']);

    // sendEmail called for added and removed
    expect(sendEmail).toHaveBeenCalled();
    // previously would notify in-app; now notifications removed so only email expected
    // sendEmail called for added and removed
    expect(sendEmail).toHaveBeenCalled();
  });

  test('update detects teacher diffs and notifies added', async () => {
    const courseId = 'course2';
    const existing = { _id: courseId, teachers: ['t1'] };
    const updated = { _id: courseId, teachers: ['t1', 't2'] };

    mockCourseRepository.findOneById.mockResolvedValue(existing);
    mockCourseRepository.update.mockResolvedValue(updated);

    const res = await courseService.update(courseId, { teachers: ['t1', 't2'] } as any);

    expect(mockCourseRepository.update).toHaveBeenCalledWith(courseId, { teachers: ['t1', 't2'] }, undefined);
    // notification removed; ensure email was attempted
    expect(sendEmail).toHaveBeenCalled();
    expect(res).toEqual(updated);
  });

  test('handleTeacherAssignmentChanges continues when sendEmail fails', async () => {
    const added = ['t3'];
    const removed = ['t4'];
    const course = { _id: 'course3', title: 'Curso Y' } as any;

    // make sendEmail throw once
    (sendEmail as jest.Mock).mockImplementationOnce(() => { throw new Error('SMTP down'); });

    await expect((courseService as any).handleTeacherAssignmentChanges(added, removed, course)).resolves.not.toThrow();

    // notification removed; only ensure function completes without throwing and email attempted
    expect(sendEmail).toHaveBeenCalled();
  });
  describe('Progress Update with Surveys', () => {
    test('should update progress correctly when a survey is completed', async () => {
      const updateData = {
        lastModuleCompleted: 'survey-101',
        progressPercentage: 100
      };

      // Simulamos que el repositorio acepta la actualización del progreso
      mockCourseRepository.update.mockResolvedValue({ id: '1', ...updateData });

      const result = await courseService.update('1', updateData as any);

      expect((result as any).progressPercentage).toBe(100);
      expect(mockCourseRepository.update).toHaveBeenCalled();
    });
  });
});
