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
});
