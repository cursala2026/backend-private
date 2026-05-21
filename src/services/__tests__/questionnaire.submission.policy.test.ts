import QuestionnaireService from '@/services/questionnaire.service';

describe('Questionnaire submission edit policy', () => {
  let mockQuestionnaireRepo: any;
  let mockSubmissionRepo: any;
  let svc: any;

  beforeEach(() => {
    mockQuestionnaireRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockSubmissionRepo = {
      hasSubmissions: jest.fn(),
      deleteByQuestionnaire: jest.fn(),
    };

    svc = new QuestionnaireService(mockQuestionnaireRepo as any, mockSubmissionRepo as any);
  });

  test('allows update when there are no submissions', async () => {
    const id = 'qid1';
    const existing = { _id: id, questions: [], isSurvey: false, courseId: 'c1' } as any;
    const updated = { _id: id, title: 'Updated' } as any;

    mockQuestionnaireRepo.findById.mockResolvedValue(existing);
    mockSubmissionRepo.hasSubmissions.mockResolvedValue(false);
    mockQuestionnaireRepo.update.mockResolvedValue(updated);

    const result = await svc.update(id, { title: 'Updated' });

    expect(mockQuestionnaireRepo.findById).toHaveBeenCalledWith(id);
    expect(mockSubmissionRepo.hasSubmissions).toHaveBeenCalledWith(id);
    expect(result).toBe(updated);
  });

  test('blocks update of questions when at least one submission exists', async () => {
    const id = 'qid2';
    const existing = { _id: id, questions: [{ questionText: 'Q' }], isSurvey: false } as any;

    mockQuestionnaireRepo.findById.mockResolvedValue(existing);
    mockSubmissionRepo.hasSubmissions.mockResolvedValue(true);

    await expect(svc.update(id, { questions: [{ questionText: 'Modified' }] })).rejects.toMatchObject({ status: 400 });

    expect(mockQuestionnaireRepo.findById).toHaveBeenCalledWith(id);
    expect(mockSubmissionRepo.hasSubmissions).toHaveBeenCalledWith(id);
  });

  test('allows update after submissions are deleted (reset)', async () => {
    const id = 'qid3';
    const existing = { _id: id, questions: [{ questionText: 'Q' }], isSurvey: false } as any;
    const updated = { _id: id, title: 'Now editable' } as any;

    mockQuestionnaireRepo.findById.mockResolvedValue(existing);

    // First call: submissions exist -> blocked
    mockSubmissionRepo.hasSubmissions.mockResolvedValueOnce(true);
    await expect(svc.update(id, { questions: [{ questionText: 'Changed' }] })).rejects.toMatchObject({ status: 400 });

    // Simulate admin/profesor resets submissions; afterwards hasSubmissions returns false
    mockSubmissionRepo.hasSubmissions.mockResolvedValueOnce(false);
    mockQuestionnaireRepo.update.mockResolvedValue(updated);

    const res = await svc.update(id, { title: 'Now editable' });
    expect(res).toBe(updated);
  });
});
