import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import QuestionnaireRepository from '../questionnaire.repository';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';
import { CourseSchema } from '@/models/mongo/course.model';

describe('QuestionnaireRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: QuestionnaireRepository;
  let qModel: any;
  let courseModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    qModel = mongoose.connection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
    courseModel = mongoose.connection.model('Course', CourseSchema, 'courses');
    
    repository = new QuestionnaireRepository(mongoose.connection as any);
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

  const createValidQuestionnaire = async (overrides = {}) => {
    const cId = new Types.ObjectId();
    const q = {
      courseId: cId,
      title: 'Q1',
      description: 'Desc',
      position: { type: 'BETWEEN_CLASSES', order: 1 },
      questions: [
        {
          _id: new Types.ObjectId(),
          questionText: 'Q text',
          type: 'MULTIPLE_CHOICE',
          order: 1,
          points: 10,
          options: [
            { _id: new Types.ObjectId(), text: 'A', isCorrect: true, order: 1 },
            { _id: new Types.ObjectId(), text: 'B', isCorrect: false, order: 2 }
          ]
        }
      ],
      createdBy: new Types.ObjectId(),
      generatedBy: new Types.ObjectId(),
      status: 'ACTIVE',
      ...overrides
    };
    return qModel.create(q);
  };

  describe('CRUD', () => {
    it('should create and find by id', async () => {
      const q = await createValidQuestionnaire();
      const found = await repository.findById(q._id.toString());
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Q1');
    });

    it('should update mapping correctOptionIds indices to ObjectIds', async () => {
      const q = await createValidQuestionnaire();
      const qId = q._id.toString();
      const optId1 = q.questions[0].options[0]._id;
      const optId2 = q.questions[0].options[1]._id;

      // Update mapping numeric indices to option ObjectIds
      const updated = await repository.update(qId, {
        questions: [{
          ...q.questions[0].toObject(),
          correctOptionIds: [0, 1] // Indices 0 and 1
        }]
      } as any);

      expect(updated.questions[0].correctOptionIds).toHaveLength(2);
      expect(updated.questions[0].correctOptionIds![0].toString()).toBe(optId1.toString());
      expect(updated.questions[0].correctOptionIds![1].toString()).toBe(optId2.toString());
    });

    it('should updateQuestion mapping correctOptionIds indices', async () => {
      const q = await createValidQuestionnaire();
      const qId = q._id.toString();
      const questId = q.questions[0]._id.toString();
      const optId2 = q.questions[0].options[1]._id;

      const updated = await repository.updateQuestion(qId, questId, {
        points: 20,
        correctOptionIds: [1] as any // index 1
      });

      expect(updated.questions[0].points).toBe(20);
      expect(updated.questions[0].correctOptionIds![0].toString()).toBe(optId2.toString());
    });

    it('should delete by id', async () => {
      const q = await createValidQuestionnaire();
      const del = await repository.delete(q._id.toString());
      expect(del).not.toBeNull();
      const found = await repository.findById(q._id.toString());
      expect(found).toBeNull();
    });
  });

  describe('Finders', () => {
    it('should findByCourseId ordering BETWEEN_CLASSES first, then FINAL_EXAM', async () => {
      const courseId = new Types.ObjectId();
      await createValidQuestionnaire({ courseId, title: 'F1', position: { type: 'FINAL_EXAM' } });
      await createValidQuestionnaire({ courseId, title: 'B1', position: { type: 'BETWEEN_CLASSES', order: 1 } });
      await createValidQuestionnaire({ courseId, title: 'B2', position: { type: 'BETWEEN_CLASSES', order: 2 } });

      const res = await repository.findByCourseId(courseId.toString());
      expect(res).toHaveLength(3);
      expect(res[0].title).toBe('B1');
      expect(res[1].title).toBe('B2');
      expect(res[2].title).toBe('F1');
    });

    it('should findByProfessorId using $lookup to courses', async () => {
      const teacherId = new Types.ObjectId();
      const c = await courseModel.create({ name: 'Course 1', description: 'Desc', order: 1, status: 'ACTIVE', teachers: [teacherId] });
      await createValidQuestionnaire({ courseId: c._id, title: 'Q1' });

      // Unrelated
      await createValidQuestionnaire({ title: 'Q2' });

      const res = await repository.findByProfessorId(teacherId.toString());
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Q1');
    });

    it('should findByPosition', async () => {
      const courseId = new Types.ObjectId();
      const afterClassId = new Types.ObjectId();
      
      await createValidQuestionnaire({ 
        courseId, 
        title: 'Q', 
        position: { type: 'BETWEEN_CLASSES', afterClassId } 
      });

      const res = await repository.findByPosition(courseId.toString(), afterClassId.toString());
      expect(res).not.toBeNull();
      expect(res!.title).toBe('Q');
    });

    it('should findFinalExam', async () => {
      const courseId = new Types.ObjectId();
      
      await createValidQuestionnaire({ 
        courseId, 
        title: 'Final', 
        position: { type: 'FINAL_EXAM' } 
      });

      const res = await repository.findFinalExam(courseId.toString());
      expect(res).not.toBeNull();
      expect(res!.title).toBe('Final');
    });

    it('should countQuestionnairesByCourse', async () => {
      const courseId = new Types.ObjectId();
      await createValidQuestionnaire({ courseId });
      await createValidQuestionnaire({ courseId });
      
      const count = await repository.countQuestionnairesByCourse(courseId.toString());
      expect(count).toBe(2);
    });
  });
});
