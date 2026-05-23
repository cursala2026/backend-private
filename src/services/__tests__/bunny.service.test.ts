import BunnyService from '../bunny.service';
import axios from 'axios';
import { logger } from '@/utils';
import config from '@/config';
import { Readable } from 'stream';

jest.mock('axios');
jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('BunnyService', () => {
  let bunnyService: BunnyService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set config values
    config.BUNNY_STORAGE_API_KEY = 'test-storage-key';
    config.BUNNY_STORAGE_ZONE_NAME = 'test-zone';
    config.BUNNY_STORAGE_REGION = 'br';
    config.BUNNY_STORAGE_CDN_HOSTNAME = 'https://test-cdn.b-cdn.net';
    config.BUNNY_STREAM_API_KEY = 'test-stream-key';
    config.BUNNY_STREAM_LIBRARY_ID = '12345';

    // The singleton might cache old configs, so we reset it
    (BunnyService as any).instance = null;
    bunnyService = BunnyService.getInstance();
  });

  describe('uploadFile', () => {
    it('should upload a buffer and return the CDN url', async () => {
      (axios.put as jest.Mock).mockResolvedValue({ status: 201 });
      const buffer = Buffer.from('test data');
      
      const result = await bunnyService.uploadFile(buffer, 'test.jpg', 'images');
      
      expect(axios.put).toHaveBeenCalledWith(
        'https://br.storage.bunnycdn.com/test-zone/images/test.jpg',
        buffer,
        expect.objectContaining({
          headers: expect.objectContaining({ 'AccessKey': 'test-storage-key' })
        })
      );
      expect(result).toBe('https://test-cdn.b-cdn.net/images/test.jpg');
    });

    it('should throw error if upload fails', async () => {
      (axios.put as jest.Mock).mockResolvedValue({ status: 500 });
      const buffer = Buffer.from('test data');
      
      await expect(bunnyService.uploadFile(buffer, 'test.jpg', 'images'))
        .rejects.toThrow('Bunny upload failed with status: 500');
    });

    it('should handle network error in upload', async () => {
      (axios.put as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const buffer = Buffer.from('test data');
      await expect(bunnyService.uploadFile(buffer, 'test.jpg', 'images'))
        .rejects.toThrow('Network Error');
    });
  });

  describe('uploadFilePreserveOriginal', () => {
    it('should upload with a timestamp appended to base name', async () => {
      (axios.put as jest.Mock).mockResolvedValue({ status: 201 });
      const buffer = Buffer.from('test');
      
      // Mock Date.now to have predictable timestamp
      jest.spyOn(Date, 'now').mockReturnValue(1600000000000);

      const result = await bunnyService.uploadFilePreserveOriginal(buffer, 'test file.png', 'docs');
      
      expect(result).toBe('https://test-cdn.b-cdn.net/docs/test_file_1600000000000.png');
      
      jest.restoreAllMocks();
    });

    it('should handle network error in uploadFilePreserveOriginal', async () => {
      (axios.put as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const buffer = Buffer.from('test');
      await expect(bunnyService.uploadFilePreserveOriginal(buffer, 'test.png', 'docs'))
        .rejects.toThrow('Network Error');
    });
  });

  describe('uploadFileStream', () => {
    it('should upload stream and track progress', async () => {
      let capturedOnProgress: any;
      (axios.put as jest.Mock).mockImplementation((url, stream, config) => {
        capturedOnProgress = config.onUploadProgress;
        return Promise.resolve({ status: 201 });
      });

      const stream = new Readable({ read() {} });
      const onProgress = jest.fn();

      const result = await bunnyService.uploadFileStream(stream, 'video.mp4', 'videos', 1000, onProgress);
      
      // simulate axios progress event
      if (capturedOnProgress) {
        capturedOnProgress({ loaded: 500, total: 1000 });
        capturedOnProgress({ loaded: 1000, total: 1000 });
      }

      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(100);
      expect(result).toBe('https://test-cdn.b-cdn.net/videos/video.mp4');
    });

    it('should handle network error in stream upload', async () => {
      (axios.put as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const stream = new Readable({ read() {} });
      await expect(bunnyService.uploadFileStream(stream, 'video.mp4', 'videos'))
        .rejects.toThrow('Network Error');
    });

    it('should throw error if response status is not 200/201', async () => {
      (axios.put as jest.Mock).mockResolvedValue({ status: 500 });
      const stream = new Readable({ read() {} });
      await expect(bunnyService.uploadFileStream(stream, 'video.mp4', 'videos'))
        .rejects.toThrow('Bunny upload failed with status: 500');
    });
  });

  describe('deleteFile', () => {
    it('should extract path and delete file from CDN', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ status: 200 });
      
      const result = await bunnyService.deleteFile('https://test-cdn.b-cdn.net/folder/file.jpg');
      
      expect(axios.delete).toHaveBeenCalledWith(
        'https://br.storage.bunnycdn.com/test-zone/folder/file.jpg',
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('should return true if file returns 404', async () => {
      (axios.delete as jest.Mock).mockRejectedValue({ response: { status: 404 } });
      
      const result = await bunnyService.deleteFile('/folder/file.jpg');
      
      expect(result).toBe(true);
    });

    it('should return false on other errors', async () => {
      (axios.delete as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await bunnyService.deleteFile('/folder/file.jpg');
      
      expect(result).toBe(false);
    });

    it('should handle invalid URL and fallback', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ status: 200 });
      const result = await bunnyService.deleteFile('not-a-valid-url');
      expect(result).toBe(true);
      expect(axios.delete).toHaveBeenCalledWith(
        'https://br.storage.bunnycdn.com/test-zone/not-a-valid-url',
        expect.any(Object)
      );
    });
  });

  describe('downloadFile', () => {
    it('should download file and return buffer', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ status: 200, data: Buffer.from('downloaded') });
      
      const result = await bunnyService.downloadFile('https://test-cdn.b-cdn.net/file.jpg');
      
      expect(axios.get).toHaveBeenCalledWith('https://test-cdn.b-cdn.net/file.jpg', expect.any(Object));
      expect(result).toBeInstanceOf(Buffer);
      expect(result?.toString()).toBe('downloaded');
    });

    it('should return null on error', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await bunnyService.downloadFile('https://test-cdn.b-cdn.net/file.jpg');
      
      expect(result).toBeNull();
    });
  });

  describe('uploadVideoToStream', () => {
    it('should create and upload a video to Stream', async () => {
      // Mock step 1: post to create video
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: { guid: 'vid123', videoLibraryId: '12345' }
      });
      // Mock step 2: put to upload stream
      (axios.put as jest.Mock).mockResolvedValue({ status: 201 });
      // Mock step 3: get video details
      (axios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const stream = new Readable({ read() {} });
      const result = await bunnyService.uploadVideoToStream(stream, 'my-video.mp4', 100);

      expect(axios.post).toHaveBeenCalledWith(
        'https://video.bunnycdn.com/library/12345/videos',
        { title: 'my-video' },
        expect.any(Object)
      );
      
      expect(axios.put).toHaveBeenCalledWith(
        'https://video.bunnycdn.com/library/12345/videos/vid123',
        stream,
        expect.any(Object)
      );

      expect(result).toBe('https://vz-12345.b-cdn.net/vid123');
    });

    it('should throw if keys are missing', async () => {
      config.BUNNY_STREAM_API_KEY = '';
      (BunnyService as any).instance = null;
      bunnyService = BunnyService.getInstance();
      const stream = new Readable({ read() {} });
      await expect(bunnyService.uploadVideoToStream(stream, 'my-video.mp4', 100))
        .rejects.toThrow('Bunny Stream API Key o Library ID no están configurados');
    });

    it('should throw if create video fails', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 500 });
      const stream = new Readable({ read() {} });
      await expect(bunnyService.uploadVideoToStream(stream, 'my-video.mp4', 100))
        .rejects.toThrow('Error creando video en Stream: 500');
    });

    it('should throw if upload stream fails', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        status: 200,
        data: { guid: 'vid123', videoLibraryId: '12345' }
      });
      (axios.put as jest.Mock).mockResolvedValue({ status: 500 });
      const stream = new Readable({ read() {} });
      await expect(bunnyService.uploadVideoToStream(stream, 'my-video.mp4', 100))
        .rejects.toThrow('Error subiendo archivo a Stream: 500');
    });
  });

  describe('deleteVideoFromStream', () => {
    it('should extract videoId and delete from Stream API', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ status: 200 });
      
      const result = await bunnyService.deleteVideoFromStream('https://vz-12345.b-cdn.net/vid123');
      
      expect(axios.delete).toHaveBeenCalledWith(
        'https://video.bunnycdn.com/library/12345/videos/vid123',
        expect.objectContaining({ headers: { 'AccessKey': 'test-stream-key' } })
      );
      expect(result).toBe(true);
    });

    it('should handle iframe embed URLs', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ status: 200 });
      
      const result = await bunnyService.deleteVideoFromStream('https://iframe.mediadelivery.net/embed/12345/vid123');
      
      expect(axios.delete).toHaveBeenCalledWith(
        'https://video.bunnycdn.com/library/12345/videos/vid123',
        expect.any(Object)
      );
      expect(result).toBe(true);
    });

    it('should return false if stream API keys are missing', async () => {
      config.BUNNY_STREAM_API_KEY = '';
      (BunnyService as any).instance = null;
      bunnyService = BunnyService.getInstance();
      const result = await bunnyService.deleteVideoFromStream('https://vz-12345.b-cdn.net/vid123');
      expect(result).toBe(false);
    });

    it('should return false if invalid url', async () => {
      const result = await bunnyService.deleteVideoFromStream('invalid-url');
      expect(result).toBe(false);
    });

    it('should return false if delete returns 500', async () => {
      (axios.delete as jest.Mock).mockResolvedValue({ status: 500 });
      const result = await bunnyService.deleteVideoFromStream('https://vz-12345.b-cdn.net/vid123');
      expect(result).toBe(false);
    });

    it('should handle network error', async () => {
      (axios.delete as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const result = await bunnyService.deleteVideoFromStream('https://vz-12345.b-cdn.net/vid123');
      expect(result).toBe(false);
    });
  });
});
