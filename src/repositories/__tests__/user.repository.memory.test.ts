import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import UserRepository from '../user.repository';
import { UserSchema } from '@/models/user.model';
import { UserStatus } from '@/models';
import { CourseSchema } from '@/models/mongo/course.model';
import { ClassSchema } from '@/models/mongo/class.model';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';
import { CourseProgressSchema } from '@/models/mongo/courseProgress.model';
import bcrypt from 'bcryptjs';

describe('UserRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: UserRepository;
  let userModel: any;
  let courseModel: any;
  let classModel: any;
  let qModel: any;
  let cpModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    userModel = mongoose.connection.model('User', UserSchema, 'users');
    courseModel = mongoose.connection.model('Course', CourseSchema, 'courses');
    classModel = mongoose.connection.model('Class', ClassSchema, 'classes');
    qModel = mongoose.connection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
    cpModel = mongoose.connection.model('CourseProgress', CourseProgressSchema, 'courseprogresses');
    
    repository = new UserRepository(mongoose.connection as any);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Basic CRUD & Finders', () => {
    it('should create and find user by email/username/id', async () => {
      const created = await repository.createUser({
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        email: 'john@test.com',
        password: 'hash',
        roles: ['ALUMNO'],
        status: UserStatus.ACTIVE
      } as any);

      expect(created._id).toBeDefined();

      const byEmail = await repository.findOneByEmail('JOHN@test.com'); // testing case insensitive
      expect(byEmail).not.toBeNull();
      expect(byEmail!.username).toBe('johndoe');

      const byUsername = await repository.findOneByUsername('johndoe');
      expect(byUsername).not.toBeNull();

      const byId = await repository.findById(created._id.toString());
      expect(byId).not.toBeNull();
      
      const byOne = await repository.findOne('johndoe');
      expect(byOne).not.toBeNull();
    });

    it('should update user, hashing password if provided, and parsing dates', async () => {
      const user = await repository.createUser({
        firstName: 'Jane',
        lastName: 'Smith',
        username: 'jane',
        email: 'jane@test.com',
        password: 'hash',
      } as any);

      const updated = await repository.updateUser(user._id.toString(), {
        firstName: 'Janet',
        password: 'newpassword',
        birthDate: '1990-01-01T00:00:00Z' as any // Should be parsed to Date
      });

      expect(updated!.firstName).toBe('Janet');
      // Password should be hashed
      expect(updated!.password).not.toBe('newpassword');
      const isMatch = await bcrypt.compare('newpassword', updated!.password);
      expect(isMatch).toBe(true);
      expect(updated!.birthDate).toBeInstanceOf(Date);
    });

    it('should delete user', async () => {
      const user = await repository.createUser({ firstName: 'D', lastName: 'D', username: 'del', email: 'del@t.c', password: 'h' } as any);
      await repository.deleteUser(user._id.toString());
      const found = await repository.findById(user._id.toString());
      expect(found).toBeNull();
    });

    it('should add/remove roles', async () => {
      const user = await repository.createUser({ firstName: 'R', lastName: 'R', username: 'r', email: 'r@t.c', password: 'h', roles: [] } as any);
      const withRole = await repository.addRoleToUser(user._id.toString(), 'ADMIN');
      expect(withRole!.roles).toContain('ADMIN');
      const withoutRole = await repository.removeRoleFromUser(user._id.toString(), 'ADMIN');
      expect(withoutRole!.roles).not.toContain('ADMIN');
    });

    it('should get Teachers', async () => {
      await repository.createUser({ firstName: 'T', lastName: 'T', username: 't', email: 't@t.c', password: 'h', roles: ['PROFESOR'] } as any);
      await repository.createUser({ firstName: 'A', lastName: 'A', username: 'a', email: 'a@t.c', password: 'h', roles: ['ALUMNO'] } as any);
      
      const teachers = await repository.getTeachers();
      expect(teachers).toHaveLength(1);
      expect(teachers[0].roles).toContain('PROFESOR');
    });
  });

  describe('Course Assignment & Validation (isCourseValidForUser)', () => {
    it('should validate course access based on Course.students array', async () => {
      const course = await courseModel.create({
        name: 'JS Course',
        description: 'Desc',
        order: 1,
        status: 'ACTIVE',
        students: []
      });

      const user = await repository.createUser({ firstName: 'U', lastName: 'U', username: 'u', email: 'u@t.c', password: 'h' } as any);

      // Initially not assigned
      let valid = await repository.isCourseAccessibleForUser(user._id.toString(), course._id.toString());
      expect(valid).toBe(false);

      // Assign student to course
      await courseModel.findByIdAndUpdate(course._id, {
        $push: {
          students: { userId: user._id, startDate: new Date(Date.now() - 10000) } // No end date
        }
      });

      valid = await repository.isCourseAccessibleForUser(user._id.toString(), course._id.toString());
      expect(valid).toBe(true);
    });
  });

  describe('getUsersPaginated (Complex Aggregation)', () => {
    it('should filter by courseId ("none", "unassigned", or specific ID)', async () => {
      const user1 = await repository.createUser({ firstName: '1', lastName: '1', username: 'u1', email: '1@t.c', password: 'h' } as any); // Unassigned
      const user2 = await repository.createUser({ firstName: '2', lastName: '2', username: 'u2', email: '2@t.c', password: 'h', assignedCoursesEdit: [] } as any); // Specific assigned later
      
      const course = await courseModel.create({ name: 'C1', description: 'D1', order: 1, status: 'ACTIVE', students: [{ userId: user2._id }] });

      // No courseId filter
      let res = await repository.getUsersPaginated({ page: 1, limit: 10, sort: 'createdAt', dir: -1 });
      expect(res.data).toHaveLength(2);

      // unassigned / none filter
      res = await repository.getUsersPaginated({ page: 1, limit: 10, sort: 'createdAt', dir: -1, courseId: 'none' });
      expect(res.data).toHaveLength(1); // Only user1
      expect(res.data[0].email).toBe('1@t.c');

      // Specific course filter
      res = await repository.getUsersPaginated({ page: 1, limit: 10, sort: 'createdAt', dir: -1, courseId: course._id.toString() });
      expect(res.data).toHaveLength(1); // Only user2
      expect(res.data[0].email).toBe('2@t.c');
    });

    it('should search by term across multiple fields', async () => {
      await repository.createUser({ firstName: 'Albert', lastName: 'Einstein', username: 'ae', email: 'ae@t.c', password: 'h' } as any);
      await repository.createUser({ firstName: 'Isaac', lastName: 'Newton', username: 'in', email: 'in@t.c', password: 'h' } as any);

      const res = await repository.getUsersPaginated({ page: 1, limit: 10, sort: 'createdAt', dir: -1, search: 'einstein' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].firstName).toBe('Albert');
    });
  });

  describe('getStudentsByTeacherCourses (Massive Stats Aggregation)', () => {
    it('should aggregate students, classes, questionnaires, and progress for teacher courses', async () => {
      const u1 = await repository.createUser({ firstName: 'S1', lastName: 'S1', username: 's1', email: 's1@t.c', password: 'h' } as any);
      const c1 = await courseModel.create({
        name: 'Teacher Course', description: 'Desc', order: 1, status: 'ACTIVE',
        students: [{ userId: u1._id }] // Enroll S1
      });

      // 2 Classes active in C1
      const cl1 = await classModel.create({ courseId: c1._id, name: 'Cl1', videoUrl: 'https://test.com/video.mp4', duration: 10, order: 1, status: 'ACTIVE' });
      await classModel.create({ courseId: c1._id, name: 'Cl2', videoUrl: 'https://test.com/video.mp4', duration: 10, order: 2, status: 'ACTIVE' }); // cl2
      
      // 1 Questionnaire active in C1
      const qId = new Types.ObjectId();
      await qModel.collection.insertOne({ 
        _id: qId,
        courseId: c1._id, 
        title: 'Q1', 
        status: 'ACTIVE'
      });
      // Create CourseProgress for S1
      await cpModel.create({
        userId: u1._id,
        courseId: c1._id,
        classesProgress: [{ classId: cl1._id, completed: true }], // 1 class completed
        questionnairesProgress: [{ questionnaireId: qId, completed: false, bestScore: 0 }] // questionnaire not completed
      });

      // Execute aggregation
      const studentsStats = await repository.getStudentsByTeacherCourses([c1._id as Types.ObjectId]);
      
      expect(studentsStats).toHaveLength(1);
      const stat = studentsStats[0];
      expect(stat.userId).toBe(u1._id.toString());
      expect(stat.courseName).toBe('Teacher Course');
      
      // Totals
      expect(stat.totalClasses).toBe(2);
      expect(stat.totalQuestionnaires).toBe(1);
      
      // Completed
      expect(stat.completedClasses).toBe(1);
      expect(stat.completedQuestionnaires).toBe(0);

      // Progress %: Total items = 3, Completed = 1. -> 33.33% -> 33
      expect(stat.progress).toBe(33);
    });
  });

  describe('Dashboard Analytics / Counters', () => {
    it('should return valid counts and monthly stats', async () => {
      await repository.createUser({ firstName: 'c', lastName: '1', username: 'c1', email: 'c1@t.c', password: 'h', roles: ['ALUMNO'] } as any);
      await repository.createUser({ firstName: 'c', lastName: '2', username: 'c2', email: 'c2@t.c', password: 'h', roles: ['ALUMNO'] } as any);
      await repository.createUser({ firstName: 'c', lastName: '3', username: 'c3', email: 'c3@t.c', password: 'h', roles: ['PROFESOR'] } as any);
      await repository.createUser({ firstName: 'c', lastName: '4', username: 'c4', email: 'c4@t.c', password: 'h', roles: ['ADMIN'] } as any);

      expect(await repository.countUsers()).toBe(4);
      expect(await repository.countStudents()).toBe(2);
      expect(await repository.countTeachers()).toBe(1);
      expect(await repository.countAdmins()).toBe(1);

      const monthly = await repository.getUsersByMonth(6);
      expect(monthly).toHaveLength(6);
      // The last month (current month) should have 4 users.
      expect(monthly[5].count).toBe(4);
    });
  });
});
