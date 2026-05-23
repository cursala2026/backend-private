import { Request, Response } from 'express';

// Mock del singleton courseProgressService ANTES del import del controller
jest.mock('@/services/courseProgress.service', () => ({
  courseProgressService: {
    getProgress: jest.fn(),
    getAllProgress: jest.fn(),
    updateVideoProgress: jest.fn(),
    markClassCompleted: jest.fn(),
    getClassProgress: jest.fn(),
    canAccessClass: jest.fn(),
    resetStudentProgress: jest.fn(),
    updateManualProgress: jest.fn(),
  },
}));

import { courseProgressController } from '../courseProgress.controller';
import { courseProgressService } from '@/services/courseProgress.service';

describe('CourseProgressController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  const mockUser = { _id: 'user-1', roles: ['ALUMNO'] };
  const mockProgress = { courseId: 'course-1', completed: false };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      params: {},
      query: {},
      user: mockUser as any,
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getProgress', () => {
    it('should return progress for authenticated user', async () => {
      req.params = { courseId: 'course-1' };
      (courseProgressService.getProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.getProgress(req as Request, res as Response);

      expect(courseProgressService.getProgress).toHaveBeenCalledWith('user-1', 'course-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProgress });
    });

    it('should use queryUserId when admin requests progress for another user', async () => {
      req.params = { courseId: 'course-1' };
      req.query = { userId: 'student-99' };
      req.user = { _id: 'admin-1', roles: ['ADMIN'] } as any;
      (courseProgressService.getProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.getProgress(req as Request, res as Response);

      expect(courseProgressService.getProgress).toHaveBeenCalledWith('student-99', 'course-1');
    });

    it('should NOT allow regular user to use queryUserId', async () => {
      req.params = { courseId: 'course-1' };
      req.query = { userId: 'other-user' };
      req.user = { _id: 'user-1', roles: ['ALUMNO'] } as any;
      (courseProgressService.getProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.getProgress(req as Request, res as Response);

      // Alumno no puede ver progreso de otro usuario
      expect(courseProgressService.getProgress).toHaveBeenCalledWith('user-1', 'course-1');
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { courseId: 'course-1' };

      await courseProgressController.getProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(courseProgressService.getProgress).not.toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      req.params = { courseId: 'course-1' };
      (courseProgressService.getProgress as jest.Mock).mockRejectedValue(new Error('DB fail'));

      await courseProgressController.getProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('getAllProgress', () => {
    it('should return all progress for authenticated user', async () => {
      const allProgress = [mockProgress];
      (courseProgressService.getAllProgress as jest.Mock).mockResolvedValue(allProgress);

      await courseProgressController.getAllProgress(req as Request, res as Response);

      expect(courseProgressService.getAllProgress).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: allProgress });
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;

      await courseProgressController.getAllProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 on service error', async () => {
      (courseProgressService.getAllProgress as jest.Mock).mockRejectedValue(new Error('fail'));

      await courseProgressController.getAllProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProgress', () => {
    it('should update video progress successfully', async () => {
      req.params = { courseId: 'course-1' };
      req.body = { classId: 'class-1', watchTime: 30, duration: 60, completed: false };
      (courseProgressService.updateVideoProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.updateProgress(req as Request, res as Response);

      expect(courseProgressService.updateVideoProgress).toHaveBeenCalledWith(
        'user-1',
        'course-1',
        { classId: 'class-1', watchTime: 30, duration: 60, completed: false }
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProgress });
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { courseId: 'course-1' };

      await courseProgressController.updateProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 if classId is missing', async () => {
      req.params = { courseId: 'course-1' };
      req.body = { watchTime: 30 }; // Sin classId

      await courseProgressController.updateProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(courseProgressService.updateVideoProgress).not.toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      req.params = { courseId: 'course-1' };
      req.body = { classId: 'class-1' };
      (courseProgressService.updateVideoProgress as jest.Mock).mockRejectedValue(new Error('fail'));

      await courseProgressController.updateProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markCompleted', () => {
    it('should mark a class as completed', async () => {
      req.params = { courseId: 'course-1', classId: 'class-1' };
      (courseProgressService.markClassCompleted as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.markCompleted(req as Request, res as Response);

      expect(courseProgressService.markClassCompleted).toHaveBeenCalledWith('user-1', 'course-1', 'class-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProgress });
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { courseId: 'course-1', classId: 'class-1' };

      await courseProgressController.markCompleted(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 on service error', async () => {
      req.params = { courseId: 'course-1', classId: 'class-1' };
      (courseProgressService.markClassCompleted as jest.Mock).mockRejectedValue(new Error('fail'));

      await courseProgressController.markCompleted(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getClassProgress', () => {
    it('should return progress for a specific class', async () => {
      req.params = { courseId: 'course-1', classId: 'class-1' };
      const classProgress = { classId: 'class-1', completed: true };
      (courseProgressService.getClassProgress as jest.Mock).mockResolvedValue(classProgress);

      await courseProgressController.getClassProgress(req as Request, res as Response);

      expect(courseProgressService.getClassProgress).toHaveBeenCalledWith('user-1', 'course-1', 'class-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: classProgress });
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { courseId: 'course-1', classId: 'class-1' };

      await courseProgressController.getClassProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('canAccessClass', () => {
    it('should return access permission for a class', async () => {
      req.params = { courseId: 'course-1', classId: 'class-1' };
      (courseProgressService.canAccessClass as jest.Mock).mockResolvedValue({ canAccess: true });

      await courseProgressController.canAccessClass(req as Request, res as Response);

      expect(courseProgressService.canAccessClass).toHaveBeenCalledWith('user-1', 'course-1', 'class-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { canAccess: true } });
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;
      req.params = { courseId: 'course-1', classId: 'class-1' };

      await courseProgressController.canAccessClass(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('resetStudentProgress', () => {
    it('should reset student progress', async () => {
      req.params = { courseId: 'course-1', userId: 'student-1' };
      (courseProgressService.resetStudentProgress as jest.Mock).mockResolvedValue({ deleted: true });

      await courseProgressController.resetStudentProgress(req as Request, res as Response);

      expect(courseProgressService.resetStudentProgress).toHaveBeenCalledWith('student-1', 'course-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 500 on service error', async () => {
      req.params = { courseId: 'course-1', userId: 'student-1' };
      (courseProgressService.resetStudentProgress as jest.Mock).mockRejectedValue(new Error('fail'));

      await courseProgressController.resetStudentProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateManualProgress', () => {
    it('should update manual progress successfully', async () => {
      req.body = { userId: 'student-1', courseId: 'course-1', type: 'class', itemId: 'item-1', completed: true };
      (courseProgressService.updateManualProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.updateManualProgress(req as Request, res as Response);

      expect(courseProgressService.updateManualProgress).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'student-1', courseId: 'course-1', type: 'class', itemId: 'item-1', completed: true })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = { userId: 'student-1', courseId: 'course-1' }; // Falta type e itemId

      await courseProgressController.updateManualProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(courseProgressService.updateManualProgress).not.toHaveBeenCalled();
    });

    it('should convert score to number if provided', async () => {
      req.body = { userId: 'u1', courseId: 'c1', type: 'questionnaire', itemId: 'q1', completed: true, score: '85' };
      (courseProgressService.updateManualProgress as jest.Mock).mockResolvedValue(mockProgress);

      await courseProgressController.updateManualProgress(req as Request, res as Response);

      expect(courseProgressService.updateManualProgress).toHaveBeenCalledWith(
        expect.objectContaining({ score: 85 })
      );
    });

    it('should return 500 on service error', async () => {
      req.body = { userId: 'u1', courseId: 'c1', type: 't', itemId: 'i1' };
      (courseProgressService.updateManualProgress as jest.Mock).mockRejectedValue(new Error('fail'));

      await courseProgressController.updateManualProgress(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
