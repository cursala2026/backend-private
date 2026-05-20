import QuestionnaireService from '@/services/questionnaire.service';

describe('QuestionnaireService - update()', () => {
  let questionnaireRepo: any;
  let submissionRepo: any;
  let svc: QuestionnaireService;

  beforeEach(() => {
    questionnaireRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    submissionRepo = {
      hasSubmissions: jest.fn(),
    };

    svc = new QuestionnaireService(questionnaireRepo, submissionRepo);
  });

  it('should throw when questionnaire not found', async () => {
    questionnaireRepo.findById.mockResolvedValue(null);

    await expect(svc.update('nonexistent-id', {} as any)).rejects.toThrow('Questionnaire not found');
  });

  it('should allow update when no submissions and return updated questionnaire', async () => {
    const existing = { _id: 'q1', questions: [], courseId: 'c1', isSurvey: false } as any;
    const updated = { ...existing, title: 'new' } as any;

    questionnaireRepo.findById.mockResolvedValue(existing);
    submissionRepo.hasSubmissions.mockResolvedValue(false);
    questionnaireRepo.update.mockResolvedValue(updated);

    const res = await svc.update('q1', { title: 'new' } as any);
    expect(res).toBe(updated);
    expect(questionnaireRepo.update).toHaveBeenCalledWith('q1', { title: 'new' });
  });

  it('should reject changes to questions when submissions exist and changes not allowed', async () => {
    const existing = { _id: 'q1', questions: [{ type: 'MULTIPLE_CHOICE', options: [{ _id: 'o1' }] }], courseId: 'c1', isSurvey: false } as any;
    questionnaireRepo.findById.mockResolvedValue(existing);
    submissionRepo.hasSubmissions.mockResolvedValue(true);

    const newData = { questions: [{ type: 'TEXT', options: [] }] } as any; // different type -> not allowed

    await expect(svc.update('q1', newData)).rejects.toMatchObject({ status: 400 });
  });

  it('should throw unexpected errors as-is (500)', async () => {
    questionnaireRepo.findById.mockImplementation(() => { throw new Error('db failure'); });

    await expect(svc.update('q1', {} as any)).rejects.toThrow('db failure');
  });
});
