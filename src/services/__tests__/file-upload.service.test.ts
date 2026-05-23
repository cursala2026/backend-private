import { fileUploadService } from '../file-upload.service';
import fs from 'fs';
import { logger } from '@/utils';
import { assembledFilesMap } from '../upload.config';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('FileUploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assembledFilesMap.clear();
  });

  describe('deleteFile', () => {
    it('should delete file if it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const result = fileUploadService.deleteFile('/test/dir', 'file.txt');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const result = fileUploadService.deleteFile('/test/dir', 'file.txt');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false and log error on exception', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('FS Error');
      });
      const result = fileUploadService.deleteFile('/test/dir', 'file.txt');
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanupChunks', () => {
    it('should do nothing if chunks dir does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const result = fileUploadService.cleanupChunks('upload123');
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it('should delete matching chunks', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['upload123_chunk_0', 'upload123_chunk_1', 'other_file.txt']);
      
      const result = fileUploadService.cleanupChunks('upload123');
      
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.deletedFiles).toEqual(['upload123_chunk_0', 'upload123_chunk_1']);
    });
  });

  describe('cleanupAssembledFilesMappings', () => {
    it('should remove ids from assembledFilesMap', () => {
      assembledFilesMap.set('id1', 'file1.mp4');
      assembledFilesMap.set('id2', 'file2.mp4');

      fileUploadService.cleanupAssembledFilesMappings(['id1', 'id2', 'id3']);
      
      expect(assembledFilesMap.has('id1')).toBe(false);
      expect(assembledFilesMap.has('id2')).toBe(false);
    });
  });

  describe('findAssembledFile', () => {
    it('should return mapped file if exists in fs', () => {
      assembledFilesMap.set('upload123', 'assembled.mp4');
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = fileUploadService.findAssembledFile('upload123', '/dir');
      expect(result).toBe('assembled.mp4');
    });

    it('should delete from map and fallback if not in fs', () => {
      assembledFilesMap.set('upload123', 'assembled.mp4');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.readdirSync as jest.Mock).mockReturnValue(['upload123-fallback.mp4']);

      const result = fileUploadService.findAssembledFile('upload123', '/dir');
      
      expect(assembledFilesMap.has('upload123')).toBe(false);
      expect(result).toBe('upload123-fallback.mp4');
    });

    it('should return null if no mapped and no fallback', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(['other.mp4']);
      const result = fileUploadService.findAssembledFile('upload123', '/dir');
      expect(result).toBeNull();
    });
  });

  describe('resolveClassFiles', () => {
    it('should resolve normal files', () => {
      const files = {
        imageFile: [{ filename: 'img.jpg' } as any],
        videoFile: [{ filename: 'vid.mp4' } as any],
        supportMaterials: [{ filename: 'doc.pdf' } as any]
      };

      const result = fileUploadService.resolveClassFiles(files, undefined, undefined, undefined);
      
      expect(result.imageUrl).toBe('img.jpg');
      expect(result.videoUrl).toBe('vid.mp4');
      expect(result.supportMaterials).toEqual(['doc.pdf']);
    });

    it('should resolve chunk ids and URLs', () => {
      assembledFilesMap.set('chunk-img', 'assembled-img.jpg');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const result = fileUploadService.resolveClassFiles(
        undefined, 
        'chunk-img', 
        undefined, 
        ['https://b-cdn.net/file.pdf']
      );

      expect(result.imageUrl).toBe('assembled-img.jpg');
      expect(result.supportMaterials).toEqual(['https://b-cdn.net/file.pdf']);
      expect(result.uploadIdsToClean).toContain('chunk-img');
    });
  });
});
