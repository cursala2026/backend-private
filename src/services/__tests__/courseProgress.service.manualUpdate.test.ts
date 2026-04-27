/* eslint-env jest */
/**
 * Tests para CourseProgressService
 *
 * Cubre el flujo del profesor:
 * - updateManualProgress: pasa forceCompleted=true al marcar cuestionario como completado
 * - updateManualProgress: early returns cuando !completed evitan crear submissions fantasma (Bug fix #2)
 * - updateManualProgress: score=0 con completed=true se maneja correctamente (??  vs ||)
 * - canAccessClass: isSurvey=true bypasea el bloqueo por SUBMITTED (Bug fix duplicado)
 * - canAccessClass: non-survey con SUBMITTED bloquea correctamente
 */

// Mockear repositorios ANTES de importar el servicio (Jest hoisting)
jest.mock('@/repositories', () => ({
  courseProgressRepository: {
    findByUserAndCourse: jest.fn(),
    updateQuestionnaireProgress: jest.fn(),
    getTotalClasses: jest.fn(),
    getTotalQuestionnaires: jest.fn(),
    saveManualUpdate: jest.fn(),
    deleteByUserAndCourse: jest.fn(),
    updateOverallProgress: jest.fn(),
    upsert: jest.fn(),
  },
  courseRepository: {
    findOneById: jest.fn(),
  },
  questionnaireRepository: {
    findByCourseId: jest.fn(),
  },
  questionnaireSubmissionRepository: {
    findByStudentAndQuestionnaire: jest.fn(),
    deleteByStudentAndQuestionnaire: jest.fn(),
    getNextAttemptNumber: jest.fn().mockResolvedValue(1),
    create: jest.fn(),
    update: jest.fn(),
    deleteByStudentAndCourse: jest.fn(),
  },
  userRepository: {
    findById: jest.fn(),
    getUserById: jest.fn(),
  },
}));

import { courseProgressService } from '@/services/courseProgress.service';
import {
  courseProgressRepository,
  courseRepository,
  questionnaireRepository,
  questionnaireSubmissionRepository,
  userRepository,
} from '@/repositories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UID  = 'bbbb00000000000000000001';
const CID  = 'bbbb00000000000000000002';
const QID  = 'bbbb00000000000000000003';
const CL1  = 'bbbb00000000000000000004'; // class 1
const CL2  = 'bbbb00000000000000000005'; // class 2

const mockProgress = (questCompleted: boolean, bestScore = 70) => ({
  userId: UID,
  courseId: CID,
  classesProgress: [{ classId: CL1, completed: true }],
  questionnairesProgress: [
    { questionnaireId: QID, completed: questCompleted, bestScore, attempts: 1 },
  ],
  overallProgress: 50,
  startedAt: new Date(),
  lastAccessedAt: new Date(),
});

beforeEach(() => {
  jest.clearAllMocks();

  // Defaults razonables para no tener que repetir en cada test
  (courseProgressRepository.getTotalClasses as jest.Mock).mockResolvedValue(2);
  (courseProgressRepository.getTotalQuestionnaires as jest.Mock).mockResolvedValue(1);
  (courseProgressRepository.updateQuestionnaireProgress as jest.Mock).mockResolvedValue(mockProgress(true));
  (courseProgressRepository.saveManualUpdate as jest.Mock).mockResolvedValue(undefined);
  // findByCourseId se usa para recalcular totalQuestionnairesCount al desmarcar
  (questionnaireRepository.findByCourseId as jest.Mock).mockResolvedValue([
    { _id: QID, status: 'ACTIVE' },
  ]);
  (userRepository.findById as jest.Mock).mockResolvedValue({
    firstName: 'Test', lastName: 'User', email: 'test@test.com', profilePhotoUrl: '',
  });
  (questionnaireSubmissionRepository.findByStudentAndQuestionnaire as jest.Mock).mockResolvedValue([]);
  (questionnaireSubmissionRepository.create as jest.Mock).mockResolvedValue({});
});

// ===========================================================================
// updateManualProgress — flujo del profesor
// ===========================================================================

describe('updateManualProgress — marcar cuestionario como completado', () => {
  test('llama a updateQuestionnaireProgress con forceCompleted=true', async () => {
    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: true,
      score: 75,
    });

    expect(courseProgressRepository.updateQuestionnaireProgress).toHaveBeenCalledWith(
      UID, CID, QID, 75, true
    );
  });

  test('score=0 con completed=true → pasa finalScore=0 (no usa 100 como fallback)', async () => {
    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: true,
      score: 0,
    });

    expect(courseProgressRepository.updateQuestionnaireProgress).toHaveBeenCalledWith(
      UID, CID, QID, 0, true // finalScore=0, no 100
    );
  });

  test('score=undefined con completed=true → usa 100 como default (behavior correcto)', async () => {
    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: true,
      // score no se pasa
    });

    expect(courseProgressRepository.updateQuestionnaireProgress).toHaveBeenCalledWith(
      UID, CID, QID, 100, true
    );
  });
});

