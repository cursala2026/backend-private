/* eslint-env jest */
import fs from 'fs';
import path from 'path';
import FileService from '@/services/file.service';

jest.mock('fs');
jest.mock('path');
jest.mock('@/utils/fileSecurity.util', () => ({
  sanitizeImageFileName: jest.fn(),
  sanitizeVideoFileName: jest.fn(),
  sanitizeAnyFileName: jest.fn(),
  isPathInAllowedDirectories: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const { sanitizeImageFileName, sanitizeVideoFileName, sanitizeAnyFileName, isPathInAllowedDirectories } = require('@/utils/fileSecurity.util');
const logger = require('@/utils/logger');

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileService = new FileService();
    // Make path.resolve return deterministic values based on arguments
    mockPath.resolve.mockImplementation((...args: any[]) => {
      const joined = args.join('/');
      const last = args[args.length - 1] || '';
      if (joined.includes('static-remote/images')) return `/app/static-remote/images${last ? '/' + last : ''}`;
      if (joined.includes('static/images')) return `/app/static/images${last ? '/' + last : ''}`;
      if (joined.includes('static-remote/videos')) return `/app/static-remote/videos${last ? '/' + last : ''}`;
      if (joined.includes('static/videos')) return `/app/static/videos${last ? '/' + last : ''}`;
      if (joined.includes('static/supportMaterials')) return `/app/static/supportMaterials${last ? '/' + last : ''}`;
      if (joined.includes('static/filesPublic')) return `/app/static/filesPublic${last ? '/' + last : ''}`;
      return `/${last}`;
    });
  });

  describe('getFileImage', () => {
    test('retrieves image file successfully', async () => {
      const imageFileName = 'test.jpg';
      const requestIP = '127.0.0.1';
      const sanitizedResult = { isValid: true, fileName: 'test.jpg' };
      const allowedDirectories = ['/app/static/images'];
      const filePath = '/app/static/images/test.jpg';
      const fileBuffer = Buffer.from('image data');

      (sanitizeImageFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(fileBuffer);
      // First call returns allowedDirectory, second call returns filePath
      mockPath.resolve.mockReturnValueOnce(allowedDirectories[0]).mockReturnValueOnce(filePath);

      const result = await fileService.getFileImage(imageFileName, requestIP);

      expect(result).toEqual(fileBuffer);
      expect(sanitizeImageFileName).toHaveBeenCalledWith(imageFileName, requestIP);
      expect(isPathInAllowedDirectories).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(allowedDirectories), requestIP);
      expect(mockFs.existsSync).toHaveBeenCalledWith(expect.any(String));
      expect(mockFs.readFileSync).toHaveBeenCalledWith(expect.any(String));
    });

    test('returns null when file does not exist', async () => {
      const imageFileName = 'nonexistent.jpg';
      const sanitizedResult = { isValid: true, fileName: 'nonexistent.jpg' };
      const allowedDirectory = '/app/static/images';
      const filePath = '/app/static/images/nonexistent.jpg';

      (sanitizeImageFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readdirSync.mockReturnValue([]);
      // First call for allowedDirectories, second for filePath, third for directory listing
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath).mockReturnValueOnce(allowedDirectory);

      const result = await fileService.getFileImage(imageFileName);

      expect(result).toBeNull();
    });

    test('throws error for invalid file name', async () => {
      const imageFileName = 'invalid.jpg';
      const sanitizedResult = { isValid: false, reason: 'Invalid characters' };

      (sanitizeImageFileName as jest.Mock).mockReturnValue(sanitizedResult);

      await expect(fileService.getFileImage(imageFileName)).rejects.toThrow('Invalid file name: Invalid characters');
    });

    test('throws error for path traversal attempt', async () => {
      const imageFileName = '../../../etc/passwd';
      const sanitizedResult = { isValid: true, fileName: '../../../etc/passwd' };
      const allowedDirectory = '/app/static/images';
      const filePath = '/app/static/images/../../../etc/passwd';

      (sanitizeImageFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      await expect(fileService.getFileImage(imageFileName)).rejects.toThrow('Access denied: Path traversal attempt detected');
    });

    test('handles error during file reading', async () => {
      const imageFileName = 'test.jpg';
      const sanitizedResult = { isValid: true, fileName: 'test.jpg' };
      const allowedDirectory = '/app/static/images';
      const filePath = '/app/static/images/test.jpg';

      (sanitizeImageFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(fileService.getFileImage(imageFileName)).rejects.toThrow('Error reading file image: Read error');
    });
  });

  describe('getFileVideo', () => {
    test('retrieves video file successfully', async () => {
      const videoFileName = 'test.mp4';
      const requestIP = '127.0.0.1';
      const sanitizedResult = { isValid: true, fileName: 'test.mp4' };
      const allowedDirectory = '/app/static/videos';
      const filePath = '/app/static/videos/test.mp4';
      const fileBuffer = Buffer.from('video data');

      (sanitizeVideoFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(fileBuffer);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getFileVideo(videoFileName, requestIP);

      expect(sanitizeVideoFileName).toHaveBeenCalledWith(videoFileName, requestIP);
      expect(result).toEqual(fileBuffer);
    });

    test('returns null when file does not exist', async () => {
      const videoFileName = 'nonexistent.mp4';
      const sanitizedResult = { isValid: true, fileName: 'nonexistent.mp4' };
      const allowedDirectory = '/app/static/videos';
      const filePath = '/app/static/videos/nonexistent.mp4';

      (sanitizeVideoFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getFileVideo(videoFileName);

      expect(result).toBeNull();
    });

    test('throws error for invalid file name', async () => {
      const videoFileName = 'invalid.mp4';
      const sanitizedResult = { isValid: false, reason: 'Invalid characters' };

      (sanitizeVideoFileName as jest.Mock).mockReturnValue(sanitizedResult);

      await expect(fileService.getFileVideo(videoFileName)).rejects.toThrow('Invalid file name: Invalid characters');
    });

    test('throws error for path traversal attempt', async () => {
      const videoFileName = '../../../etc/passwd';
      const sanitizedResult = { isValid: true, fileName: '../../../etc/passwd' };
      const allowedDirectory = '/app/static/videos';
      const filePath = '/app/static/videos/../../../etc/passwd';

      (sanitizeVideoFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      await expect(fileService.getFileVideo(videoFileName)).rejects.toThrow('Access denied: Path traversal attempt detected');
    });

    test('handles error during file reading', async () => {
      const videoFileName = 'test.mp4';
      const sanitizedResult = { isValid: true, fileName: 'test.mp4' };
      const allowedDirectory = '/app/static/videos';
      const filePath = '/app/static/videos/test.mp4';

      (sanitizeVideoFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(fileService.getFileVideo(videoFileName)).rejects.toThrow('Error reading file video: Read error');
    });
  });

  describe('getFile', () => {
    test('retrieves support material file successfully', async () => {
      const fileName = 'test.pdf';
      const requestIP = '127.0.0.1';
      const sanitizedResult = { isValid: true, fileName: 'test.pdf' };
      const allowedDirectory = '/app/static/supportMaterials';
      const filePath = '/app/static/supportMaterials/test.pdf';
      const fileBuffer = Buffer.from('file data');

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(fileBuffer);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getFile(fileName, requestIP);

      expect(sanitizeAnyFileName).toHaveBeenCalledWith(fileName, requestIP);
      expect(result).toEqual(fileBuffer);
    });

    test('returns null when file does not exist', async () => {
      const fileName = 'nonexistent.pdf';
      const sanitizedResult = { isValid: true, fileName: 'nonexistent.pdf' };
      const allowedDirectory = '/app/static/supportMaterials';
      const filePath = '/app/static/supportMaterials/nonexistent.pdf';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getFile(fileName);

      expect(result).toBeNull();
    });

    test('throws error for invalid file name', async () => {
      const fileName = 'invalid.pdf';
      const sanitizedResult = { isValid: false, reason: 'Invalid characters' };

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);

      await expect(fileService.getFile(fileName)).rejects.toThrow('Invalid file name: Invalid characters');
    });

    test('throws error for path traversal attempt', async () => {
      const fileName = '../../../etc/passwd';
      const sanitizedResult = { isValid: true, fileName: '../../../etc/passwd' };
      const allowedDirectory = '/app/static/supportMaterials';
      const filePath = '/app/static/supportMaterials/../../../etc/passwd';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      await expect(fileService.getFile(fileName)).rejects.toThrow('Access denied: Path traversal attempt detected');
    });

    test('handles error during file reading', async () => {
      const fileName = 'test.pdf';
      const sanitizedResult = { isValid: true, fileName: 'test.pdf' };
      const allowedDirectory = '/app/static/supportMaterials';
      const filePath = '/app/static/supportMaterials/test.pdf';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(fileService.getFile(fileName)).rejects.toThrow('Error reading support material file: Read error');
    });
  });

  describe('getPublicFile', () => {
    test('retrieves public file successfully', async () => {
      const fileName = 'test.txt';
      const requestIP = '127.0.0.1';
      const sanitizedResult = { isValid: true, fileName: 'test.txt' };
      const allowedDirectory = '/app/static/filesPublic';
      const filePath = '/app/static/filesPublic/test.txt';
      const fileBuffer = Buffer.from('file data');

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(fileBuffer);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getPublicFile(fileName, requestIP);

      expect(result).toEqual(fileBuffer);
    });

    test('returns null when file does not exist', async () => {
      const fileName = 'nonexistent.txt';
      const sanitizedResult = { isValid: true, fileName: 'nonexistent.txt' };
      const allowedDirectory = '/app/static/filesPublic';
      const filePath = '/app/static/filesPublic/nonexistent.txt';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      const result = await fileService.getPublicFile(fileName);

      expect(result).toBeNull();
    });

    test('throws error for invalid file name', async () => {
      const fileName = 'invalid.txt';
      const sanitizedResult = { isValid: false, reason: 'Invalid characters' };

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);

      await expect(fileService.getPublicFile(fileName)).rejects.toThrow('Invalid file name: Invalid characters');
    });

    test('throws error for path traversal attempt', async () => {
      const fileName = '../../../etc/passwd';
      const sanitizedResult = { isValid: true, fileName: '../../../etc/passwd' };
      const allowedDirectory = '/app/static/filesPublic';
      const filePath = '/app/static/filesPublic/../../../etc/passwd';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(false);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);

      await expect(fileService.getPublicFile(fileName)).rejects.toThrow('Access denied: Path traversal attempt detected');
    });

    test('handles error during file reading', async () => {
      const fileName = 'test.txt';
      const sanitizedResult = { isValid: true, fileName: 'test.txt' };
      const allowedDirectory = '/app/static/filesPublic';
      const filePath = '/app/static/filesPublic/test.txt';

      (sanitizeAnyFileName as jest.Mock).mockReturnValue(sanitizedResult);
      (isPathInAllowedDirectories as jest.Mock).mockReturnValue(true);
      mockFs.existsSync.mockReturnValue(true);
      mockPath.resolve.mockReturnValueOnce(allowedDirectory).mockReturnValueOnce(filePath);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(fileService.getPublicFile(fileName)).rejects.toThrow('Error reading public file: Read error');
    });
  });
});
