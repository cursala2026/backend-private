/* eslint-env jest */
/**
 * Tests para la lógica de puntuación en CourseProgressRepository.updateQuestionnaireProgress
 *
 * Cubre:
 * - bestScore guarda el MÁXIMO histórico, no el último intento (Bug fix #1)
 * - completed es adhesivo: una vez aprobado no se revierte en reintento fallido (Bug fix #2)
 * - forceCompleted=true marca como completado ignorando passingScore (nueva feature)
 */

// Mockear CourseProgressModel ANTES de importar el repositorio
jest.mock('@/models/mongo/courseProgress.model', () => ({
  CourseProgressModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn(),
    deleteOne: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

import { CourseProgressModel } from '@/models/mongo/courseProgress.model';
import { courseProgressRepository } from '@/repositories/courseProgress.repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UID = 'aaaa00000000000000000001';
const CID = 'aaaa00000000000000000002';
const QID = 'aaaa00000000000000000003';

/** Retorna un progreso con un cuestionario ya registrado */
const makeExistingProgress = (existing: { completed: boolean; bestScore: number; attempts?: number }) => ({
  userId: UID,
  courseId: CID,
  classesProgress: [],
  questionnairesProgress: [
    {
      questionnaireId: QID,
      completed: existing.completed,
      bestScore: existing.bestScore,
      attempts: existing.attempts ?? 1,
      lastAttemptAt: new Date(),
    },
  ],
  overallProgress: 50,
  startedAt: new Date(),
  lastAccessedAt: new Date(),
});

/** Configura los mocks para la ruta "actualizar progreso existente" */
const setupUpdatePath = (existingProgress: any, passingScore: number) => {
  (CourseProgressModel.findOne as jest.Mock).mockReturnValue({
    lean: jest.fn().mockResolvedValue(existingProgress),
  });

  // this.Questionnaire.findById — retorna cuestionario con passingScore
  (courseProgressRepository as any).Questionnaire = {
    findById: jest.fn().mockResolvedValue({ passingScore }),
    countDocuments: jest.fn().mockResolvedValue(1),
  };

  // this.Class.countDocuments — 2 clases activas
  (courseProgressRepository as any).Class = {
    countDocuments: jest.fn().mockResolvedValue(2),
  };

  (CourseProgressModel.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
};

/** Extrae los questionnairesProgress del primer $set pasado a updateOne */
const captureQProgress = (): any[] => {
  const [, updateDoc] = (CourseProgressModel.updateOne as jest.Mock).mock.calls[0];
  return updateDoc.$set.questionnairesProgress;
};

// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// bestScore — debe guardar el MÁXIMO histórico
// ---------------------------------------------------------------------------

describe('updateQuestionnaireProgress — bestScore máximo histórico', () => {
  test('primer intento: bestScore = puntaje del intento', async () => {
    const progress = makeExistingProgress({ completed: false, bestScore: 0, attempts: 0 });
    // Simulamos que es el "primer" intento con existente para simplificar; puntaje 70
    setupUpdatePath(progress, 60);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 70);

    const qp = captureQProgress();
    expect(qp[0].bestScore).toBe(70);
    expect(qp[0].completed).toBe(true); // 70 >= 60 → passed
  });

  test('segundo intento con puntaje MENOR: bestScore se mantiene en el máximo anterior', async () => {
    // Primer intento: 80 puntos → aprobado
    const progress = makeExistingProgress({ completed: true, bestScore: 80, attempts: 1 });
    setupUpdatePath(progress, 60);

    // Segundo intento: 40 puntos → reprobado, pero bestScore debe seguir siendo 80
    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 40);

    const qp = captureQProgress();
    expect(qp[0].bestScore).toBe(80); // BUG FIX: max(80, 40) = 80
  });

  test('segundo intento con puntaje MAYOR: bestScore se actualiza al nuevo máximo', async () => {
    const progress = makeExistingProgress({ completed: true, bestScore: 60, attempts: 1 });
    setupUpdatePath(progress, 50);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 90);

    const qp = captureQProgress();
    expect(qp[0].bestScore).toBe(90); // max(60, 90) = 90
  });
});

// ---------------------------------------------------------------------------
// completed adhesivo — no se revierte tras reintento fallido
// ---------------------------------------------------------------------------

describe('updateQuestionnaireProgress — completed adhesivo', () => {
  test('reintento fallido NO revierte completed a false cuando ya estaba aprobado', async () => {
    // El alumno ya aprobó (completed=true, bestScore=75)
    const progress = makeExistingProgress({ completed: true, bestScore: 75, attempts: 1 });
    setupUpdatePath(progress, 60);

    // Nuevo intento con 30 puntos → no aprueba el passingScore
    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 30);

    const qp = captureQProgress();
    expect(qp[0].completed).toBe(true); // BUG FIX: true || false = true (adhesivo)
  });

  test('reintento con puntaje exactamente en el umbral: completed=true', async () => {
    const progress = makeExistingProgress({ completed: false, bestScore: 40, attempts: 1 });
    setupUpdatePath(progress, 70);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 70);

    const qp = captureQProgress();
    expect(qp[0].completed).toBe(true); // 70 >= 70 → pasa exactamente
  });
});

// ---------------------------------------------------------------------------
// forceCompleted — ignora passingScore (avance manual del profesor)
// ---------------------------------------------------------------------------

describe('updateQuestionnaireProgress — forceCompleted (avance manual del profesor)', () => {
  test('forceCompleted=true con puntaje debajo del umbral → completed=true', async () => {
    // passingScore=80, score=40: sin forceCompleted sería false
    const progress = makeExistingProgress({ completed: false, bestScore: 0, attempts: 0 });
    setupUpdatePath(progress, 80);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 40, true);

    const qp = captureQProgress();
    expect(qp[0].completed).toBe(true); // forceCompleted override
    expect(qp[0].bestScore).toBe(40);   // bestScore = max(0, 40) = 40
  });

  test('forceCompleted=true con puntaje=0 → completed=true (override explícito del profesor)', async () => {
    const progress = makeExistingProgress({ completed: false, bestScore: 0, attempts: 0 });
    setupUpdatePath(progress, 60);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 0, true);

    const qp = captureQProgress();
    expect(qp[0].completed).toBe(true); // El profesor lo marca como aprobado con nota 0
  });

  test('forceCompleted=undefined con puntaje debajo del umbral → completed=false (comportamiento normal)', async () => {
    const progress = makeExistingProgress({ completed: false, bestScore: 0, attempts: 0 });
    setupUpdatePath(progress, 60);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 30); // sin forceCompleted

    const qp = captureQProgress();
    expect(qp[0].completed).toBe(false); // 30 < 60, no pasa
  });

  test('forceCompleted=true NO revierte bestScore a un valor menor (max sigue aplicando)', async () => {
    // El alumno ya tenía bestScore=90; el profesor asigna manualmente 50
    const progress = makeExistingProgress({ completed: true, bestScore: 90, attempts: 2 });
    setupUpdatePath(progress, 60);

    await courseProgressRepository.updateQuestionnaireProgress(UID, CID, QID, 50, true);

    const qp = captureQProgress();
    expect(qp[0].bestScore).toBe(90); // max(90, 50) = 90, no se sobreescribe
    expect(qp[0].completed).toBe(true);
  });
});
