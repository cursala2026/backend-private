import { Request, Response, NextFunction } from 'express';
import UserController from '../user.controller';
import UserService from '@/services/user.service';
import { uploadFiles } from '@/utils/fileUpload.util';
import fs from 'fs';
import path from 'path';

// Mock BunnyService to avoid real network calls
jest.mock('@/services/bunny.service', () => ({
    getInstance: () => ({
        uploadFilePreserveOriginal: jest.fn().mockResolvedValue('https://cdn.test/file.jpg'),
        deleteFile: jest.fn().mockResolvedValue(true),
    }),
}));

// Mock dependencies
jest.mock('@/services/user.service');
jest.mock('@/utils/fileUpload.util', () => ({
    uploadFiles: {
        fields: jest.fn(),
    },
    uploadDirSignatures: '/tmp/signatures',
}));
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('UserController', () => {
    let userController: UserController;
    let mockUserService: jest.Mocked<UserService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUserService = new UserService({} as any, {} as any, {} as any) as jest.Mocked<UserService>;
        userController = new UserController(mockUserService);

        req = {
            body: {},
            params: {},
            user: { _id: 'user-123' } as any,
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('getAllUsers', () => {
        it('should get all users successfully', async () => {
            const mockUsers = [{ _id: 'user-1' }, { _id: 'user-2' }];
            mockUserService.getAllUsers.mockResolvedValue(mockUsers as any);

            await userController.getAllUsers(req as Request, res as Response, next);

            expect(mockUserService.getAllUsers).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                data: mockUsers,
            }));
        });

        it('should call next with error if fetching users fails', async () => {
            const error = new Error('Fetch failed');
            mockUserService.getAllUsers.mockRejectedValue(error);

            await userController.getAllUsers(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('getUsersPaginated', () => {
        it('should forward courseId from query to service', async () => {
            const mockResult = { data: [], pagination: { page: 1, page_size: 10, total: 0, totalPages: 0 } };
            mockUserService.getUsersPaginated.mockResolvedValue(mockResult as any);

            req.query = { page: '1', limit: '10', sort: 'createdAt', dir: 'DESC', courseId: '64a1f2e5b9c3d4e5f6a7b8c9' } as any;

            await userController.getUsersPaginated(req as Request, res as Response, next);

            expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(expect.objectContaining({ courseId: '64a1f2e5b9c3d4e5f6a7b8c9' }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockResult }));
        });

        it('should forward courseId=none to service', async () => {
            const mockResult = { data: [], pagination: { page: 1, page_size: 10, total: 0, totalPages: 0 } };
            mockUserService.getUsersPaginated.mockResolvedValue(mockResult as any);

            req.query = { page: '1', limit: '10', sort: 'createdAt', dir: 'DESC', courseId: 'none' } as any;

            await userController.getUsersPaginated(req as Request, res as Response, next);

            expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'none' }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: mockResult }));
        });
    });

    describe('updateUserData', () => {
        it('should update user data successfully with files', async () => {
            req.params = { userId: 'user-123' };
            req.body = { professionalDescription: 'A very long professional description that is definitely longer than 100 characters to pass the validation check in the controller logic. It needs to be quite verbose.' };

            // Simular multipart/form-data para que el controller invoque uploadFiles.fields
            (req as any).is = jest.fn().mockReturnValue('multipart/form-data');

            // Prepare temporary files to simulate multer-created files
            const tmpPhoto = path.join(__dirname, 'tmp_photo.jpg');
            const tmpSig = path.join(__dirname, 'tmp_sig.png');
            fs.writeFileSync(tmpPhoto, 'photo');
            fs.writeFileSync(tmpSig, 'sig');

            // Mock Multer middleware
            (uploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                req.files = {
                    photo: [{ filename: 'photo.jpg', originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 1000, path: tmpPhoto } as any],
                    signatureFile: [{ filename: 'sig.png', originalname: 'sig.png', mimetype: 'image/png', size: 1000, path: tmpSig } as any],
                };
                cb(null);
            });

            const mockUser = { _id: 'user-123', profilePhotoUrl: 'photo.jpg', professionalSignatureUrl: 'sig.png' };
            mockUserService.getUserById.mockResolvedValue(mockUser as any);
            // updateUser is called by the controller for DB updates
            mockUserService.updateUser.mockResolvedValue(mockUser as any);

            await userController.updateUserData(req as Request, res as Response, next);

            expect(uploadFiles.fields).toHaveBeenCalled();
            // Since the logic is inside the callback, we can't easily await it unless we make the test wait or use the setImmediate trick
            // But here we are mocking the middleware to execute the callback synchronously, so it should be fine?
            // Wait, the callback is async in the controller: (req, res, async (err) => { ... })
            // So we need to wait for the promise chain to complete.

            // However, since we are not awaiting the middleware call in the controller (it's void), 
            // the test might finish before the callback logic runs if we don't handle it.
            // But wait, the controller method IS async, but it calls uploadFiles.fields(...)(req, res, cb).
            // This call is synchronous, but the callback passed to it is async.
            // If our mock executes the callback synchronously, the async function inside the callback will start.
            // We need to wait for it.

            await new Promise(resolve => setImmediate(resolve));

            expect(mockUserService.updateUser).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({ professionalDescription: req.body.professionalDescription })
            );
            // After file upload the controller calls updateUser for photo and signature
            expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', { profilePhotoUrl: expect.any(String) });
            expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', { professionalSignatureUrl: expect.any(String) });
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                message: 'Usuario actualizado correctamente',
            }));
        });
    });
});
