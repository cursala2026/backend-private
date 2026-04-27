/* eslint-env jest */
/**
 * Tests de puntuación para QuestionnaireSubmissionService
 *
 * Cubre:
 * - autoGradeMultipleChoice: MULTIPLE_CHOICE, MULTIPLE_SELECT, penalización, sin correctOptionIds
 * - calculateFinalScore: casos normales y borde (totalPoints=0)
 * - gradeTextQuestions: preserva selectedOptionIds en respuestas MC (Bug fix #3)
 * - autoGradedScore=0 cuando totalMCPoints=0 (no NaN)
 */

import QuestionnaireSubmissionService from '@/services/questionnaireSubmission.service';

// Mocks de dependencias externas requeridas por el servicio
jest.mock('@/utils/emailer', () => ({ sendEmail: jest.fn() }));
jest.mock('@/services/index', () => ({
  notificationService: { sendNotification: jest.fn() },
}));
jest.mock('@/repositories/courseProgress.repository', () => ({
  courseProgressRepository: { updateQuestionnaireProgress: jest.fn() },
}));
jest.mock('@/repositories', () => ({
  userRepository: { getUserById: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ID = (suffix: string) => `507f191e810c197${suffix}`;

const makeService = (
  submissionOverrides: Record<string, any> = {},
  questionnaireOverrides: Record<string, any> = {}
) => {
  const submissionRepository: any = {
    findById: jest.fn(),
    update: jest.fn().mockImplementation(async (_id: string, data: any) => data),
    ...submissionOverrides,
  };
  const questionnaireRepository: any = {
    findById: jest.fn(),
    ...questionnaireOverrides,
  };
  return new QuestionnaireSubmissionService(submissionRepository, questionnaireRepository);
};

// ---------------------------------------------------------------------------
// autoGradeMultipleChoice — accedido como método privado vía cast
// ---------------------------------------------------------------------------

describe('autoGradeMultipleChoice', () => {
  const svc = makeService();
  const grade = (questions: any[], answers: any[]) =>
    (svc as any).autoGradeMultipleChoice(questions, answers);

  const mcQuestion = (id: string, points: number, correctOptionId: string, options?: any[]) => ({
    _id: { toString: () => id },
    type: 'MULTIPLE_CHOICE',
    points,
    correctOptionId: { toString: () => correctOptionId },
    options: options ?? [],
  });

  const msQuestion = (id: string, points: number, correctOptionIds: string[]) => ({
    _id: { toString: () => id },
    type: 'MULTIPLE_SELECT',
    points,
    correctOptionIds: correctOptionIds.map((c) => ({ toString: () => c })),
  });

  test('MULTIPLE_CHOICE: respuesta correcta → puntos completos e isCorrect=true', () => {
    const q = mcQuestion('q1', 10, 'opt1');
    const answer = { questionId: { toString: () => 'q1' }, questionType: 'MULTIPLE_CHOICE', selectedOptionId: { toString: () => 'opt1' } };

    const { gradedAnswers, autoGradedScore } = grade([q], [answer]);

    expect(gradedAnswers[0].isCorrect).toBe(true);
    expect(gradedAnswers[0].pointsAwarded).toBe(10);
    expect(autoGradedScore).toBe(100);
  });

  test('MULTIPLE_CHOICE: respuesta incorrecta → 0 puntos e isCorrect=false', () => {
    const q = mcQuestion('q1', 10, 'opt1');
    const answer = { questionId: { toString: () => 'q1' }, questionType: 'MULTIPLE_CHOICE', selectedOptionId: { toString: () => 'opt_wrong' } };

    const { gradedAnswers, autoGradedScore } = grade([q], [answer]);

    expect(gradedAnswers[0].isCorrect).toBe(false);
    expect(gradedAnswers[0].pointsAwarded).toBe(0);
    expect(autoGradedScore).toBe(0);
  });

  test('MULTIPLE_SELECT: match exacto → puntos completos e isCorrect=true', () => {
    const q = msQuestion('q1', 10, ['opt1', 'opt2']);
    const answer = {
      questionId: { toString: () => 'q1' },
      questionType: 'MULTIPLE_SELECT',
      selectedOptionIds: [{ toString: () => 'opt1' }, { toString: () => 'opt2' }],
    };

    const { gradedAnswers, autoGradedScore } = grade([q], [answer]);

    expect(gradedAnswers[0].isCorrect).toBe(true);
    expect(gradedAnswers[0].pointsAwarded).toBe(10);
    expect(autoGradedScore).toBe(100);
  });

  test('MULTIPLE_SELECT: 1 correcta + 1 incorrecta de 2 correctas → penalización reduce puntos', () => {
    // correctas: opt1, opt2 — el alumno marca opt1 y opt_wrong
    // intersección=1, wrongSelections=1, correctCount=2
    // raw = (1 - 0.5*1)/2 = 0.25 → pointsAwarded = round(10 * 0.25) = 3
    const q = msQuestion('q1', 10, ['opt1', 'opt2']);
    const answer = {
      questionId: { toString: () => 'q1' },
      questionType: 'MULTIPLE_SELECT',
      selectedOptionIds: [{ toString: () => 'opt1' }, { toString: () => 'opt_wrong' }],
    };

    const { gradedAnswers, autoGradedScore } = grade([q], [answer]);

    expect(gradedAnswers[0].isCorrect).toBe(false); // no es match exacto
    expect(gradedAnswers[0].pointsAwarded).toBe(3);
    // totalMCPoints=10, earned=3 → score = round(3/10*100) = 30
    expect(autoGradedScore).toBe(30);
  });

  test('pregunta sin correctOptionIds configurados → 0 puntos, NO se cuenta en el total', () => {
    // Pregunta mal configurada (sin correctOptionId/correctOptionIds)
    const q = { _id: { toString: () => 'q1' }, type: 'MULTIPLE_CHOICE', points: 10 };
    const answer = { questionId: { toString: () => 'q1' }, questionType: 'MULTIPLE_CHOICE', selectedOptionId: { toString: () => 'opt1' } };

    const { gradedAnswers, autoGradedScore } = grade([q], [answer]);

    // No debe incluirse en totalMCPoints: autoGradedScore = 0 (no NaN)
    expect(gradedAnswers[0].pointsAwarded).toBe(0);
    expect(autoGradedScore).toBe(0);
    expect(Number.isNaN(autoGradedScore)).toBe(false);
  });

  test('correctOptionIds (array) tiene prioridad sobre correctOptionId (singular)', () => {
    // Si la pregunta tiene ambos, usa correctOptionIds
    const q = {
      _id: { toString: () => 'q1' },
      type: 'MULTIPLE_CHOICE',
      points: 10,
      correctOptionIds: [{ toString: () => 'opt_array' }],
      correctOptionId: { toString: () => 'opt_singular' },
    };
    // Respuesta correcta usando opt_array
    const answer = { questionId: { toString: () => 'q1' }, questionType: 'MULTIPLE_CHOICE', selectedOptionId: { toString: () => 'opt_array' } };

    const { gradedAnswers } = grade([q], [answer]);

    expect(gradedAnswers[0].isCorrect).toBe(true);
    expect(gradedAnswers[0].pointsAwarded).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// calculateFinalScore — accedido vía cast
// ---------------------------------------------------------------------------

describe('calculateFinalScore', () => {
  const svc = makeService();
  const calc = (questions: any[], answers: any[]) =>
    (svc as any).calculateFinalScore(questions, answers);

  test('combina puntos de MC y TEXT correctamente', () => {
    const questions = [
      { points: 10 },
      { points: 10 },
    ];
    // 6 puntos sobre 20 totales → 30%
    const answers = [
      { pointsAwarded: 6 },
      { pointsAwarded: 0 },
    ];
    expect(calc(questions, answers)).toBe(30);
  });

  test('totalPoints=0 devuelve 0 (no división por cero)', () => {
    expect(calc([], [])).toBe(0);
  });

  test('puntaje máximo 100% cuando todo está correcto', () => {
    const questions = [{ points: 5 }, { points: 5 }];
    const answers = [{ pointsAwarded: 5 }, { pointsAwarded: 5 }];
    expect(calc(questions, answers)).toBe(100);
  });

  test('finalScore=0 se preserva (no se trata como undefined/falsy)', () => {
    // 0 pts de 10 → 0%
    const questions = [{ points: 10 }];
    const answers = [{ pointsAwarded: 0 }];
    const score = calc(questions, answers);
    expect(score).toBe(0);
    // Verificar que 0 es truthy-safe: score ?? 100 debe ser 0, no 100
    expect(score ?? 100).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// gradeTextQuestions — preserva selectedOptionIds (Bug fix #3)
// ---------------------------------------------------------------------------

describe('gradeTextQuestions - preservación de selectedOptionIds', () => {
  const SUBMISSION_ID = ID('29de860ea');
  const QUESTIONNAIRE_ID = ID('29de860eb');
  const COURSE_ID = ID('29de860ec');
  const STUDENT_ID = ID('29de860ed');
  const PROFESSOR_ID = ID('29de860ee');
  const MC_Q_ID = ID('29de860ef');
  const TEXT_Q_ID = ID('29de860f0');
  const OPT1 = ID('29de860f1');
  const OPT2 = ID('29de860f2');

  const buildSubmission = (extraAnswerProps: Partial<any> = {}) => ({
    _id: SUBMISSION_ID,
    questionnaireId: QUESTIONNAIRE_ID,
    courseId: COURSE_ID,
    studentId: { toString: () => STUDENT_ID },
    studentEmail: 'alumno@test.com',
    studentName: 'Alumno Test',
    status: 'SUBMITTED',
    attemptNumber: 1,
    answers: [
      {
        // Respuesta MC con selección múltiple (MULTIPLE_SELECT)
        questionId: { toString: () => MC_Q_ID },
        questionType: 'MULTIPLE_SELECT',
        selectedOptionIds: [OPT1, OPT2],
        selectedOptionId: undefined,
        isCorrect: true,
        pointsAwarded: 5,
        feedback: undefined,
        ...extraAnswerProps,
      },
      {
        // Respuesta TEXT que el profesor va a calificar
        questionId: { toString: () => TEXT_Q_ID },
        questionType: 'TEXT',
        textAnswer: 'Mi respuesta de texto',
        selectedOptionIds: undefined,
        selectedOptionId: undefined,
        isCorrect: undefined,
        pointsAwarded: 0,
        feedback: undefined,
      },
    ],
  });

  const buildQuestionnaire = () => ({
    _id: QUESTIONNAIRE_ID,
    courseId: COURSE_ID,
    title: 'Test Questionnaire',
    isSurvey: false,
    questions: [
      { _id: MC_Q_ID, type: 'MULTIPLE_SELECT', points: 5 },
      { _id: TEXT_Q_ID, type: 'TEXT', points: 10 },
    ],
  });

  test('selectedOptionIds en respuesta MC se preserva tras gradeTextQuestions', async () => {
    const submission = buildSubmission();
    const questionnaire = buildQuestionnaire();

    const capturedUpdate: any = {};
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(submission),
        update: jest.fn().mockImplementation(async (_id: string, data: any) => {
          Object.assign(capturedUpdate, data);
          return { ...submission, ...data };
        }),
      },
      { findById: jest.fn().mockResolvedValue(questionnaire) }
    );

    await svc.gradeTextQuestions(
      SUBMISSION_ID,
      [{ questionId: TEXT_Q_ID, points: 8, feedback: 'Bien argumentado' }],
      PROFESSOR_ID
    );

    // El MC answer debe tener selectedOptionIds intactos
    const mcAnswer = capturedUpdate.answers?.find(
      (a: any) => a.questionId.toString() === MC_Q_ID
    );
    expect(mcAnswer).toBeDefined();
    expect(mcAnswer.selectedOptionIds).toEqual([OPT1, OPT2]);
  });

  test('respuesta TEXT también preserva selectedOptionIds (undefined en este caso)', async () => {
    const submission = buildSubmission();
    const questionnaire = buildQuestionnaire();

    const capturedUpdate: any = {};
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(submission),
        update: jest.fn().mockImplementation(async (_id: string, data: any) => {
          Object.assign(capturedUpdate, data);
          return { ...submission, ...data };
        }),
      },
      { findById: jest.fn().mockResolvedValue(questionnaire) }
    );

    await svc.gradeTextQuestions(
      SUBMISSION_ID,
      [{ questionId: TEXT_Q_ID, points: 7 }],
      PROFESSOR_ID
    );

    const textAnswer = capturedUpdate.answers?.find(
      (a: any) => a.questionId.toString() === TEXT_Q_ID
    );
    expect(textAnswer).toBeDefined();
    // TEXT questions don't have selectedOptionIds — preserved as undefined (no crash)
    expect(textAnswer.selectedOptionIds).toBeUndefined();
    // Puntuación del profesor aplicada correctamente
    expect(textAnswer.pointsAwarded).toBe(7);
  });

  test('finalScore se calcula combinando MC + TEXT calificados', async () => {
    // MC: 5 pts, TEXT: 8 pts → finalScore = round(13/15 * 100) = 87%
    const submission = buildSubmission();
    const questionnaire = buildQuestionnaire();

    let storedFinalScore: number | undefined;
    const svc = makeService(
      {
        findById: jest.fn().mockResolvedValue(submission),
        update: jest.fn().mockImplementation(async (_id: string, data: any) => {
          storedFinalScore = data.finalScore;
          return { ...submission, ...data };
        }),
      },
      { findById: jest.fn().mockResolvedValue(questionnaire) }
    );

    await svc.gradeTextQuestions(
      SUBMISSION_ID,
      [{ questionId: TEXT_Q_ID, points: 8 }],
      PROFESSOR_ID
    );

    expect(storedFinalScore).toBe(87); // round(13/15*100)=87
  });
});
