
/* eslint-env jest */
import fs from 'fs';
import path from 'path';
import ClassService from '@/services/class.service';
import ClassRepository from '@/repositories/class.repository';
jest.mock('fs');
jest.mock('path');
jest.mock('@/repositories/class.repository');
const mockClassRepository: any = {
  findOneById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateWithOperators: jest.fn(),
  delete: jest.fn(),
  findAllByCourse: jest.fn(),
  changeStatus: jest.fn(),
  moveUpOrder: jest.fn(),
  moveDownOrder: jest.fn(),
  updateExamConfig: jest.fn(),
  getExamConfig: jest.fn(),
};
let classService: ClassService;
beforeEach(() => {
  jest.clearAllMocks();
  classService = new ClassService(mockClassRepository);
});
describe('ClassService', () => {
  describe('findOneById', () => {
    test('returns class with formatted exam config', async () => {
      const classData = { id: '1', examConfig: { examLink: 'link', examVisible: true, examStartDate: new Date(), examEndDate: new Date() } };
      mockClassRepository.findOneById.mockResolvedValue(classData);
      const result = await classService.findOneById('1');
      expect(result).toHaveProperty('examConfig');
      expect(mockClassRepository.findOneById).toHaveBeenCalledWith('1');
    });
    test('returns null if class not found', async () => {
      mockClassRepository.findOneById.mockResolvedValue(null);
      const result = await classService.findOneById('999');
      expect(result).toBeNull();
    });
  });
  describe('create', () => {
    test('creates class', async () => {
      const classData = { name: 'Class 1' };
      const created = { id: '1', ...classData };
      mockClassRepository.create.mockResolvedValue(created);
      const result = await classService.create(classData);
      expect(result).toEqual(created);
      expect(mockClassRepository.create).toHaveBeenCalledWith(classData);
    });
  });
  describe('update', () => {
    test('updates class', async () => {
      const updateData = { name: 'Updated' };
      const updated = { id: '1', name: 'Updated' };
      mockClassRepository.update.mockResolvedValue(updated);
      const result = await classService.update('1', updateData);
      expect(result).toEqual(updated);
      expect(mockClassRepository.update).toHaveBeenCalledWith('1', updateData);
    });
  });
  describe('delete', () => {
    test('deletes class and removes files', async () => {
      const classData = { id: '1', imageUrl: 'img.jpg', videoUrl: 'vid.mp4', supportMaterials: ['mat1.pdf'] };
      mockClassRepository.findOneById.mockResolvedValue(classData);
      mockClassRepository.delete.mockResolvedValue(classData);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const result = await classService.delete('1');
      expect(result).toEqual(classData);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
    });
  });
  describe('findAllByCourse', () => {
    test('returns classes with formatted exam configs', async () => {
      const classes = [{ id: '1', examConfig: { examLink: 'link', examVisible: true, examStartDate: new Date(), examEndDate: new Date() } }];
      mockClassRepository.findAllByCourse.mockResolvedValue(classes);
      const result = await classService.findAllByCourse('course-id');
      expect(result).toHaveLength(1);
      expect(mockClassRepository.findAllByCourse).toHaveBeenCalledWith('course-id');
    });
  });
  describe('changeStatus', () => {
    test('changes class status', async () => {
      const updated = { id: '1', status: 'ACTIVE' };
      mockClassRepository.changeStatus.mockResolvedValue(updated);
      const result = await classService.changeStatus('1', 'ACTIVE');
      expect(mockClassRepository.changeStatus).toHaveBeenCalledWith('1', 'ACTIVE');
    });
  });
  describe('getClassImage', () => {
    test('returns image buffer', async () => {
      const buffer = Buffer.from('image');
      (fs.readFileSync as jest.Mock).mockReturnValue(buffer);
      const result = await classService.getClassImage('img.jpg');
      expect(result).toEqual(buffer);
    });
    test('returns null if file not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await classService.getClassImage('nonexistent.jpg');
      expect(result).toBeNull();
    });
  });
  describe('updateExamConfig', () => {
    test('updates exam config successfully', async () => {
      const examConfig = { examLink: 'link', examVisible: true };
      const updated = { id: '1', examConfig };
      mockClassRepository.updateExamConfig.mockResolvedValue(updated);
      const result = await classService.updateExamConfig('1', examConfig);
      expect(result).toEqual(updated);
    });
    test('throws error if examConfig is empty', async () => {
      mockClassRepository.updateExamConfig.mockRejectedValue(new Error('La configuración del examen es requerida'));
      await expect(classService.updateExamConfig('1', {})).rejects.toThrow('La configuración del examen es requerida');
    });
  });
  describe('activateExam', () => {
    test('activates exam successfully', async () => {
      // Use a date far in the future to avoid timezone issues
      const examData = { examLink: 'link', examStartDate: '2099-01-01T10:00', examEndDate: '2099-01-01T12:00' };
      const updated = { id: '1', examConfig: { examLink: 'link', examVisible: true } };
      mockClassRepository.updateExamConfig.mockResolvedValue(updated);
      const result = await classService.activateExam('1', examData);
      expect(result).toEqual(updated);
    });
    test('throws error if examLink is empty', async () => {
      const examData = { examLink: '', examStartDate: '2099-01-01T10:00', examEndDate: '2099-01-01T12:00' };
      await expect(classService.activateExam('1', examData)).rejects.toThrow('El link del examen es obligatorio');
    });
  });
  describe('deactivateExam', () => {
    test('deactivates exam', async () => {
      const updated = { id: '1', examConfig: { examVisible: false } };
      mockClassRepository.updateExamConfig.mockResolvedValue(updated);
      const result = await classService.deactivateExam('1');
      expect(mockClassRepository.updateExamConfig).toHaveBeenCalledWith('1', { examVisible: false });
    });
  });
});
