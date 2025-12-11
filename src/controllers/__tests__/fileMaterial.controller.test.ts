import { Request, Response } from 'express';
import { FileMaterialController } from '../fileMaterial.controller';
import { fileMaterialService } from '@/services';
import { uploadFiles } from '@utils/fileUpload.util';
import { FileMaterialType, FileMaterialCategory } from '@models/mongo';
import { UserStatus } from '@models/enums';

// Mock dependencies
jest.mock('@/services', () => ({
    fileMaterialService: {
        createFileMaterial: jest.fn(),
        getFileMaterials: jest.fn(),
        getPublicMaterials: jest.fn(),
        getFileMaterialById: jest.fn(),
        getUserMaterials: jest.fn(),
        updateFileMaterial: jest.fn(),
        deleteFileMaterial: jest.fn(),
        validateMaterialAccess: jest.fn(),
        downloadMaterial: jest.fn(),
        getMaterialStats: jest.fn(),
    },
}));

jest.mock('@utils/fileUpload.util', () => ({
    uploadFiles: {
        single: jest.fn(),
    },
}));

jest.mock('@/utils', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('FileMaterialController', () => {
    let fileMaterialController: FileMaterialController;
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();
        fileMaterialController = new FileMaterialController();

        req = {
            body: {},
            query: {},
            params: {},
            user: { _id: 'user-123' } as any,
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn(),
            sendFile: jest.fn(),
        };
    });

    describe('uploadMaterial', () => {
        it('should upload material successfully', async () => {
            req.body = {
                name: 'Test Material',
                type: FileMaterialType.EDUCATIONAL_MATERIAL,
                category: FileMaterialCategory.OTHER,
                isPublic: 'true',
            };
            req.file = { filename: 'file.pdf' } as Express.Multer.File;

            (uploadFiles.single as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            const mockMaterial = { _id: 'mat-123', ...req.body };
            (fileMaterialService.createFileMaterial as jest.Mock).mockResolvedValue(mockMaterial);

            await fileMaterialController.uploadMaterial(req as Request, res as Response);

            expect(uploadFiles.single).toHaveBeenCalledWith('materialFile');
            expect(fileMaterialService.createFileMaterial).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Material',
                type: FileMaterialType.EDUCATIONAL_MATERIAL,
                isPublic: true,
            }));
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockMaterial,
            }));
        });

        it('should return 400 if file is missing', async () => {
            (uploadFiles.single as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            await fileMaterialController.uploadMaterial(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'No se ha subido ningún archivo',
            }));
        });
    });

    describe('getMaterials', () => {
        it('should get materials with filters', async () => {
            req.query = { type: FileMaterialType.EDUCATIONAL_MATERIAL, page: '1', limit: '10' };
            const mockMaterials = { docs: [], totalDocs: 0 };
            (fileMaterialService.getFileMaterials as jest.Mock).mockResolvedValue(mockMaterials);

            await fileMaterialController.getMaterials(req as Request, res as Response);

            expect(fileMaterialService.getFileMaterials).toHaveBeenCalledWith(expect.objectContaining({
                type: FileMaterialType.EDUCATIONAL_MATERIAL,
                page: 1,
                limit: 10,
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockMaterials,
            }));
        });
    });

    describe('downloadMaterial', () => {
        it('should download material successfully', async () => {
            req.params = { id: 'mat-123' };
            (fileMaterialService.validateMaterialAccess as jest.Mock).mockResolvedValue(true);
            (fileMaterialService.downloadMaterial as jest.Mock).mockResolvedValue({
                filePath: '/path/to/file.pdf',
                fileName: 'file.pdf',
            });

            await fileMaterialController.downloadMaterial(req as Request, res as Response);

            expect(fileMaterialService.validateMaterialAccess).toHaveBeenCalledWith('mat-123', 'user-123');
            expect(fileMaterialService.downloadMaterial).toHaveBeenCalledWith('mat-123');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="file.pdf"');
            expect(res.sendFile).toHaveBeenCalledWith('/path/to/file.pdf');
        });

        it('should return 403 if access denied', async () => {
            req.params = { id: 'mat-123' };
            (fileMaterialService.validateMaterialAccess as jest.Mock).mockResolvedValue(false);

            await fileMaterialController.downloadMaterial(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'No tienes permisos para descargar este material',
            }));
        });
    });
});
