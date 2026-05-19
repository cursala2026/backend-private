import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';
import QuestionnaireService from '../questionnaire.service';

describe('QuestionnaireService', () => {
  let questionnaireService: QuestionnaireService;
  let mockQuestionnaireRepository: any;
  let mockSubmissionRepository: any;

  beforeEach(() => {
    mockQuestionnaireRepository = {
      findById: jest.fn(),
    };

    mockSubmissionRepository = {
      getBestSubmission: jest.fn(),
    };

    questionnaireService = new QuestionnaireService(
      mockQuestionnaireRepository as any,
      mockSubmissionRepository as any
    );
  });

  describe('findById', () => {
    const studentId = new Types.ObjectId().toString();
    const qId = new Types.ObjectId().toString();
    const correctOptionId = new Types.ObjectId();

    it('should safely handle missing questions array and hide correct answers for ALUMNO without graded submission', async () => {
      // Un cuestionario con questions undefinido (simulando un dato anómalo de mongo post-toObject)
      const mockQuestionnaire = {
        _id: qId,
        title: 'Test',
        showCorrectAnswers: true,
        toObject: () => ({
          _id: qId,
          title: 'Test',
          showCorrectAnswers: true,
          questions: undefined, // undefined array
        })
      };

      mockQuestionnaireRepository.findById.mockResolvedValue(mockQuestionnaire);
      mockSubmissionRepository.getBestSubmission.mockResolvedValue(null);

      const result = await questionnaireService.findById(qId, studentId, ['ALUMNO']);

      expect(mockQuestionnaireRepository.findById).toHaveBeenCalledWith(qId);
      expect(mockSubmissionRepository.getBestSubmission).toHaveBeenCalledWith(studentId, qId);
      
      // El resultado debe tener questions como array vacío gracias a la protección `|| []`
      expect(result?.questions).toEqual([]);
    });

    it('should remove correctOptionId from populated questions for ALUMNO', async () => {
      const mockQuestionnaire = {
        _id: qId,
        title: 'Test',
        showCorrectAnswers: true,
        toObject: () => ({
          _id: qId,
          title: 'Test',
          showCorrectAnswers: true,
          questions: [
            {
              _id: new Types.ObjectId().toString(),
              type: 'MULTIPLE_CHOICE',
              correctOptionId: correctOptionId,
              correctOptionIds: [correctOptionId]
            }
          ]
        })
      };

      mockQuestionnaireRepository.findById.mockResolvedValue(mockQuestionnaire);
      mockSubmissionRepository.getBestSubmission.mockResolvedValue(null);

      const result = await questionnaireService.findById(qId, studentId, ['ALUMNO']);

      expect(result?.questions[0].correctOptionId).toBeUndefined();
      expect(result?.questions[0].correctOptionIds).toBeUndefined();
    });

    it('should NOT remove correctOptionId for PROFESOR', async () => {
      const mockQuestionnaire = {
        _id: qId,
        title: 'Test',
        showCorrectAnswers: true,
        toObject: () => ({
          _id: qId,
          title: 'Test',
          showCorrectAnswers: true,
          questions: [
            {
              _id: new Types.ObjectId().toString(),
              type: 'MULTIPLE_CHOICE',
              correctOptionId: correctOptionId,
              correctOptionIds: [correctOptionId]
            }
          ]
        })
      };

      mockQuestionnaireRepository.findById.mockResolvedValue(mockQuestionnaire);

      // Si el usuario es profesor, ignora el borrado
      const result = await questionnaireService.findById(qId, studentId, ['PROFESOR']);

      // the document is returned as is (not the toObject clone if skipped)
      // Wait, if it skips the block, it just returns `mockQuestionnaire` directly.
      expect(result).toBe(mockQuestionnaire);
    });
  });

  describe('update', () => {
    it('should allow adding a new question to a questionnaire that has submissions', async () => {
      const qId = new Types.ObjectId().toString();
      const existingOptId = new Types.ObjectId().toString();
      const existingQuestion = {
        _id: new Types.ObjectId().toString(),
        type: 'MULTIPLE_CHOICE',
        questionText: 'Q1',
        points: 10,
        required: true,
        order: 1,
        options: [
          { _id: existingOptId, text: 'O1', order: 1 },
          { _id: new Types.ObjectId().toString(), text: 'O2', order: 2 }
        ],
        correctOptionId: new Types.ObjectId(existingOptId)
      };

      const existingQuestionnaire = {
        _id: qId,
        title: 'Test',
        questions: [existingQuestion],
      };

      // Mock the findById to return the existing questionnaire
      mockQuestionnaireRepository.findById.mockResolvedValue(existingQuestionnaire);
      // Simulate that there are submissions
      mockSubmissionRepository.hasSubmissions = (jest.fn() as any).mockResolvedValue(true);

      const updateData = {
        questions: [
          existingQuestion, // Existing question unchanged
          { // New question
            type: 'MULTIPLE_CHOICE',
            questionText: 'Q2 (New)',
            points: 10,
            required: true,
            order: 2,
            options: [
              { text: 'NewO1', order: 1 },
              { text: 'NewO2', order: 2 }
            ],
            // Passed as an index instead of ObjectId (as frontend might do)
            correctOptionId: 1 as any 
          } as any
        ]
      };

      const savedQuestionnaire = {
        _id: qId,
        title: 'Test',
        questions: updateData.questions,
        save: (jest.fn() as any).mockResolvedValue(true)
      };

      mockQuestionnaireRepository.update = (jest.fn() as any).mockResolvedValue(savedQuestionnaire);
      
      // Mocks for course service rebuild (dynamic import inside service)
      jest.mock('../index', () => ({
        courseService: { rebuildOrderedContentForCourse: jest.fn() }
      }), { virtual: true });

      const result = await questionnaireService.update(qId, updateData);

      // Verify that areQuestionChangesAllowed let the update pass without throwing
      expect(mockQuestionnaireRepository.update).toHaveBeenCalled();
      expect(result).toBeDefined();
      
      // Verify that the numeric index for correctOptionId was safely processed
      // The update logic temporarily stores indices in correctOptionIndices, then updates them
      // after save. We just verify the flow didn't crash.
      expect(savedQuestionnaire.save).toHaveBeenCalled();
    });
  });
});
