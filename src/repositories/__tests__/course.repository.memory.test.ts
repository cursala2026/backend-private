import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import CourseRepository from '../course.repository';

// Schemas necesarios para las colecciones
import { CourseSchema, ClassSchema, UserSchema, QuestionnaireSchema } from '@/models';

describe('CourseRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: CourseRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    // El repositorio usa la connection inyectada para registrar el modelo
    repository = new CourseRepository(mongoose.connection as any);

    // Registrar otros modelos necesarios para los $lookup
    mongoose.connection.model('Class', ClassSchema, 'classes');
    mongoose.connection.model('User', UserSchema, 'users');
    mongoose.connection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
  }, 30000); // Aumentar timeout por la inicialización de memory server

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

  describe('create and findOneById (Aggregation with lookups)', () => {
    it('should create a course and then find it populated with classes and teachers', async () => {
      // 1. Crear usuario (profesor)
      const UserModel = mongoose.connection.model('User');
      const teacher = await UserModel.create({
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        password: 'password123',
        email: 'john@example.com',
        roles: ['ADMIN'],
      });

      // 2. Crear curso asignándole el profesor
      const courseData = {
        name: 'Test Course with Memory Server',
        description: 'Testing aggregations',
        teachers: [teacher._id], // Array de ObjectIds
        isPublished: true,
      };

      const createdCourse = await repository.create(courseData as any);
      expect(createdCourse).toBeDefined();
      expect(createdCourse._id).toBeDefined();
      expect(createdCourse.order).toBe(1);

      // 3. Crear una clase asociada al curso
      const ClassModel = mongoose.connection.model('Class');
      await ClassModel.create({
        name: 'First Class',
        courseId: createdCourse._id,
        order: 1,
        status: 'ACTIVE'
      });

      await ClassModel.create({
        name: 'Second Class',
        courseId: createdCourse._id,
        order: 2,
        status: 'ACTIVE'
      });

      // 4. Utilizar findOneById que ejecuta un complex aggregation ($lookup a classes, users, questionnaires)
      const foundCourse = await repository.findOneById(createdCourse._id.toString());

      // Validaciones base
      expect(foundCourse).not.toBeNull();
      expect(foundCourse!.name).toBe('Test Course with Memory Server');

      // Validaciones de $lookup de clases (pipeline interno ordena por 'order')
      expect(foundCourse!.classes).toBeDefined();
      expect(Array.isArray(foundCourse!.classes)).toBe(true);
      expect(foundCourse!.classes.length).toBe(2);
      expect((foundCourse!.classes as any)[0].name).toBe('First Class');
      expect((foundCourse!.classes as any)[1].name).toBe('Second Class');
      expect((foundCourse! as any).classCount).toBe(2);

      // Validaciones de $lookup de profesores (teachersInfo se hace sobre el array 'teachers')
      expect((foundCourse! as any).teachersInfo).toBeDefined();
      expect(Array.isArray((foundCourse! as any).teachersInfo)).toBe(true);
      expect((foundCourse! as any).teachersInfo.length).toBe(1);
      expect((foundCourse! as any).teachersInfo[0].teacherName).toBe('John Doe');
      expect((foundCourse! as any).teachersInfo[0].email).toBe('john@example.com');
    });

    it('should return null if course does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toHexString();
      const result = await repository.findOneById(nonExistentId);
      expect(result).toBeNull();
    });
  });

  describe('updateTeachersAtomic', () => {
    it('should atomically add and remove teachers using mongoose operators', async () => {
      const courseData = {
        name: 'Teacher Update Course',
        teachers: [],
      };
      const course = await repository.create(courseData as any);
      const teacher1Id = new Types.ObjectId().toHexString();
      const teacher2Id = new Types.ObjectId().toHexString();

      // Add teachers
      let updated = await repository.updateTeachersAtomic(course._id.toString(), [teacher1Id, teacher2Id], []);
      expect(updated.teachers).toHaveLength(2);
      expect(updated.teachers!.map(String)).toContain(teacher1Id);
      expect(updated.teachers!.map(String)).toContain(teacher2Id);

      // Remove one teacher
      updated = await repository.updateTeachersAtomic(course._id.toString(), [], [teacher1Id]);
      expect(updated.teachers).toHaveLength(1);
      expect(updated.teachers!.map(String)).not.toContain(teacher1Id);
      expect(updated.teachers!.map(String)).toContain(teacher2Id);
    });
  });
});
