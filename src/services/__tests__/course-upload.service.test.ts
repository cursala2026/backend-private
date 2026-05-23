import { CourseUploadService, courseUploadFiles } from '../course-upload.service';
import BunnyService from '../bunny.service';
import { logger } from '@/utils';

jest.mock('../bunny.service', () => {
  return {
    getInstance: jest.fn(),
  };
});

jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CourseUploadService', () => {
  let courseUploadService: CourseUploadService;
  let mockBunnyService: jest.Mocked<BunnyService>;

  beforeEach(() => {
    mockBunnyService = {
      uploadFilePreserveOriginal: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    (BunnyService.getInstance as jest.Mock).mockReturnValue(mockBunnyService);
    
    courseUploadService = new CourseUploadService();
    jest.clearAllMocks();
  });

  describe('uploadCourseImage', () => {
    it('should upload image to course-images folder', async () => {
      const mockFile = {
        buffer: Buffer.from('test image'),
        originalname: 'course.jpg',
      } as Express.Multer.File;
      const expectedUrl = 'https://b-cdn.net/course-images/course.jpg';
      
      mockBunnyService.uploadFilePreserveOriginal.mockResolvedValue(expectedUrl);

      const result = await courseUploadService.uploadCourseImage(mockFile);

      expect(mockBunnyService.uploadFilePreserveOriginal).toHaveBeenCalledWith(mockFile.buffer, 'course.jpg', 'course-images');
      expect(logger.debug).toHaveBeenCalledWith(`✅ Course image uploaded to Bunny CDN: ${expectedUrl}`);
      expect(result).toBe(expectedUrl);
    });
  });

  describe('deleteCourseImage', () => {
    it('should delete image from bunny CDN if url contains bunnycdn', async () => {
      const url = 'https://my-bunnycdn-url.com/image.jpg';
      mockBunnyService.deleteFile.mockResolvedValue(true);

      const result = await courseUploadService.deleteCourseImage(url);

      expect(mockBunnyService.deleteFile).toHaveBeenCalledWith(url);
      expect(logger.debug).toHaveBeenCalledWith(`✅ Course image deleted from Bunny CDN: ${url}`);
      expect(result).toBe(true);
    });

    it('should delete image from bunny CDN if url contains b-cdn.net', async () => {
      const url = 'https://my-b-cdn.net/image.jpg';
      mockBunnyService.deleteFile.mockResolvedValue(true);

      const result = await courseUploadService.deleteCourseImage(url);

      expect(mockBunnyService.deleteFile).toHaveBeenCalledWith(url);
      expect(result).toBe(true);
    });

    it('should not delete and return true if legacy local filesystem url', async () => {
      const url = '/static/local/image.jpg';
      
      const result = await courseUploadService.deleteCourseImage(url);

      expect(mockBunnyService.deleteFile).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(`ℹ️ Legacy image not deleted (local filesystem): ${url}`);
      expect(result).toBe(true);
    });

    it('should return false if deleteFile throws', async () => {
      const url = 'https://b-cdn.net/image.jpg';
      mockBunnyService.deleteFile.mockRejectedValue(new Error('CDN error'));

      const result = await courseUploadService.deleteCourseImage(url);

      expect(logger.error).toHaveBeenCalledWith('Error deleting course image: CDN error');
      expect(result).toBe(false);
    });
  });

  describe('uploadProgramFile', () => {
    it('should upload program file to course-programs', async () => {
      const buffer = Buffer.from('pdf content');
      const expectedUrl = 'https://b-cdn.net/course-programs/prog.pdf';
      mockBunnyService.uploadFilePreserveOriginal.mockResolvedValue(expectedUrl);

      const result = await courseUploadService.uploadProgramFile(buffer, 'prog.pdf', 'course-programs');

      expect(mockBunnyService.uploadFilePreserveOriginal).toHaveBeenCalledWith(buffer, 'prog.pdf', 'course-programs');
      expect(result).toBe(expectedUrl);
    });

    it('should throw if upload fails', async () => {
      mockBunnyService.uploadFilePreserveOriginal.mockRejectedValue(new Error('Upload failed'));

      await expect(courseUploadService.uploadProgramFile(Buffer.from(''), 'x.pdf', 'folder'))
        .rejects.toThrow('Upload failed');
        
      expect(logger.error).toHaveBeenCalledWith('Error uploading program file: Upload failed');
    });
  });

  describe('deleteProgramFile', () => {
    it('should delete program file from CDN', async () => {
      const url = 'https://b-cdn.net/prog.pdf';
      mockBunnyService.deleteFile.mockResolvedValue(true);

      const result = await courseUploadService.deleteProgramFile(url);

      expect(mockBunnyService.deleteFile).toHaveBeenCalledWith(url);
      expect(logger.debug).toHaveBeenCalledWith(`✅ Program file deleted from Bunny CDN: ${url}`);
      expect(result).toBe(true);
    });

    it('should warn if program file not found on CDN', async () => {
      const url = 'https://b-cdn.net/prog.pdf';
      mockBunnyService.deleteFile.mockResolvedValue(false);

      const result = await courseUploadService.deleteProgramFile(url);

      expect(logger.warn).toHaveBeenCalledWith(`⚠️ Program file not found or failed to delete from Bunny CDN: ${url}`);
      expect(result).toBe(false);
    });

    it('should return false and warn if not a CDN url', async () => {
      const url = '/local/prog.pdf';

      const result = await courseUploadService.deleteProgramFile(url);

      expect(mockBunnyService.deleteFile).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(`⚠️ Program file URL is not from Bunny CDN: ${url}`);
      expect(result).toBe(false);
    });
  });
});

describe('courseUploadFiles multer config', () => {
  it('should accept valid images', () => {
    const fileFilter = (courseUploadFiles as any).fileFilter;
    const cb = jest.fn();
    
    fileFilter(null, { fieldname: 'imageFile', mimetype: 'image/jpeg' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
    
    fileFilter(null, { fieldname: 'imageFile', mimetype: 'image/webp' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('should reject invalid mimetypes', () => {
    const fileFilter = (courseUploadFiles as any).fileFilter;
    const cb = jest.fn();
    
    fileFilter(null, { fieldname: 'imageFile', mimetype: 'application/pdf' }, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
    expect(cb.mock.calls[0][0].message).toBe('Tipo de archivo no permitido. Solo imágenes.');
  });

  it('should reject invalid fieldnames', () => {
    const fileFilter = (courseUploadFiles as any).fileFilter;
    const cb = jest.fn();
    
    fileFilter(null, { fieldname: 'otherField', mimetype: 'image/jpeg' }, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
    expect(cb.mock.calls[0][0].message).toBe('Campo de archivo no reconocido.');
  });
});
