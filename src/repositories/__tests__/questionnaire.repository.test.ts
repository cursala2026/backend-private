import QuestionnaireRepository from '../questionnaire.repository';

describe('QuestionnaireRepository.updateQuestion', () => {
  test('calls findOneAndUpdate with correct filter and set object', async () => {
    const mockFindOneAndUpdateExec = jest.fn().mockResolvedValue({ _id: 'q1' });
    const mockFindOneAndUpdate = jest.fn().mockReturnValue({ exec: mockFindOneAndUpdateExec });
    const mockModel = { findOneAndUpdate: mockFindOneAndUpdate } as any;
    const mockConnection = { model: jest.fn().mockReturnValue(mockModel) } as any;

    const repo = new QuestionnaireRepository(mockConnection);

    const questionnaireId = '0123456789abcdef01234567';
    const questionId = 'fedcba987654321001234567';

    const partial = { promptMediaUrl: 'https://cdn.example/media.jpg', promptType: 'IMAGE' } as any;

    const updated = await repo.updateQuestion(questionnaireId, questionId, partial);

    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const expectedSet: any = {};
    expectedSet['questions.$.promptMediaUrl'] = partial.promptMediaUrl;
    expectedSet['questions.$.promptType'] = partial.promptType;

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: questionnaireId, 'questions._id': questionId },
      { $set: expectedSet },
      { new: true }
    );

    expect(updated).toEqual({ _id: 'q1' });
  });
});
