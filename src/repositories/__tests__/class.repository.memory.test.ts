import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClassRepository from '../class.repository';
import { ClassSchema } from '@/models/mongo/class.model';
import { CourseSchema } from '@/models/mongo/course.model';

describe('ClassRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: ClassRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    // Register schemas
    mongoose.connection.model('Class', ClassSchema, 'classes');
    mongoose.connection.model('Course', CourseSchema, 'courses'); // Optional but good for validation
    
    repository = new ClassRepository(mongoose.connection as any);
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

  describe('create and findAllByCourse', () => {
    it('should assign order 1 to the first class of a course', async () => {
      const courseId = new Types.ObjectId();
      const classData = { name: 'Introduction', courseId };

      const created = await repository.create(classData as any);

      expect(created.order).toBe(1);
      expect(created.status).toBe('ACTIVE');
    });

    it('should assign sequential orders for multiple classes in the same course', async () => {
      const courseId = new Types.ObjectId();
      
      const c1 = await repository.create({ name: 'Class 1', courseId } as any);
      const c2 = await repository.create({ name: 'Class 2', courseId } as any);
      
      expect(c1.order).toBe(1);
      expect(c2.order).toBe(2);

      const classes = await repository.findAllByCourse(courseId.toString());
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('Class 1');
      expect(classes[1].name).toBe('Class 2');
    });
  });

  describe('moveUpOrder and moveDownOrder', () => {
    let courseId: Types.ObjectId;
    let c1: any;
    let c2: any;
    let c3: any;

    beforeEach(async () => {
      courseId = new Types.ObjectId();
      c1 = await repository.create({ name: 'Class 1', courseId } as any); // order 1
      c2 = await repository.create({ name: 'Class 2', courseId } as any); // order 2
      c3 = await repository.create({ name: 'Class 3', courseId } as any); // order 3
    });

    it('moveUpOrder should swap order with previous class', async () => {
      // Move Class 2 up (swap with Class 1)
      await repository.moveUpOrder(c2._id.toString());

      const updatedC1 = await repository.findOneById(c1._id.toString());
      const updatedC2 = await repository.findOneById(c2._id.toString());

      expect(updatedC2!.order).toBe(1);
      expect(updatedC1!.order).toBe(2);
    });

    it('moveUpOrder should do nothing if class is already first', async () => {
      await repository.moveUpOrder(c1._id.toString());

      const updatedC1 = await repository.findOneById(c1._id.toString());
      expect(updatedC1!.order).toBe(1);
    });

    it('moveDownOrder should swap order with next class', async () => {
      // Move Class 2 down (swap with Class 3)
      await repository.moveDownOrder(c2._id.toString());

      const updatedC2 = await repository.findOneById(c2._id.toString());
      const updatedC3 = await repository.findOneById(c3._id.toString());

      expect(updatedC2!.order).toBe(3);
      expect(updatedC3!.order).toBe(2);
    });

    it('moveDownOrder should do nothing if class is already last', async () => {
      await repository.moveDownOrder(c3._id.toString());

      const updatedC3 = await repository.findOneById(c3._id.toString());
      expect(updatedC3!.order).toBe(3);
    });
  });

  describe('updateExamConfig and getExamConfig', () => {
    it('should update and retrieve exam configuration', async () => {
      const courseId = new Types.ObjectId();
      const c = await repository.create({ name: 'Class with Exam', courseId } as any);

      const date = new Date();
      await repository.updateExamConfig(c._id.toString(), {
        examVisible: true,
        examLink: 'http://exam.com',
        examStartDate: date
      });

      const config = await repository.getExamConfig(c._id.toString());
      expect(config).toBeDefined();
      expect(config!.examVisible).toBe(true);
      expect(config!.examLink).toBe('http://exam.com');
      expect(config!.examStartDate).toEqual(date);
    });
  });
});
