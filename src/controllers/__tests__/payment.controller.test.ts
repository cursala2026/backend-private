import { Request, Response, NextFunction } from 'express';
import PaymentController from '../payment.controller';
import PaymentService from '@/services/payment.service';
import { uploadPaymentTicket } from '@/services/payment-upload.service';

// Mock dependencies
jest.mock('@/services/payment.service');
jest.mock('@/services/mercadoPagoPayment.service');
jest.mock('@/repositories');
jest.mock('@/services/mercadoPago.service', () => ({
    validateMercadoPagoConfig: jest.fn(),
    createPaymentPreference: jest.fn(),
    getPaymentInfo: jest.fn(),
    getAccessToken: jest.fn().mockReturnValue('mock-token'),
}));
jest.mock('@/services/payment-upload.service', () => ({
    uploadPaymentTicket: {
        single: jest.fn(),
    },
}));

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

describe('PaymentController', () => {
    let paymentController: PaymentController;
    let mockPaymentService: jest.Mocked<PaymentService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPaymentService = new PaymentService({} as any) as jest.Mocked<PaymentService>;
        paymentController = new PaymentController(mockPaymentService);

        req = {
            body: {},
            file: undefined,
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('submitPaymentFormData', () => {
        it('should submit payment form data successfully', async () => {
            // Arrange
            req.body = {
                courseId: 'course-123',
                courseName: 'Test Course',
                coursePrice: '100',
                studentName: 'John Doe',
                studentEmail: 'john@example.com',
            };
            req.file = { filename: 'ticket.jpg' } as Express.Multer.File;

            // Mock Multer middleware
            (uploadPaymentTicket.single as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            const mockPayment = { _id: 'payment-123', ...req.body, paymentTicket: 'ticket.jpg' };
            mockPaymentService.submitPayment.mockResolvedValue(mockPayment);

            // Act
            await paymentController.submitPaymentFormData(req as Request, res as Response, next);

            // Assert
            expect(uploadPaymentTicket.single).toHaveBeenCalledWith('paymentTicket');
            expect(mockPaymentService.submitPayment).toHaveBeenCalledWith(expect.objectContaining({
                courseId: 'course-123',
                courseName: 'Test Course',
                coursePrice: 100,
                studentName: 'John Doe',
                studentEmail: 'john@example.com',
                paymentTicket: 'ticket.jpg',
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 201,
                data: mockPayment,
            }));
        });

        it('should return 400 if payment ticket is missing', async () => {
            // Arrange
            req.body = { courseId: 'course-123' };
            req.file = undefined; // Missing file

            // Mock Multer middleware
            (uploadPaymentTicket.single as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            // Act
            await paymentController.submitPaymentFormData(req as Request, res as Response, next);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'El comprobante de pago es obligatorio',
            }));
        });

        it('should return 400 if multer error occurs', async () => {
            // Mock Multer middleware to return error
            (uploadPaymentTicket.single as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(new Error('Multer error'));
            });

            await paymentController.submitPaymentFormData(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Multer error',
            }));
        });
    });
});
