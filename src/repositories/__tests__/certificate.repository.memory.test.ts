import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import CertificateRepository from '../certificate.repository';
import { CertificateSchema } from '@/models/mongo/certificate.model';
import { UserSchema, CourseSchema } from '@/models';

describe('CertificateRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: CertificateRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    mongoose.connection.model('Certificate', CertificateSchema, 'certificates');
    mongoose.connection.model('User', UserSchema, 'users');
    mongoose.connection.model('Course', CourseSchema, 'courses');
    
    repository = new CertificateRepository(mongoose.connection as any);
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

  describe('create and findExistingCertificate', () => {
    it('should create a certificate and find it by student and course id', async () => {
      const studentId = new Types.ObjectId();
      const courseId = new Types.ObjectId();
      
      const certData = {
        studentId,
        courseId,
        certificateId: 'CERT-XYZ',
        verificationCode: 'XYZ123',
        certificateUrl: 'http://cert.com/1',
        teacherId: new Types.ObjectId(),
        generatedBy: new Types.ObjectId(),
        generatedAt: new Date(),
        isActive: true,
      };

      const created = await repository.create(certData as any);
      expect(created.verificationCode).toBe('XYZ123');

      const found = await repository.findExistingCertificate(studentId.toString(), courseId.toString());
      expect(found).not.toBeNull();
      expect(found!.verificationCode).toBe('XYZ123');
    });
  });

  describe('findByCourse and findByStudent (populate)', () => {
    let studentId: Types.ObjectId;
    let courseId: Types.ObjectId;
    let teacherId: Types.ObjectId;

    beforeEach(async () => {
      const UserModel = mongoose.connection.model('User');
      const CourseModel = mongoose.connection.model('Course');

      const student = await UserModel.create({ firstName: 'Student', lastName: 'One', username: 's1', email: 's@test.com', password: 'p' });
      studentId = student._id as Types.ObjectId;
      
      const teacher = await UserModel.create({ firstName: 'Teacher', lastName: 'Two', username: 't1', email: 't@test.com', password: 'p' });
      teacherId = teacher._id as Types.ObjectId;

      const course = await CourseModel.create({ name: 'Course', description: 'Desc', order: 1 });
      courseId = course._id as Types.ObjectId;

      await repository.create({
        studentId,
        courseId,
        teacherId,
        generatedBy: teacherId,
        certificateId: 'CERT-ABC',
        verificationCode: 'ABC',
        certificateUrl: 'http',
        generatedAt: new Date(),
        isActive: true,
      } as any);
    });

    it('should find certificates by course and populate student and generator', async () => {
      const certs = await repository.findByCourse(courseId.toString());
      
      expect(certs).toHaveLength(1);
      expect(certs[0].verificationCode).toBe('ABC');
      expect((certs[0].studentId as any).firstName).toBe('Student');
      expect((certs[0].generatedBy as any).firstName).toBe('Teacher');
    });

    it('should find certificates by student and populate course, teacher, generator', async () => {
      const certs = await repository.findByStudent(studentId.toString());
      
      expect(certs).toHaveLength(1);
      expect((certs[0].courseId as any).name).toBe('Course');
      expect((certs[0].teacherId as any).firstName).toBe('Teacher');
      expect((certs[0].generatedBy as any).firstName).toBe('Teacher');
    });
  });

  describe('softDelete and verification', () => {
    it('should soft delete and not be found by active filters', async () => {
      const certData = {
        studentId: new Types.ObjectId(),
        courseId: new Types.ObjectId(),
        teacherId: new Types.ObjectId(),
        generatedBy: new Types.ObjectId(),
        certificateId: 'CERT-SOFTDEL',
        verificationCode: 'SOFTDEL',
        certificateUrl: 'url',
        isActive: true,
      };

      const cert = await repository.create(certData as any);
      const deleted = await repository.softDelete(cert._id.toString());
      
      expect(deleted!.isActive).toBe(false);

      const found = await repository.findOneByVerificationCode('SOFTDEL');
      expect(found).toBeNull(); // Should be null because isActive is false
    });
  });

  describe('deleteByStudentAndCourse & deleteAllByStudent', () => {
    it('should physically delete by student and course', async () => {
      const studentId = new Types.ObjectId();
      const courseId = new Types.ObjectId();
      
      const teacherId = new Types.ObjectId();
      const generatedBy = new Types.ObjectId();
      await repository.create({ studentId, courseId, teacherId, generatedBy, verificationCode: 'A', certificateId: 'CERT-A', isActive: true } as any);
      await repository.create({ studentId, courseId: new Types.ObjectId(), teacherId, generatedBy, verificationCode: 'B', certificateId: 'CERT-B', isActive: true } as any);

      const result = await repository.deleteByStudentAndCourse(studentId.toString(), courseId.toString());
      expect(result.deletedCount).toBe(1);
      
      // Should still have 'B'
      const remaining = await repository.findByStudent(studentId.toString());
      expect(remaining).toHaveLength(1);
      expect(remaining[0].verificationCode).toBe('B');
    });

    it('should physical delete all for a student', async () => {
      const studentId = new Types.ObjectId();
      const teacherId = new Types.ObjectId();
      const generatedBy = new Types.ObjectId();
      await repository.create({ studentId, courseId: new Types.ObjectId(), teacherId, generatedBy, verificationCode: 'C', certificateId: 'CERT-C', isActive: true } as any);
      await repository.create({ studentId, courseId: new Types.ObjectId(), teacherId, generatedBy, verificationCode: 'D', certificateId: 'CERT-D', isActive: true } as any);

      const result = await repository.deleteAllByStudent(studentId.toString());
      expect(result.deletedCount).toBe(2);

      const remaining = await repository.findByStudent(studentId.toString());
      expect(remaining).toHaveLength(0);
    });
  });
});
