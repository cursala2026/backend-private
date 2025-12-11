
/* eslint-env jest */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { FileMaterialService } from '@/services/fileMaterial.service';
import { fileMaterialRepository } from '@/repositories';
import { FileMaterialType, FileMaterialCategory, IFileMaterial } from '@/models/mongo';
import { UserStatus } from '@/models/enums';
jest.mock('fs');
jest.mock('path');
jest.mock('@/repositories', () => ({
  fileMaterialRepository: {
    existsByName: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findWithPagination: jest.fn(),
    findPublicMaterials: jest.fn(),
    findByUser: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    incrementDownloadCount: jest.fn(),
    getStats: jest.fn(),
  },
}));
jest.mock('@utils/fileUpload.util', () => ({
  uploadDirMaterials: '/app/uploads/materials',
}));
jest.mock('@/utils/logger', () => ({
  warn: jest.fn(),
}));
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockFileMaterialRepository = fileMaterialRepository as jest.Mocked<typeof fileMaterialRepository>;
const logger = require('@/utils/logger');
describe('FileMaterialService', () => {
  let fileMaterialService: FileMaterialService;
  beforeEach(() => {
    jest.clearAllMocks();
    fileMaterialService = new FileMaterialService();
  });
  describe('createFileMaterial', () => {
    test('creates file material successfully', async () => {
      const data = {
        name: 'Test Material',
        description: 'Test description',
        type: FileMaterialType.SUPPORT_DOCUMENT,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: '507f1f77bcf86cd799439011',
        file: {
          filename: 'test.pdf',
          originalname: 'original.pdf',
          size: 1024,
          mimetype: 'application/pdf',
        },
      };
      const createdMaterial: IFileMaterial = {
        _id: new mongoose.Types.ObjectId(),
        fileName: 'test.pdf',
        originalFileName: 'original.pdf',
        fileUrl: '/static/materials/test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: UserStatus.ACTIVE,
        downloadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IFileMaterial;
      mockFileMaterialRepository.existsByName.mockResolvedValue(false);
      mockFileMaterialRepository.create.mockResolvedValue(createdMaterial);
      const result = await fileMaterialService.createFileMaterial(data);
      expect(result).toEqual(createdMaterial);
      expect(mockFileMaterialRepository.existsByName).toHaveBeenCalledWith('Test Material');
      expect(mockFileMaterialRepository.create).toHaveBeenCalled();
    });
    test('throws error when material name already exists', async () => {
      const data = {
        name: 'Existing Material',
        type: FileMaterialType.SUPPORT_DOCUMENT,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: '507f1f77bcf86cd799439011',
        file: { filename: 'test.pdf', originalname: 'original.pdf', size: 1024, mimetype: 'application/pdf' },
      };
      mockFileMaterialRepository.existsByName.mockResolvedValue(true);
      await expect(fileMaterialService.createFileMaterial(data)).rejects.toThrow('Ya existe un material con este nombre');
    });
    test('handles error during creation', async () => {
      const data = {
        name: 'Test',
        type: FileMaterialType.SUPPORT_DOCUMENT,
        category: FileMaterialCategory.PDF,
        isPublic: true,
        uploadedBy: '507f1f77bcf86cd799439011',
        file: { filename: 'test.pdf', originalname: 'original.pdf', size: 1024, mimetype: 'application/pdf' },
      };
      mockFileMaterialRepository.existsByName.mockResolvedValue(false);
      mockFileMaterialRepository.create.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.createFileMaterial(data)).rejects.toThrow('Error al crear material: DB error');
    });
  });
  describe('getFileMaterialById', () => {
    test('retrieves material by ID successfully', async () => {
      const material: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), name: 'Test' } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(material);
      const result = await fileMaterialService.getFileMaterialById('507f1f77bcf86cd799439011');
      expect(result).toEqual(material);
    });
    test('throws error for invalid ID', async () => {
      await expect(fileMaterialService.getFileMaterialById('invalid')).rejects.toThrow('ID de material inválido');
    });
    test('handles error during retrieval', async () => {
      mockFileMaterialRepository.findById.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.getFileMaterialById('507f1f77bcf86cd799439011')).rejects.toThrow('Error al obtener material: DB error');
    });
  });
  describe('getFileMaterials', () => {
    test('retrieves materials with filters successfully', async () => {
      const filters = { type: FileMaterialType.SUPPORT_DOCUMENT, isPublic: true };
      const materials = [{ _id: new mongoose.Types.ObjectId(), name: 'Test' }];
      mockFileMaterialRepository.findWithPagination.mockResolvedValue(materials);
      const result = await fileMaterialService.getFileMaterials(filters);
      expect(result).toEqual(materials);
      expect(mockFileMaterialRepository.findWithPagination).toHaveBeenCalledWith(
        { type: FileMaterialType.SUPPORT_DOCUMENT, isPublic: true },
        { page: 1, limit: 10, sort: '-createdAt' }
      );
    });
    test('handles error during retrieval', async () => {
      mockFileMaterialRepository.findWithPagination.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.getFileMaterials()).rejects.toThrow('Error al obtener materiales: DB error');
    });
  });
  describe('getPublicMaterials', () => {
    test('retrieves public materials successfully', async () => {
      const materials = [{ _id: new mongoose.Types.ObjectId(), name: 'Test' }];
      mockFileMaterialRepository.findPublicMaterials.mockResolvedValue(materials);
      const result = await fileMaterialService.getPublicMaterials();
      expect(result).toEqual(materials);
      expect(mockFileMaterialRepository.findPublicMaterials).toHaveBeenCalledWith(undefined, undefined, { page: 1, limit: 10, sort: '-createdAt' });
    });
    test('handles error during retrieval', async () => {
      mockFileMaterialRepository.findPublicMaterials.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.getPublicMaterials()).rejects.toThrow('Error al obtener materiales públicos: DB error');
    });
  });
  describe('getUserMaterials', () => {
    test('retrieves user materials successfully', async () => {
      const materials = [{ _id: new mongoose.Types.ObjectId(), name: 'Test' }];
      mockFileMaterialRepository.findByUser.mockResolvedValue(materials);
      const result = await fileMaterialService.getUserMaterials('507f1f77bcf86cd799439011');
      expect(result).toEqual(materials);
      expect(mockFileMaterialRepository.findByUser).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { page: 1, limit: 10, sort: '-createdAt' });
    });
    test('throws error for invalid user ID', async () => {
      await expect(fileMaterialService.getUserMaterials('invalid')).rejects.toThrow('ID de usuario inválido');
    });
    test('handles error during retrieval', async () => {
      mockFileMaterialRepository.findByUser.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.getUserMaterials('507f1f77bcf86cd799439011')).rejects.toThrow('Error al obtener materiales del usuario: DB error');
    });
  });
  describe('updateFileMaterial', () => {
    test('updates material successfully', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedMaterial: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), name: 'Updated Name' } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(updatedMaterial);
      mockFileMaterialRepository.updateById.mockResolvedValue(updatedMaterial);
      const result = await fileMaterialService.updateFileMaterial('507f1f77bcf86cd799439011', updateData);
      expect(result).toEqual(updatedMaterial);
    });
    test('throws error for invalid ID', async () => {
      await expect(fileMaterialService.updateFileMaterial('invalid', { name: 'Test' })).rejects.toThrow('ID de material inválido');
    });
    test('throws error when material not found', async () => {
      mockFileMaterialRepository.findById.mockResolvedValue(null);
      await expect(fileMaterialService.updateFileMaterial('507f1f77bcf86cd799439011', { name: 'Test' })).rejects.toThrow('Material no encontrado');
    });
    test('throws error when name already exists', async () => {
      const existingMaterial: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), name: 'Old Name' } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(existingMaterial);
      mockFileMaterialRepository.existsByName.mockResolvedValue(true);
      await expect(fileMaterialService.updateFileMaterial('507f1f77bcf86cd799439011', { name: 'Existing Name' })).rejects.toThrow('Ya existe un material con este nombre');
    });
    test('handles error during update', async () => {
      mockFileMaterialRepository.findById.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.updateFileMaterial('507f1f77bcf86cd799439011', { name: 'Test' })).rejects.toThrow('Error al actualizar material: DB error');
    });
  });
  describe('deleteFileMaterial', () => {
    test('deletes material successfully', async () => {
      const existingMaterial: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), fileName: 'test.pdf' } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(existingMaterial);
      mockFileMaterialRepository.deleteById.mockResolvedValue(existingMaterial);
      mockFs.existsSync.mockReturnValue(true);
      const result = await fileMaterialService.deleteFileMaterial('507f1f77bcf86cd799439011');
      expect(result).toBe(true);
      expect(mockFileMaterialRepository.deleteById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
    test('throws error for invalid ID', async () => {
      await expect(fileMaterialService.deleteFileMaterial('invalid')).rejects.toThrow('ID de material inválido');
    });
    test('throws error when material not found', async () => {
      mockFileMaterialRepository.findById.mockResolvedValue(null);
      await expect(fileMaterialService.deleteFileMaterial('507f1f77bcf86cd799439011')).rejects.toThrow('Material no encontrado');
    });
    test('handles error during deletion', async () => {
      mockFileMaterialRepository.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), filePath: 'path/to/file.pdf' } as unknown as IFileMaterial);
      mockFileMaterialRepository.deleteById.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.deleteFileMaterial('507f1f77bcf86cd799439011')).rejects.toThrow('Error al eliminar material: DB error');
    });
  });
  describe('downloadMaterial', () => {
    test('downloads material successfully', async () => {
      const existingMaterial: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), fileName: 'test.pdf', originalFileName: 'original.pdf', status: UserStatus.ACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(existingMaterial);
      mockFileMaterialRepository.incrementDownloadCount.mockResolvedValue(null);
      mockPath.join.mockReturnValue('/app/uploads/materials/test.pdf');
      mockFs.existsSync.mockReturnValue(true);
      const result = await fileMaterialService.downloadMaterial('507f1f77bcf86cd799439011');
      expect(result).toEqual({
        filePath: '/app/uploads/materials/test.pdf',
        fileName: 'original.pdf',
      });
      expect(mockFileMaterialRepository.incrementDownloadCount).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });
    test('throws error for invalid ID', async () => {
      await expect(fileMaterialService.downloadMaterial('invalid')).rejects.toThrow('ID de material inválido');
    });
    test('throws error when material not found', async () => {
      mockFileMaterialRepository.findById.mockResolvedValue(null);
      await expect(fileMaterialService.downloadMaterial('507f1f77bcf86cd799439011')).rejects.toThrow('Material no encontrado o no disponible');
    });
    test('throws error when file does not exist', async () => {
      const existingMaterial: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), fileName: 'test.pdf', type: FileMaterialType.TEMPLATE, status: UserStatus.ACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(existingMaterial);
      mockPath.join.mockReturnValue('/app/uploads/materials/test.pdf');
      mockFs.existsSync.mockReturnValue(false);
      await expect(fileMaterialService.downloadMaterial('507f1f77bcf86cd799439011')).rejects.toThrow('Archivo no encontrado en el servidor');
    });
    test('handles error during download', async () => {
      mockFileMaterialRepository.findById.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.downloadMaterial('507f1f77bcf86cd799439011')).rejects.toThrow('Error al descargar material: DB error');
    });
  });
  describe('getMaterialStats', () => {
    test('retrieves material stats successfully', async () => {
      const stats = { totalMaterials: 10, totalDownloads: 100 };
      mockFileMaterialRepository.getStats.mockResolvedValue(stats);
      const result = await fileMaterialService.getMaterialStats();
      expect(result).toEqual(stats);
    });
    test('handles error during retrieval', async () => {
      mockFileMaterialRepository.getStats.mockRejectedValue(new Error('DB error'));
      await expect(fileMaterialService.getMaterialStats()).rejects.toThrow('Error al obtener estadísticas: DB error');
    });
  });
  describe('validateMaterialAccess', () => {
    test('returns true for public material', async () => {
      const material: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), isPublic: true, status: UserStatus.ACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(material);
      const result = await fileMaterialService.validateMaterialAccess('507f1f77bcf86cd799439011', 'user456');
      expect(result).toBe(true);
    });
    test('returns true for owner access', async () => {
      const material: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), isPublic: false, uploadedBy: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), status: UserStatus.ACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(material);
      const result = await fileMaterialService.validateMaterialAccess('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011');
      expect(result).toBe(true);
    });
    test('returns false for inactive material', async () => {
      const material: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), isPublic: true, status: UserStatus.INACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(material);
      const result = await fileMaterialService.validateMaterialAccess('507f1f77bcf86cd799439011', 'user456');
      expect(result).toBe(false);
    });
    test('returns false for non-owner private material', async () => {
      const material: IFileMaterial = { _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), isPublic: false, uploadedBy: 'other-user' as unknown as string, status: UserStatus.ACTIVE } as unknown as IFileMaterial;
      mockFileMaterialRepository.findById.mockResolvedValue(material);
      const result = await fileMaterialService.validateMaterialAccess('507f1f77bcf86cd799439011', 'user456');
      expect(result).toBe(false);
    });
    test('returns false on error', async () => {
      mockFileMaterialRepository.findById.mockRejectedValue(new Error('DB error'));
      const result = await fileMaterialService.validateMaterialAccess('507f1f77bcf86cd799439011', 'user456');
      expect(result).toBe(false);
    });
  });
});
