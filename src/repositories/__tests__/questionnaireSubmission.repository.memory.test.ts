import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import QuestionnaireSubmissionRepository from '../questionnaireSubmission.repository';
import { QuestionnaireSubmissionSchema } from '@/models/mongo/questionnaireSubmission.model';
import { UserSchema } from '@/models/user.model';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';

describe('QuestionnaireSubmissionRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: QuestionnaireSubmissionRepository;
  let subModel: any;
  let userModel: any;
  let qModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    subModel = mongoose.connection.model('QuestionnaireSubmission', QuestionnaireSubmissionSchema, 'questionnaireSubmissions');
    userModel = mongoose.connection.model('User', UserSchema, 'users');
    qModel = mongoose.connection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
    
    repository = new QuestionnaireSubmissionRepository(mongoose.connection as any);
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

  const createValidSubmission = async (overrides = {}) => {
    return subModel.create({
      studentId: new Types.ObjectId(),
      courseId: new Types.ObjectId(),
      questionnaireId: new Types.ObjectId(),
      attemptNumber: 1,
      answers: [],
      status: 'SUBMITTED',
      ...overrides
    });
  };

  describe('CRUD & Finders', () => {
    it('should create and find by id', async () => {
      const sub = await createValidSubmission({ attemptNumber: 1 });
      const found = await repository.findById(sub._id.toString());
      expect(found).not.toBeNull();
    });

    it('should findByIdWithStudent and populate correctly', async () => {
      const user = await userModel.create({
        firstName: 'John', lastName: 'Doe', email: 'john@test.com', username: 'john', password: 'h'
      });
      const sub = await createValidSubmission({ studentId: user._id });

      const found = await repository.findByIdWithStudent(sub._id.toString());
      expect(found).not.toBeNull();
      expect((found!.studentId as any).firstName).toBe('John');
      expect((found!.studentId as any).email).toBe('john@test.com');
    });

    it('should update submission', async () => {
      const sub = await createValidSubmission();
      const updated = await repository.update(sub._id.toString(), { status: 'GRADED' } as any);
      expect(updated.status).toBe('GRADED');
    });

    it('should findByStudentAndQuestionnaire sorted by attemptNumber', async () => {
      const studentId = new Types.ObjectId();
      const questionnaireId = new Types.ObjectId();
      
      await createValidSubmission({ studentId, questionnaireId, attemptNumber: 2 });
      await createValidSubmission({ studentId, questionnaireId, attemptNumber: 1 });

      const res = await repository.findByStudentAndQuestionnaire(studentId.toString(), questionnaireId.toString());
      expect(res).toHaveLength(2);
      expect(res[0].attemptNumber).toBe(1);
      expect(res[1].attemptNumber).toBe(2);
    });

    it('should getBestSubmission (GRADED only)', async () => {
      const studentId = new Types.ObjectId();
      const questionnaireId = new Types.ObjectId();
      
      // Not graded
      await createValidSubmission({ studentId, questionnaireId, finalScore: 100, status: 'SUBMITTED', attemptNumber: 1 });
      // Graded
      await createValidSubmission({ studentId, questionnaireId, finalScore: 50, status: 'GRADED', attemptNumber: 2 });
      await createValidSubmission({ studentId, questionnaireId, finalScore: 80, status: 'GRADED', attemptNumber: 3 });

      const best = await repository.getBestSubmission(studentId.toString(), questionnaireId.toString());
      expect(best).not.toBeNull();
      expect(best!.finalScore).toBe(80);
    });

    it('should getNextAttemptNumber', async () => {
      const studentId = new Types.ObjectId();
      const questionnaireId = new Types.ObjectId();
      
      expect(await repository.getNextAttemptNumber(studentId.toString(), questionnaireId.toString())).toBe(1);

      await createValidSubmission({ studentId, questionnaireId, attemptNumber: 2 });
      expect(await repository.getNextAttemptNumber(studentId.toString(), questionnaireId.toString())).toBe(3);
    });
  });

  describe('Complex Queries (Grade Report & Pending)', () => {
    it('should generate grade report with user populated names', async () => {
      const user = await userModel.create({
        firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', username: 'jane', password: 'h'
      });
      const qId = new Types.ObjectId();
      await createValidSubmission({ studentId: user._id, questionnaireId: qId, status: 'GRADED', attemptNumber: 1 });
      
      const report = await repository.getGradeReport(qId.toString());
      expect(report).toHaveLength(1);
      const entry: any = report[0];
      expect(entry.studentName).toBe('Jane Smith');
      expect(entry.studentEmail).toBe('jane@test.com');
    });

    it('should find pending submissions for a specific questionnaire', async () => {
      const user = await userModel.create({ firstName: 'J', lastName: 'S', email: 'j@t.c', username: 'j', password: 'h' });
      const qId = new Types.ObjectId();
      
      await createValidSubmission({ studentId: user._id, questionnaireId: qId, status: 'SUBMITTED', attemptNumber: 1 }); // Pending
      await createValidSubmission({ studentId: user._id, questionnaireId: qId, status: 'GRADED', attemptNumber: 2 }); // Not pending
      
      const pending = await repository.findPendingByQuestionnaire(qId.toString());
      expect(pending).toHaveLength(1);
      expect((pending[0].studentId as any).firstName).toBe('J');
    });

    it('should find pending submissions assigned to a teacher based on questionnaire creator', async () => {
      const teacherId = new Types.ObjectId();
      
      // Questionnaires
      const qMineId = new Types.ObjectId();
      const qOtherId = new Types.ObjectId();
      await qModel.collection.insertOne({ _id: qMineId, title: 'My Q', createdBy: teacherId, status: 'ACTIVE' });
      await qModel.collection.insertOne({ _id: qOtherId, title: 'Other Q', createdBy: new Types.ObjectId(), status: 'ACTIVE' });

      // Pending for mine
      await createValidSubmission({ questionnaireId: qMineId, status: 'SUBMITTED', attemptNumber: 1 });
      // Graded for mine (not pending)
      await createValidSubmission({ questionnaireId: qMineId, status: 'GRADED', attemptNumber: 2 });
      // Pending for other
      await createValidSubmission({ questionnaireId: qOtherId, status: 'SUBMITTED', attemptNumber: 1 });

      const pending = await repository.findPendingForTeacher(teacherId.toString());
      expect(pending).toHaveLength(1);
      expect((pending[0].questionnaireId as any)._id.toString()).toBe(qMineId.toString());
    });
  });

  describe('Deletions', () => {
    it('should delete by student and questionnaire', async () => {
      const sId = new Types.ObjectId();
      const qId = new Types.ObjectId();
      await createValidSubmission({ studentId: sId, questionnaireId: qId, attemptNumber: 1 });
      await createValidSubmission({ studentId: sId, questionnaireId: qId, attemptNumber: 2 });
      
      const deleted = await repository.deleteByStudentAndQuestionnaire(sId.toString(), qId.toString());
      expect(deleted).toBe(2);
      expect(await repository.hasSubmissions(qId.toString())).toBe(false);
    });

    it('should delete by student and course', async () => {
      const sId = new Types.ObjectId();
      const cId = new Types.ObjectId();
      await createValidSubmission({ studentId: sId, courseId: cId, attemptNumber: 1 });
      await createValidSubmission({ studentId: sId, courseId: cId, attemptNumber: 2 });

      const deleted = await repository.deleteByStudentAndCourse(sId.toString(), cId.toString());
      expect(deleted).toBe(2);
    });

    it('should delete by questionnaire', async () => {
      const qId = new Types.ObjectId();
      await createValidSubmission({ questionnaireId: qId });

      const deleted = await repository.deleteByQuestionnaire(qId.toString());
      expect(deleted).toBe(1);
    });

    it('should delete all by student', async () => {
      const sId = new Types.ObjectId();
      await createValidSubmission({ studentId: sId, attemptNumber: 1 });
      await createValidSubmission({ studentId: sId, attemptNumber: 2 });

      const deleted = await repository.deleteAllByStudent(sId.toString());
      expect(deleted).toBe(2);
    });
  });
});
