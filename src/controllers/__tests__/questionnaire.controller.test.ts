import { Request, Response, NextFunction } from 'express';
import QuestionnaireController from '../questionnaire.controller';
import QuestionnaireService from '@/services/questionnaire.service';
import CourseService from '@/services/course.service';

jest.mock('@/services/questionnaire.service');
jest.mock('@/services/course.service');

describe('QuestionnaireController', () => {
  let controller: QuestionnaireController;
  let mockQuestionnaireService: jest.Mocked<QuestionnaireService>;
  let mockCourseService: jest.Mocked<CourseService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockQuestionnaireService = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findByCourseId: jest.fn(),
      findByProfessorId: jest.fn(),
    } as any;

    mockCourseService = {
      rebuildOrderedContentForCourse: jest.fn(),
    } as any;

    controller = new QuestionnaireController(mockQuestionnaireService, mockCourseService);

    mockRequest = {
      params: {},
      body: {},
      user: { _id: 'user1' } as any,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe('update', () => {
    it('should preserve _id and id fields for questions when updating a questionnaire', async () => {
      const qId = '12345';
      const questionId = 'q-123';
      const question_Id = '605c72a8b941234567890123';

      mockRequest.params = { id: qId };
      mockRequest.body = {
        title: 'Updated Title',
        questions: [
          {
            _id: question_Id,
            id: questionId,
            type: 'MULTIPLE_CHOICE',
            questionText: 'What is 2+2?',
            options: [],
            points: 10,
            shouldNotBeIncluded: 'Remove this field'
          }
        ]
      };

      mockQuestionnaireService.update.mockResolvedValue({
        _id: qId,
        courseId: 'course1',
        title: 'Updated Title',
        questions: []
      } as any);

      await controller.update(mockRequest as Request, mockResponse as Response, nextFunction);

      // Extract the updateData payload passed to the service
      expect(mockQuestionnaireService.update).toHaveBeenCalled();
      const updatePayload = mockQuestionnaireService.update.mock.calls[0][1];

      // Ensure that _id and id are retained
      expect(updatePayload.questions![0]._id).toBe(question_Id);
      expect((updatePayload.questions![0] as any).id).toBe(questionId);
      
      // Ensure other fields are kept, but non-allowed ones are stripped
      expect(updatePayload.questions![0].type).toBe('MULTIPLE_CHOICE');
      expect(updatePayload.questions![0].points).toBe(10);
      expect((updatePayload.questions![0] as any).shouldNotBeIncluded).toBeUndefined();
    });
  });
});
