import QuestionnaireController from '../questionnaire.controller';
import fs from 'fs';
import path from 'path';

describe('QuestionnaireController.uploadQuestionMedia', () => {
  const tmpDir = path.join(__dirname, '../../tmp-test');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir, { recursive: true });
    } catch (e) {}
  });

  test('reads uploaded file, calls service and removes temp file', async () => {
    const fakeBuffer = Buffer.from('fake-content');
    const tmpFile = path.join(tmpDir, 'upload-test.mp4');
    fs.writeFileSync(tmpFile, fakeBuffer);

    const mockService: any = {
      updateQuestionMedia: jest.fn().mockResolvedValue({ success: true }),
    };

    const controller = new QuestionnaireController(mockService);

    const req: any = {
      params: { questionnaireId: 'qid', questionId: 'qid1' },
      file: { path: tmpFile, originalname: 'upload-test.mp4', mimetype: 'video/mp4' },
      body: {},
      user: { _id: 'u1', roles: ['PROFESOR'] },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    await controller.uploadQuestionMedia(req, res, next);

    expect(mockService.updateQuestionMedia).toHaveBeenCalledTimes(1);
    const calledWith = mockService.updateQuestionMedia.mock.calls[0];
    expect(calledWith[0]).toBe('qid');
    expect(calledWith[1]).toBe('qid1');
    expect(calledWith[3]).toBe('upload-test.mp4');
    expect(calledWith[4]).toBe('VIDEO');
    // Buffer equals
    expect(Buffer.isBuffer(calledWith[2])).toBe(true);
    expect(fs.existsSync(tmpFile)).toBe(false); // cleaned up
  });
});
