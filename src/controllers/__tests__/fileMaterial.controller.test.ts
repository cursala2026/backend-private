import { Request, Response } from 'express';
import { FileMaterialController } from '../fileMaterial.controller';
import { fileMaterialService } from '@/services';
import { uploadFiles } from '@/utils/fileUpload.util';
import { FileMaterialType, FileMaterialCategory, UserStatus } from '@/models';

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

jest.mock('@/utils/fileUpload.util', () => ({

uploadFiles: {
        single: jest.fn(),
    },
}));

jest.mock('@/utils', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
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

    describe('getPublicMaterials', () => {
        it('should call the service with type, category, folderPath, page and limit in the correct positions', async () => {
            req.query = {
                type: FileMaterialType.EDUCATIONAL_MATERIAL,
                category: FileMaterialCategory.PDF,
                folderPath: 'cursos/2026',
                page: '2',
                limit: '5',
            };
            const mockMaterials = { docs: [], totalDocs: 0 };
            (fileMaterialService.getPublicMaterials as jest.Mock).mockResolvedValue(mockMaterials);

            await fileMaterialController.getPublicMaterials(req as Request, res as Response);

            expect(fileMaterialService.getPublicMaterials).toHaveBeenCalledWith(
                FileMaterialType.EDUCATIONAL_MATERIAL,
                FileMaterialCategory.PDF,
                'cursos/2026', // folderPath must land in the 3rd position, NOT page
                2,             // page must land in the 4th position
                5              // limit must land in the 5th position
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockMaterials,
            }));
        });

        it('should pass folderPath as undefined when not present in query', async () => {
            req.query = { page: '1', limit: '10' };
            const mockMaterials = { docs: [], totalDocs: 0 };
            (fileMaterialService.getPublicMaterials as jest.Mock).mockResolvedValue(mockMaterials);

            await fileMaterialController.getPublicMaterials(req as Request, res as Response);

            expect(fileMaterialService.getPublicMaterials).toHaveBeenCalledWith(
                undefined,
                undefined,
                undefined, // folderPath absent, must not be page or a number
                1,
                10
            );
        });

        it('should default page and limit when not present in query', async () => {
            req.query = {};
            const mockMaterials = { docs: [], totalDocs: 0 };
            (fileMaterialService.getPublicMaterials as jest.Mock).mockResolvedValue(mockMaterials);

            await fileMaterialController.getPublicMaterials(req as Request, res as Response);

            expect(fileMaterialService.getPublicMaterials).toHaveBeenCalledWith(
                undefined,
                undefined,
                undefined,
                1,
                10
            );
        });

        // Explicit regression test for the reported bug: professors were seeing an
        // empty list because `page` was being sent in the `folderPath` argument
        // position, producing a query like { folderPath: 1 } that never matches
        // any real document (folderPath is a string field).
        it('should NOT leak the page number into the folderPath argument', async () => {
            req.query = { page: '3', limit: '10' };
            const mockMaterials = { docs: [], totalDocs: 0 };
            (fileMaterialService.getPublicMaterials as jest.Mock).mockResolvedValue(mockMaterials);

            await fileMaterialController.getPublicMaterials(req as Request, res as Response);

            const callArgs = (fileMaterialService.getPublicMaterials as jest.Mock).mock.calls[0];
            const folderPathArg = callArgs[2];
            const pageArg = callArgs[3];

            expect(folderPathArg).not.toBe(3);
            expect(folderPathArg).toBeUndefined();
            expect(pageArg).toBe(3);
        });

        it('should return 500 if the service throws', async () => {
            req.query = {};
            (fileMaterialService.getPublicMaterials as jest.Mock).mockRejectedValue(new Error('DB error'));

            await fileMaterialController.getPublicMaterials(req as Request, res as Response);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'DB error',
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