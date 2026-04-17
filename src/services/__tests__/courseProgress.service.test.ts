import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';

// ==========================================================
jest.mock('@/repositories', () => ({
  courseProgressRepository: {
    findByUserAndCourse: jest.fn(),
    getTotalClasses: jest.fn(),
    getTotalQuestionnaires: jest.fn(),
    updateQuestionnaireProgress: jest.fn(),
    updateOverallProgress: jest.fn(), // <--- EL FIX ESTÁ ACÁ
    save: jest.fn()
  },
  courseRepository: { findById: jest.fn() },
  questionnaireRepository: { findById: jest.fn() },
  questionnaireSubmissionRepository: { find: jest.fn() },
  userRepository: { findById: jest.fn() }
}));

import { courseProgressRepository } from '@/repositories';


import { courseProgressService } from '../courseProgress.service';
describe('CourseProgressService - Unit Tests Task #14', () => {
  const mockUserId = new Types.ObjectId().toString();
  const mockCourseId = new Types.ObjectId().toString();

  // Objeto base simulando el progreso guardado en la base de datos
  const mockProgressData: any = {
    userId: mockUserId,
    courseId: mockCourseId,
    classesProgress: [{ classId: 'c1', completed: true }], // <-- FIX: Antes decía solo 'classes'
    questionnairesProgress: [{ questionnaireId: 'q1', score: 100, completed: true }], // <-- FIX: Antes decía solo 'questionnaires'
    overallProgress: 0, 
    save: jest.fn().mockImplementation(async () => true)
  };

  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================
  // LÓGICA DE ENCUESTAS Y PROGRESO 
  // ==========================================================
  describe('Cálculo de Ítems Totales y Progreso', () => {
    
    test('debería recalcular el progreso incluyendo cuestionarios (encuestas + exámenes)', async () => {
      // 1. Setup: Simulamos que el usuario tiene progreso registrado
      (courseProgressRepository.findByUserAndCourse as jest.Mock).mockImplementation(async () => mockProgressData);
      
      // 2. Setup: Simulamos que el curso tiene 2 clases y 2 cuestionarios (1 examen, 1 encuesta) = 4 ítems totales
      (courseProgressRepository.getTotalClasses as jest.Mock).mockImplementation(async () => 2);
      (courseProgressRepository.getTotalQuestionnaires as jest.Mock).mockImplementation(async () => 2);

      // 3. Ejecución
      // Nota: Si exportás la clase en tu archivo real, usá `service.getProgress`
      const result = await (courseProgressService as any).getProgress(mockUserId, mockCourseId);

      // 4. Verificación de Auditoría
      expect(courseProgressRepository.getTotalClasses).toHaveBeenCalledWith(mockCourseId);
      expect(courseProgressRepository.getTotalQuestionnaires).toHaveBeenCalledWith(mockCourseId);
      
      // Aseguramos que la lógica haya pasado por el bloque de recálculo (if progress)
      expect(courseProgressRepository.getTotalQuestionnaires).toHaveBeenCalledTimes(1);
    });

    test('debería devolver null si el usuario no tiene progreso en el curso', async () => {
      // Simulamos que es la primera vez que entra y no hay documento
      (courseProgressRepository.findByUserAndCourse as jest.Mock).mockImplementation(async () => null);

      const result = await (courseProgressService as any).getProgress(mockUserId, mockCourseId);

      expect(result).toBeNull();
      // Como no hay progreso previo, no debería intentar recalcular
      expect(courseProgressRepository.getTotalClasses).not.toHaveBeenCalled();
    });
  });
});
