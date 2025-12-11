import { Request, Response, NextFunction } from 'express';
import CourseController from '../course.controller';
import CourseService from '@/services/course.service';
import { courseUploadFiles, courseUploadService } from '@/services/course-upload.service';

// Mock dependencies
jest.mock('@/services/course.service');
jest.mock('@/services/course-upload.service', () => ({
    courseUploadFiles: {
        fields: jest.fn(),
    },
    courseUploadService: {
        deleteImageFile: jest.fn(),
        deleteProgramFile: jest.fn(),
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

describe('CourseController', () => {
    let courseController: CourseController;
    let mockCourseService: jest.Mocked<CourseService>;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCourseService = new CourseService({} as any, {} as any) as jest.Mocked<CourseService>;
        courseController = new CourseController(mockCourseService);

        req = {
            body: {},
            files: {},
            params: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
    });

    describe('create', () => {
        it('should create a course successfully', async () => {
            // Arrange
            req.body = {
                name: 'Test Course',
                description: 'Description',
                price: '100',
            };
            req.files = {
                imageFile: [{ filename: 'image.jpg' } as Express.Multer.File],
            };

            // Mock Multer middleware
            (courseUploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            const mockCourse = { _id: 'course-123', ...req.body, imageUrl: 'image.jpg' };
            mockCourseService.create.mockResolvedValue(mockCourse);

            // Act
            await courseController.create(req as Request, res as Response, next);

            // Assert
            expect(courseUploadFiles.fields).toHaveBeenCalled();
            expect(mockCourseService.create).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Course',
                imageUrl: 'image.jpg',
                price: 100,
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 201,
                data: mockCourse,
            }));
        });

        it('should return 400 if image is missing', async () => {
            // Arrange
            req.body = { name: 'Test Course' };
            req.files = {}; // No files

            // Mock Multer middleware
            (courseUploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            // Act
            await courseController.create(req as Request, res as Response, next);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Image is required',
            }));
        });

        it('should return 400 if multer error occurs', async () => {
            // Mock Multer middleware to return error
            (courseUploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(new Error('Multer error'));
            });

            await courseController.create(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Multer error',
            }));
        });
    });

    describe('update', () => {
        it('should update a course successfully', async () => {
            // Arrange
            req.params = { id: 'course-123' };
            req.body = {
                name: 'Updated Course',
            };
            req.files = {
                imageFile: [{ filename: 'new-image.jpg' } as Express.Multer.File],
            };

            const existingCourse = { _id: 'course-123', imageUrl: 'old-image.jpg' };
            mockCourseService.findOneById.mockResolvedValue(existingCourse as any);
            mockCourseService.update.mockResolvedValue({ ...existingCourse, name: 'Updated Course', imageUrl: 'new-image.jpg' } as any);

            // Mock Multer middleware
            (courseUploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            // Act
            await courseController.update(req as Request, res as Response, next);

            // Wait for async callback to complete
            await new Promise(resolve => setImmediate(resolve));

            // Assert
            expect(mockCourseService.findOneById).toHaveBeenCalledWith('course-123');
            expect(courseUploadService.deleteImageFile).toHaveBeenCalledWith('old-image.jpg');
            expect(mockCourseService.update).toHaveBeenCalledWith(
                'course-123',
                expect.objectContaining({ name: 'Updated Course', imageUrl: 'new-image.jpg' }),
                ['startDate', 'registrationOpenDate']
            );
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 200,
                message: 'Course updated successfully',
            }));
        });

        it('should return 404 if course not found', async () => {
            req.params = { id: 'course-123' };

            // Mock Multer middleware
            (courseUploadFiles.fields as jest.Mock).mockReturnValue((req: Request, res: Response, cb: (err?: any) => void) => {
                cb(null);
            });

            mockCourseService.findOneById.mockResolvedValue(null);

            await courseController.update(req as Request, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Course not found',
            }));
        });
    });
});
