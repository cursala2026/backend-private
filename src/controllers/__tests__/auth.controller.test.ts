import { Request, Response, NextFunction } from 'express';
import AuthController from '../auth.controller';
import AuthService from '@/services/auth.service';

// Mock dependencies
jest.mock('@/services/auth.service');
jest.mock('@/utils/api-response', () => jest.fn((status, message, data) => ({ status, message, data })));

describe('AuthController', () => {
    let authController: AuthController;
    let mockAuthService: jest.Mocked<AuthService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockAuthService = new AuthService({} as any) as jest.Mocked<AuthService>;
        authController = new AuthController(mockAuthService);

        req = {
            body: {},
            user: { _id: 'user-123' } as any,
        };
        res = {
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('login', () => {
        it('should login successfully', async () => {
            req.body = { user: 'test@example.com', password: 'password123' };
            const mockResult = { token: 'token-123', userInfo: { _id: 'user-123' } };
            mockAuthService.login.mockResolvedValue(mockResult as any);

            await authController.login(req as Request, res as Response, next);

            expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                data: mockResult,
            }));
        });

        it('should call next with error if login fails', async () => {
            req.body = { user: 'test@example.com', password: 'wrongpassword' };
            const error = new Error('Login failed');
            mockAuthService.login.mockRejectedValue(error);

            await authController.login(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('registerUser', () => {
        it('should register user successfully', async () => {
            req.body = { email: 'new@example.com', password: 'password123' };
            mockAuthService.register.mockResolvedValue({ _id: 'new-user' } as any);

            await authController.registerUser(req as Request, res as Response, next);

            expect(mockAuthService.register).toHaveBeenCalledWith(req.body);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                message: 'Successful operation',
            }));
        });

        it('should call next with error if registration fails', async () => {
            const error = new Error('Registration failed');
            mockAuthService.register.mockRejectedValue(error);

            await authController.registerUser(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('initiateResetPassword', () => {
        it('should initiate reset password successfully', async () => {
            req.body = { email: 'test@example.com' };
            mockAuthService.generateResetPasswordToken.mockResolvedValue({ token: 'token', expiresIn: 3600 });

            await authController.initiateResetPassword(req as Request, res as Response, next);

            expect(mockAuthService.generateResetPasswordToken).toHaveBeenCalledWith('test@example.com');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                message: 'Correo de restablecimiento de contraseña enviado.',
            }));
        });
    });

    describe('completeResetPassword', () => {
        it('should complete reset password successfully', async () => {
            req.body = { token: 'token', newPassword: 'newPassword' };
            mockAuthService.resetPassword.mockResolvedValue({} as any);

            await authController.completeResetPassword(req as Request, res as Response, next);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith('token', 'newPassword');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                message: 'Contraseña restablecida con éxito.',
            }));
        });
    });

    describe('currentUser', () => {
        it('should return current user info', async () => {
            const mockUserInfo = { _id: 'user-123', email: 'test@example.com' };
            mockAuthService.getUserInfo.mockResolvedValue(mockUserInfo as any);

            await authController.currentUser(req as Request, res as Response, next);

            expect(mockAuthService.getUserInfo).toHaveBeenCalledWith(req.user);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Valid Token',
                user: mockUserInfo,
            }));
        });
    });
});