describe('updateManualProgress — desmarcar cuestionario (completed=false)', () => {
  test('qpIndex encontrado: guarda saveManualUpdate, NO crea submission fantasma', async () => {
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue(mockProgress(true));

    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: false,
    });

    expect(courseProgressRepository.saveManualUpdate).toHaveBeenCalledTimes(1);
    // NO debe crear ni buscar submissions
    expect(questionnaireSubmissionRepository.findByStudentAndQuestionnaire).not.toHaveBeenCalled();
    expect(questionnaireSubmissionRepository.create).not.toHaveBeenCalled();
  });

  test('cuestionario NO está en questionnairesProgress: early return, sin submission fantasma', async () => {
    // Progress que no tiene el cuestionario QID
    const progressWithoutQ = {
      ...mockProgress(false),
      questionnairesProgress: [], // QID no está en este array
    };
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue(progressWithoutQ);

    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: false,
    });

    // No debe crear submission fantasma
    expect(questionnaireSubmissionRepository.create).not.toHaveBeenCalled();
    // No debe llamar saveManualUpdate (no hay nada que actualizar)
    expect(courseProgressRepository.saveManualUpdate).not.toHaveBeenCalled();
  });

  test('progreso null: early return sin crear submission fantasma', async () => {
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue(null);

    await courseProgressService.updateManualProgress({
      userId: UID,
      courseId: CID,
      type: 'questionnaire',
      itemId: QID,
      completed: false,
    });

    // Llama a updateQuestionnaireProgress con score=0 (para crear registro vacío)
    expect(courseProgressRepository.updateQuestionnaireProgress).toHaveBeenCalledWith(
      UID, CID, QID, 0
    );
    // Pero NO crea una submission
    expect(questionnaireSubmissionRepository.create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// canAccessClass — isSurvey bypass y pendingSubmission
// ===========================================================================

describe('canAccessClass — control de acceso entre clases', () => {
  const firstClass = { _id: { toString: () => CL1 } };
  const secondClass = { _id: { toString: () => CL2 } };

  beforeEach(() => {
    // Progreso por defecto: clase 1 completada, cuestionario completado
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue(mockProgress(true));
  });

  test('primera clase (index 0) siempre es accesible', async () => {
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass],
    });

    const result = await courseProgressService.canAccessClass(UID, CID, CL1);

    expect(result.canAccess).toBe(true);
  });

  test('clase anterior NO completada → bloquea acceso', async () => {
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass, secondClass],
    });
    // Clase anterior sin completar
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue({
      classesProgress: [{ classId: CL1, completed: false }],
      questionnairesProgress: [],
      overallProgress: 0,
    });

    const result = await courseProgressService.canAccessClass(UID, CID, CL2);

    expect(result.canAccess).toBe(false);
    expect(result.reason).toMatch(/anterior/);
  });

  test('cuestionario entre clases completado → permite acceso a la siguiente', async () => {
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass, secondClass],
    });
    (questionnaireRepository.findByCourseId as jest.Mock).mockResolvedValue([
      {
        _id: QID,
        status: 'ACTIVE',
        position: { type: 'BETWEEN_CLASSES', afterClassId: CL1 },
        isSurvey: false,
      },
    ]);
    (questionnaireSubmissionRepository.findByStudentAndQuestionnaire as jest.Mock).mockResolvedValue([]);

    const result = await courseProgressService.canAccessClass(UID, CID, CL2);

    expect(result.canAccess).toBe(true);
  });

  test('non-survey con submission SUBMITTED → bloquea (pendiente de corrección)', async () => {
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass, secondClass],
    });
    (questionnaireRepository.findByCourseId as jest.Mock).mockResolvedValue([
      {
        _id: QID,
        status: 'ACTIVE',
        position: { type: 'BETWEEN_CLASSES', afterClassId: CL1 },
        isSurvey: false,
      },
    ]);
    // Hay una submission pendiente de calificación manual
    (questionnaireSubmissionRepository.findByStudentAndQuestionnaire as jest.Mock).mockResolvedValue([
      { status: 'SUBMITTED' },
    ]);

    const result = await courseProgressService.canAccessClass(UID, CID, CL2);

    expect(result.canAccess).toBe(false);
    expect(result.reason).toMatch(/profesor/);
  });

  test('isSurvey=true con submission SUBMITTED → NO bloquea (bug fix: elimina bloque duplicado)', async () => {
    // Las encuestas nunca deberían quedar SUBMITTED, pero si ocurre por edge case,
    // el flag isSurvey debe bypassear el bloqueo.
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass, secondClass],
    });
    (questionnaireRepository.findByCourseId as jest.Mock).mockResolvedValue([
      {
        _id: QID,
        status: 'ACTIVE',
        position: { type: 'BETWEEN_CLASSES', afterClassId: CL1 },
        isSurvey: true, // ← encuesta
      },
    ]);
    (questionnaireSubmissionRepository.findByStudentAndQuestionnaire as jest.Mock).mockResolvedValue([
      { status: 'SUBMITTED' }, // edge case: encuesta con estado SUBMITTED
    ]);
    // El progreso ya marca la encuesta como completada
    // (mockProgress ya tiene QID completado)

    const result = await courseProgressService.canAccessClass(UID, CID, CL2);

    // BUG FIX: antes bloqueaba por el segundo `if (pendingSubmission)` duplicado
    expect(result.canAccess).toBe(true);
  });

  test('cuestionario entre clases NO completado (sin submissions) → bloquea', async () => {
    (courseRepository.findOneById as jest.Mock).mockResolvedValue({
      classes: [firstClass, secondClass],
    });
    (questionnaireRepository.findByCourseId as jest.Mock).mockResolvedValue([
      {
        _id: QID,
        status: 'ACTIVE',
        position: { type: 'BETWEEN_CLASSES', afterClassId: CL1 },
        isSurvey: false,
      },
    ]);
    (questionnaireSubmissionRepository.findByStudentAndQuestionnaire as jest.Mock).mockResolvedValue([]);
    // El progreso indica que el cuestionario NO está completado
    (courseProgressRepository.findByUserAndCourse as jest.Mock).mockResolvedValue(mockProgress(false));

    const result = await courseProgressService.canAccessClass(UID, CID, CL2);

    expect(result.canAccess).toBe(false);
    expect(result.reason).toMatch(/cuestionario/);
  });
});
