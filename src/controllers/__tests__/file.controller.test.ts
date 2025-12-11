import { Request, Response, NextFunction } from 'express';
import FileController from '../file.controller';
import FileService from '@/services/file.service';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('@/services/file.service');
jest.mock('fs');
jest.mock('@/utils', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
    prepareResponse: (status: number, message: string, data?: any) => ({
        status,
        message,
        data,
    }),
}));
jest.mock('@/utils/fileSecurity.util', () => ({
    getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
}));

describe('FileController', () => {
    let fileController: FileController;
    let mockFileService: jest.Mocked<FileService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockFileService = new FileService() as jest.Mocked<FileService>;
        fileController = new FileController(mockFileService);

        req = {
            params: {},
            headers: {},
            query: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
            setHeader: jest.fn(),
            writeHead: jest.fn(),
            headersSent: false,
        };
        next = jest.fn();
    });

    describe('getFileImage', () => {
        it('should get file image successfully', async () => {
            req.params = { imageFileName: 'test.jpg' };
            const mockBuffer = Buffer.from('image content');
            mockFileService.getFileImage.mockResolvedValue(mockBuffer);

            await fileController.getFileImage(req as Request, res as Response, next);

            expect(mockFileService.getFileImage).toHaveBeenCalledWith('test.jpg', '127.0.0.1');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
            expect(res.send).toHaveBeenCalledWith(mockBuffer);
        });

        it('should return 404 if image not found', async () => {
            req.params = { imageFileName: 'test.jpg' };
            mockFileService.getFileImage.mockResolvedValue(null);

            await fileController.getFileImage(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Image not found',
            }));
        });
    });

    describe('getFileVideo', () => {
        it('should return 404 if video not found', async () => {
            req.params = { videoFileName: 'test.mp4' };
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            await fileController.getFileVideo(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Video not found',
            }));
        });
    });

    describe('getPublicFile', () => {
        it('should get public file successfully', async () => {
            req.params = { publicFile: 'test.pdf' };
            const mockBuffer = Buffer.from('pdf content');
            mockFileService.getPublicFile.mockResolvedValue(mockBuffer);

            await fileController.getPublicFile(req as Request, res as Response, next);

            expect(mockFileService.getPublicFile).toHaveBeenCalledWith('test.pdf', '127.0.0.1');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
            expect(res.send).toHaveBeenCalledWith(mockBuffer);
        });

        it('should return 404 if public file not found', async () => {
            req.params = { publicFile: 'test.pdf' };
            mockFileService.getPublicFile.mockResolvedValue(null);

            await fileController.getPublicFile(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'File not found',
            }));
        });
    });
});
