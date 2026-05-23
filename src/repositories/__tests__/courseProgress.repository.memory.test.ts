import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mock the general connection BEFORE importing the repository
jest.mock('@/config/databases', () => {
  const mongoose = require('mongoose');
  return {
    __esModule: true,
    default: mongoose.connection,
  };
});

import { courseProgressRepository as repository } from '../courseProgress.repository';
import { CourseProgressSchema } from '@/models/mongo/courseProgress.model';
import { ClassSchema } from '@/models/mongo/class.model';
import { QuestionnaireSchema } from '@/models/mongo/questionnaire.model';

describe('CourseProgressRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repositoryRef: any;
  let cpModel: any;
  let classModel: any;
  let qModel: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    // Register CourseProgressModel explicitly to ensure it uses the mock connection
    cpModel = mongoose.connection.model('CourseProgress', CourseProgressSchema, 'courseprogresses');
    classModel = mongoose.connection.model('Class', ClassSchema, 'classes');
    qModel = mongoose.connection.model('Questionnaire', QuestionnaireSchema, 'questionnaires');
    
    repositoryRef = repository;
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

  const uId = new Types.ObjectId();
  const cId = new Types.ObjectId();

  describe('Basic operations & recalculations', () => {
    it('should upsert progress for a class', async () => {
      const classId1 = new Types.ObjectId();
      
      await classModel.collection.insertOne({ _id: classId1, courseId: cId, name: 'C1', status: 'ACTIVE' });
      
      const p = await repository.upsert(uId.toString(), cId.toString(), {
        classId: classId1.toString(),
        completed: true,
      }, 1);

      expect(p.overallProgress).toBe(100);
      expect(p.classesProgress).toHaveLength(1);
      expect(p.classesProgress[0].completed).toBe(true);
    });

    it('should update progress for questionnaire', async () => {
      const qId = new Types.ObjectId();
      await qModel.collection.insertOne({ _id: qId, courseId: cId, title: 'Q', status: 'ACTIVE' });

      const p = await repository.updateQuestionnaireProgress(uId.toString(), cId.toString(), qId.toString(), 100);
      
      expect(p.overallProgress).toBe(100);
      expect(p.questionnairesProgress).toHaveLength(1);
      expect(p.questionnairesProgress[0].completed).toBe(true);
      expect(p.questionnairesProgress[0].bestScore).toBe(100);
    });

    it('should check if canAccessClass based on questionnairesBefore', async () => {
      const qId = new Types.ObjectId();
      await qModel.collection.insertOne({ _id: qId, courseId: cId, title: 'Q', status: 'ACTIVE' });

      // No progress yet
      let access = await repository.canAccessClass(uId.toString(), cId.toString(), new Types.ObjectId().toString(), [qId.toString()]);
      expect(access.canAccess).toBe(false);

      // Pass the questionnaire
      await repository.updateQuestionnaireProgress(uId.toString(), cId.toString(), qId.toString(), 100);

      access = await repository.canAccessClass(uId.toString(), cId.toString(), new Types.ObjectId().toString(), [qId.toString()]);
      expect(access.canAccess).toBe(true);
    });

    it('should recalculateOverallProgress', async () => {
      const classId1 = new Types.ObjectId();
      await classModel.collection.insertOne({ _id: classId1, courseId: cId, name: 'C1', status: 'ACTIVE' });
      
      // Upsert class as complete (50% since there's 1 class and 1 questionnaire now)
      const qId = new Types.ObjectId();
      await qModel.collection.insertOne({ _id: qId, courseId: cId, title: 'Q', status: 'ACTIVE' });
      
      await repository.upsert(uId.toString(), cId.toString(), { classId: classId1.toString(), completed: true }, 1);
      
      // Check current progress
      let p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p!.overallProgress).toBe(50); // 1 out of 2 completed
      
      // Complete questionnaire
      await repository.updateQuestionnaireProgress(uId.toString(), cId.toString(), qId.toString(), 100);
      
      // Recalculate
      await repository.recalculateOverallProgress(cId.toString());
      
      p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p!.overallProgress).toBe(100); // 2 out of 2 completed
    });
  });

  describe('Deletions and resets', () => {
    it('should remove class from all progress', async () => {
      const classId1 = new Types.ObjectId();
      await classModel.collection.insertOne({ _id: classId1, courseId: cId, name: 'C1', status: 'ACTIVE' });
      
      await repository.upsert(uId.toString(), cId.toString(), { classId: classId1.toString(), completed: true }, 1);
      
      await repository.removeClassFromAllProgress(cId.toString(), classId1.toString());
      
      const p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p!.classesProgress).toHaveLength(0);
    });

    it('should reset class progress', async () => {
      const classId1 = new Types.ObjectId();
      await classModel.collection.insertOne({ _id: classId1, courseId: cId, name: 'C1', status: 'ACTIVE' });
      
      await repository.upsert(uId.toString(), cId.toString(), { classId: classId1.toString(), completed: true }, 1);
      
      await repository.resetClassProgress(cId.toString(), classId1.toString());
      
      const p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p!.classesProgress).toHaveLength(1);
      expect(p!.classesProgress[0].completed).toBe(false);
    });
    
    it('should delete all by courseId', async () => {
      const classId1 = new Types.ObjectId();
      await classModel.collection.insertOne({ _id: classId1, courseId: cId, name: 'C1', status: 'ACTIVE' });
      await repository.upsert(uId.toString(), cId.toString(), { classId: classId1.toString(), completed: true }, 1);

      await repository.deleteAllByCourseId(cId.toString());
      const p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p).toBeNull();
    });

    it('should remove questionnaire progress', async () => {
      const qId = new Types.ObjectId();
      await qModel.collection.insertOne({ _id: qId, courseId: cId, title: 'Q', status: 'ACTIVE' });
      
      await repository.updateQuestionnaireProgress(uId.toString(), cId.toString(), qId.toString(), 100);
      await repository.removeQuestionnaireProgress(uId.toString(), cId.toString(), qId.toString());
      
      const p = await repository.findByUserAndCourse(uId.toString(), cId.toString());
      expect(p!.questionnairesProgress).toHaveLength(0);
    });
  });
});
