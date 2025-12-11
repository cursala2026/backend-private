/* eslint-env jest */
import path from 'path';
import {
  sanitizeFileName,
  sanitizeImageFileName,
  sanitizeVideoFileName,
  isPathInAllowedDirectories,
  ALLOWED_EXTENSIONS,
} from '../fileSecurity.util';

describe('FileSecurity Utils - Enhanced Tests', () => {
  describe('sanitizeFileName with special characters', () => {
    test('should accept filenames with spaces', () => {
      const result = sanitizeImageFileName('my image file.png');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('my image file.png');
    });

    test('should accept filenames with parentheses', () => {
      const result = sanitizeImageFileName('image (1).png');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('image (1).png');
    });

    test('should accept filenames with brackets', () => {
      const result = sanitizeImageFileName('image[1756872855793-377258703].jpg');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('image[1756872855793-377258703].jpg');
    });

    test('should accept filenames with commas', () => {
      const result = sanitizeImageFileName('ChatGPT Image Sep 20, 2025, 06_47_58 AM.png');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('ChatGPT Image Sep 20, 2025, 06_47_58 AM.png');
    });

    test('should accept complex real-world filename', () => {
      const result = sanitizeImageFileName(
        'retrato-de-un-ingeniero-masculino-trabajando-en-el-campo-para-la-celebracion-del-dia-de-los-ingenieros (1)[1756872855793-377258703].jpg'
      );
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe(
        'retrato-de-un-ingeniero-masculino-trabajando-en-el-campo-para-la-celebracion-del-dia-de-los-ingenieros (1)[1756872855793-377258703].jpg'
      );
    });

    test('should accept underscores and hyphens', () => {
      const result = sanitizeImageFileName('file_name-with-special_chars.png');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('file_name-with-special_chars.png');
    });

    test('should accept numbers', () => {
      const result = sanitizeImageFileName('image123456.png');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('image123456.png');
    });
  });

  describe('sanitizeFileName - Path Traversal Protection Still Works', () => {
    test('should reject path traversal with ../', () => {
      const result = sanitizeImageFileName('../../../etc/passwd.png');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Path traversal');
    });

    test('should reject absolute paths', () => {
      const result = sanitizeImageFileName('/etc/passwd.png');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Forward slash');
    });

    test('should reject backslashes', () => {
      const result = sanitizeImageFileName('folder\\file.png');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Backslash');
    });

    test('should reject null bytes', () => {
      const result = sanitizeImageFileName('file\x00.png');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Null byte');
    });

    test('should reject dangerous characters', () => {
      const dangerousChars = ['<', '>', '"', '|', '?', '*'];
      dangerousChars.forEach(char => {
        const result = sanitizeImageFileName(`file${char}.png`);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('sanitizeVideoFileName', () => {
    test('should accept video files with spaces', () => {
      const result = sanitizeVideoFileName('my video file.mp4');
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe('my video file.mp4');
    });

    test('should reject non-video extensions', () => {
      const result = sanitizeVideoFileName('video.txt');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Invalid file extension');
    });

    test('should accept all video extensions', () => {
      ALLOWED_EXTENSIONS.VIDEOS.forEach(ext => {
        const result = sanitizeVideoFileName(`video${ext}`);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('isPathInAllowedDirectories', () => {
    test('should allow paths within allowed directories', () => {
      const allowedDirs = [path.resolve('/tmp/allowed')];
      const filePath = path.resolve('/tmp/allowed/file.txt');

      const result = isPathInAllowedDirectories(filePath, allowedDirs);
      expect(result).toBe(true);
    });

    test('should reject paths outside allowed directories', () => {
      const allowedDirs = [path.resolve('/tmp/allowed')];
      const filePath = path.resolve('/tmp/not-allowed/file.txt');

      const result = isPathInAllowedDirectories(filePath, allowedDirs);
      expect(result).toBe(false);
    });

    test('should reject path traversal attempts', () => {
      const allowedDirs = [path.resolve('/tmp/allowed')];
      // Este path.resolve automáticamente resuelve .. así que creamos el path manualmente
      const filePath = '/tmp/allowed/../etc/passwd';

      const result = isPathInAllowedDirectories(filePath, allowedDirs);
      expect(result).toBe(false);
    });
  });

  describe('Real-world filename examples from the error logs', () => {
    const realFilenames = [
      'retrato-de-un-ingeniero-masculino-trabajando-en-el-campo-para-la-celebracion-del-dia-de-los-ingenieros (1)[1756872855793-377258703].jpg',
      'cableado-estructurado[1756872728657-784134686].jpg',
      'min[1756873038742-840667665].jpg',
      'comunicacion-asertiva[1756873112147-708048941].jpg',
      'ChatGPT Image Sep 20, 2025, 06_47_58 AM[1758361741603-775679544].png',
    ];

    test.each(realFilenames)('should accept filename: %s', filename => {
      const result = sanitizeImageFileName(filename);
      expect(result.isValid).toBe(true);
      expect(result.fileName).toBe(filename);
    });
  });
});
