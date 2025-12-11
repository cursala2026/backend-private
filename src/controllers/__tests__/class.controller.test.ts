import { Request, Response, NextFunction } from 'express';
import { fileUploadService } from '@/services/file-upload.service';
import ClassController from '../class.controller';
import ClassService from '@/services/class.service';

// Mock dependencies
jest.mock('@/services/class.service');
jest.mock('@/services/file-upload.service');
jest.mock('../../services/file-upload.service'); // Mock relative path too

jest.mock('@/utils', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    prepareResponse: (status: number, message: string, data?: any) => ({
        status,
        message,
        data,
    }),
}));

describe('ClassController Standard', () => {
    let classController: ClassController;
    let mockClassService: jest.Mocked<ClassService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClassService = new ClassService({} as any) as jest.Mocked<ClassService>;
        classController = new ClassController(mockClassService);

        req = {
            body: {},
            files: {},
            headers: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            writeHead: jest.fn(),
        };
        next = jest.fn();
    });

    describe('create', () => {
        it('should create a class successfully', async () => {
            req.body = {
                name: 'Test Class',
                description: 'Test Description',
                courseId: 'course-123',
                linkLive: 'http://test.com',
                imageFileId: 'img-123',
                videoFileId: 'vid-123',
                supportMaterialIds: ['mat-123'],
            };

            const mockResolvedFiles = {
                imageUrl: 'image.jpg',
                videoUrl: 'video.mp4',
                supportMaterials: ['material.pdf'],
                errors: [],
                uploadIdsToClean: ['img-123'],
            };

            (fileUploadService.resolveClassFiles as jest.Mock).mockReturnValue(mockResolvedFiles);
            mockClassService.create.mockResolvedValue({ _id: 'class-123', ...req.body } as any);

            await classController.create(req as Request, res as Response, next);

            expect(fileUploadService.resolveClassFiles).toHaveBeenCalledWith(
                req.files,
                'img-123',
                'vid-123',
                ['mat-123']
            );
            expect(fileUploadService.cleanupAssembledFilesMappings).toHaveBeenCalledWith(['img-123']);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
        });

        it('should return 400 if file resolution fails', async () => {
            req.body = {
                name: 'Test Class',
                description: 'Test Description',
                courseId: 'course-123',
                imageFileId: 'img-123', // Added to pass validation
            };
            const mockResolvedFiles = {
                imageUrl: undefined,
                videoUrl: undefined,
                supportMaterials: [],
                errors: ['File error'],
                uploadIdsToClean: [],
            };

            (fileUploadService.resolveClassFiles as jest.Mock).mockReturnValue(mockResolvedFiles);

            await classController.create(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'File error' }));
        });
    });

    describe('update', () => {
        it('should update a class successfully', async () => {
            req.params = { classId: 'class-123' };
            req.body = {
                name: 'Updated Class',
                imageFileId: 'img-new',
            };

            const mockResolvedFiles = {
                imageUrl: 'new-image.jpg',
                videoUrl: undefined,
                supportMaterials: [],
                errors: [],
                uploadIdsToClean: ['img-new'],
                filesToDelete: ['old-image.jpg'],
            };

            (fileUploadService.resolveClassFilesForUpdate as jest.Mock).mockReturnValue(mockResolvedFiles);
            mockClassService.findOneById.mockResolvedValue({ imageUrl: 'old-image.jpg' } as any);
            mockClassService.update.mockResolvedValue({ _id: 'class-123', ...req.body } as any);

            await classController.update(req as Request, res as Response, next);

            expect(fileUploadService.resolveClassFilesForUpdate).toHaveBeenCalled();
            expect(fileUploadService.deleteFiles).toHaveBeenCalledWith(['old-image.jpg']);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
        });
    });

    describe('getClassVideo', () => {
        it('should stream video successfully', async () => {
            req.params = { videoFileName: 'video.mp4' };
            req.headers = { range: 'bytes=0-' };

            const mockStream = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockVideoData = {
                stream: mockStream,
                headers: {
                    'Content-Range': 'bytes 0-100/1000',
                    'Accept-Ranges': 'bytes',
                    'Content-Length': 100,
                    'Content-Type': 'video/mp4',
                },
                status: 206,
            };

            (fileUploadService.getVideoStream as jest.Mock).mockReturnValue(mockVideoData);

            await classController.getClassVideo(req as Request, res as Response, next);

            expect(fileUploadService.getVideoStream).toHaveBeenCalledWith('video.mp4', 'bytes=0-');
            expect(res.writeHead).toHaveBeenCalledWith(206, mockVideoData.headers);
            expect(mockStream.pipe).toHaveBeenCalledWith(res);
        });

        it('should return 404 if video not found', async () => {
            req.params = { videoFileName: 'video.mp4' };
            (fileUploadService.getVideoStream as jest.Mock).mockReturnValue(null);

            await classController.getClassVideo(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
