import QuestionMediaService from '../questionMedia.service';
import BunnyService from '../bunny.service';
import { Readable } from 'stream';

// Mock BunnyService
jest.mock('../bunny.service', () => {
  return {
    getInstance: jest.fn(),
  };
});

describe('QuestionMediaService', () => {
  let questionMediaService: QuestionMediaService;
  let mockBunnyService: jest.Mocked<BunnyService>;

  beforeEach(() => {
    mockBunnyService = {
      uploadFilePreserveOriginal: jest.fn(),
      generateUniqueFileName: jest.fn(),
      uploadFileStream: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    (BunnyService.getInstance as jest.Mock).mockReturnValue(mockBunnyService);

    questionMediaService = new QuestionMediaService();
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload image to question-images folder', async () => {
      const mockUrl = 'https://cdn.example.com/question-images/test.jpg';
      const mockBuffer = Buffer.from('test');
      mockBunnyService.uploadFilePreserveOriginal.mockResolvedValue(mockUrl);

      const result = await questionMediaService.uploadImage(mockBuffer, 'test.jpg');

      expect(mockBunnyService.uploadFilePreserveOriginal).toHaveBeenCalledWith(mockBuffer, 'test.jpg', 'question-images');
      expect(result).toBe(mockUrl);
    });
  });

  describe('uploadVideo', () => {
    it('should upload video to question-videos folder', async () => {
      const mockUrl = 'https://cdn.example.com/question-videos/test.mp4';
      const mockBuffer = Buffer.from('test');
      mockBunnyService.uploadFilePreserveOriginal.mockResolvedValue(mockUrl);

      const result = await questionMediaService.uploadVideo(mockBuffer, 'test.mp4');

      expect(mockBunnyService.uploadFilePreserveOriginal).toHaveBeenCalledWith(mockBuffer, 'test.mp4', 'question-videos');
      expect(result).toBe(mockUrl);
    });
  });

  describe('uploadVideoStream', () => {
    it('should upload video using stream and generate unique filename', async () => {
      const mockUrl = 'https://cdn.example.com/question-videos/unique-test.mp4';
      const mockStream = new Readable();
      const mockProgress = jest.fn();
      
      mockBunnyService.generateUniqueFileName.mockReturnValue('unique-test.mp4');
      mockBunnyService.uploadFileStream.mockResolvedValue(mockUrl);

      const result = await questionMediaService.uploadVideoStream(mockStream, 'test.mp4', 100, mockProgress);

      expect(mockBunnyService.generateUniqueFileName).toHaveBeenCalledWith('test.mp4', 'question-video');
      expect(mockBunnyService.uploadFileStream).toHaveBeenCalledWith(mockStream, 'unique-test.mp4', 'question-videos', 100, mockProgress);
      expect(result).toBe(mockUrl);
    });
  });

  describe('deleteMedia', () => {
    it('should delete media using cdn url', async () => {
      const mockUrl = 'https://cdn.example.com/question-images/test.jpg';
      mockBunnyService.deleteFile.mockResolvedValue(true);

      const result = await questionMediaService.deleteMedia(mockUrl);

      expect(mockBunnyService.deleteFile).toHaveBeenCalledWith(mockUrl);
      expect(result).toBe(true);
    });
  });
});
