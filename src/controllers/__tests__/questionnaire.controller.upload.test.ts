import QuestionnaireController from '../questionnaire.controller';
import fs from 'fs';
import path from 'path';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn().mockReturnValue(
      new (require('stream').Readable)({
        read() { this.push(null); }
      })
    ),
    readFileSync: jest.fn().mockReturnValue(Buffer.from('fake')),
    existsSync: jest.fn().mockReturnValue(false),
    unlinkSync: jest.fn(),
  };
});

describe('QuestionnaireController.uploadQuestionMedia', () => {
  const tmpDir = path.join(__dirname, '../../tmp-test');
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir, { recursive: true });
    } catch (e) {}
  });

  test('marks question as processing and returns 202 immediately', async () => {
    const fakeBuffer = Buffer.from('fake-content');
    const tmpFile = path.join(tmpDir, 'upload-test.mp4');
    fs.writeFileSync(tmpFile, fakeBuffer);

    const mockService: any = {
      updateQuestionUploadStatus: jest.fn().mockResolvedValue({}),
      uploadVideoMedia: jest.fn().mockResolvedValue('https://cdn.example.com/video.mp4'),
      uploadImageMedia: jest.fn().mockResolvedValue('https://cdn.example.com/image.jpg'),
    };

    // Mock questionMediaUploadProgressService
    jest.mock('@/services/question-media-upload-progress.service', () => ({
      default: {
        startTracking: jest.fn(),
        updateProgress: jest.fn(),
        finishTracking: jest.fn(),
        setError: jest.fn(),
      },
    }));

    const controller = new QuestionnaireController(mockService);

    const req: any = {
      params: { questionnaireId: 'qid', questionId: 'qid1' },
      file: { path: tmpFile, originalname: 'upload-test.mp4', mimetype: 'video/mp4', size: 100 },
      body: {},
      user: { _id: 'u1', roles: ['PROFESOR'] },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    await controller.uploadQuestionMedia(req, res, next);

    // Verifica que marcó como "processing" antes de responder
    expect(mockService.updateQuestionUploadStatus).toHaveBeenCalledWith(
      'qid',
      'qid1',
      expect.objectContaining({
        mediaUploadStatus: 'processing',
        mediaOriginalName: 'upload-test.mp4',
        promptType: 'VIDEO',
      })
    );

    // Verifica que respondió 202 inmediatamente (sin esperar el upload)
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 202,
      })
    );

    // Verifica que no llamó a métodos inexistentes
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 if no file uploaded', async () => {
    const mockService: any = {
      updateQuestionUploadStatus: jest.fn(),
    };

    const controller = new QuestionnaireController(mockService);

    const req: any = {
      params: { questionnaireId: 'qid', questionId: 'qid1' },
      file: undefined,
      body: {},
      user: { _id: 'u1', roles: ['PROFESOR'] },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const next = jest.fn();

    await controller.uploadQuestionMedia(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockService.updateQuestionUploadStatus).not.toHaveBeenCalled();
  });

  test('returns 401 if no user', async () => {
    const mockService: any = {};
    const controller = new QuestionnaireController(mockService);

    const req: any = {
      params: { questionnaireId: 'qid', questionId: 'qid1' },
      file: { path: '/tmp/test.mp4', originalname: 'test.mp4', mimetype: 'video/mp4' },
      body: {},
      user: undefined,
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.uploadQuestionMedia(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });
});