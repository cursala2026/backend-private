import QuestionnaireService from '@/services/questionnaire.service';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';

// --- MOCKS DE DEPENDENCIAS ---
jest.mock('@/services/questionMedia.service', () => {
  return jest.fn().mockImplementation(() => ({
    uploadImage: jest.fn(),
    uploadVideo: jest.fn(),
    deleteMedia: jest.fn(),
  }));
});

jest.mock('@/utils', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

describe('QuestionnaireService DRAFT and validation unit tests', () => {
  const mockCourseId = new Types.ObjectId().toString();
  const mockCreatorId = new Types.ObjectId().toString();
  const mockQuestionnaireId = new Types.ObjectId().toString();

  const makeService = (
    questionnaireRepoOverrides: any = {},
    submissionRepoOverrides: any = {}
  ) => {
    const mockQuestionnaireDoc: any = {
      _id: mockQuestionnaireId,
      courseId: mockCourseId,
      title: 'Cuestionario de prueba',
      status: 'ACTIVE',
      position: { type: 'FINAL_EXAM' },
      questions: [],
      save: (jest.fn() as any).mockResolvedValue(true),
    };

    const questionnaireRepository: any = {
      create: jest.fn().mockImplementation(async (data: any) => {
        const doc: any = {
          _id: mockQuestionnaireId,
          ...data,
          save: (jest.fn() as any).mockResolvedValue(true),
        };
        return doc;
      }),
      findById: jest.fn().mockImplementation(async () => ({
        ...mockQuestionnaireDoc,
        ...questionnaireRepoOverrides,
      })),
      update: jest.fn().mockImplementation(async (id: any, data: any) => ({
        ...mockQuestionnaireDoc,
        ...questionnaireRepoOverrides,
        ...data,
        save: (jest.fn() as any).mockResolvedValue(true),
      })),
    };

    const submissionRepository: any = {
      hasSubmissions: (jest.fn() as any).mockResolvedValue(false),
    };

    return new QuestionnaireService(questionnaireRepository, submissionRepository);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Questionnaire validations', () => {
    test('should allow creating a questionnaire as DRAFT without questions', async () => {
      const service = makeService();
      const draftData = {
        courseId: new Types.ObjectId(mockCourseId) as any,
        title: 'Borrador inicial',
        status: 'DRAFT',
        // Sin preguntas
      };

      const result = await service.create(draftData, mockCreatorId);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.questions).toBeUndefined();
    });

    test('should throw error when creating an ACTIVE questionnaire without questions', async () => {
      const service = makeService();
      const activeData = {
        courseId: new Types.ObjectId(mockCourseId) as any,
        title: 'Examen Activo',
        status: 'ACTIVE',
        questions: [], // vacío
      };

      await expect(service.create(activeData, mockCreatorId))
        .rejects.toThrow('At least one question is required');
    });

    test('should allow creating a DRAFT without position defined', async () => {
      const service = makeService();
      const draftData = {
        courseId: new Types.ObjectId(mockCourseId) as any,
        title: 'Borrador sin posicion',
        status: 'DRAFT',
        // posición ausente
      };

      const result = await service.create(draftData, mockCreatorId);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.position).toBeUndefined();
    });

    test('should allow creating a DRAFT with position BETWEEN_CLASSES but without afterClassId', async () => {
      const service = makeService();
      const draftData = {
        courseId: new Types.ObjectId(mockCourseId) as any,
        title: 'Borrador con posicion incompleta',
        status: 'DRAFT',
        position: {
          type: 'BETWEEN_CLASSES' as any,
          // afterClassId ausente
        }
      };

      const result = await service.create(draftData, mockCreatorId);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.position?.type).toBe('BETWEEN_CLASSES');
    });

    test('should throw error when creating an ACTIVE questionnaire with position BETWEEN_CLASSES but without afterClassId', async () => {
      const service = makeService();
      const activeData = {
        courseId: new Types.ObjectId(mockCourseId) as any,
        title: 'Examen Activo Incompleto',
        status: 'ACTIVE',
        questions: [{ type: 'TEXT', questionText: 'Q1', order: 0, points: 10, required: true } as any],
        position: {
          type: 'BETWEEN_CLASSES' as any,
          // afterClassId ausente
        }
      };

      await expect(service.create(activeData, mockCreatorId))
        .rejects.toThrow('afterClassId is required when position type is BETWEEN_CLASSES');
    });
  });

  describe('Update Questionnaire validations', () => {
    test('should allow updating a DRAFT questionnaire with MC question but no correct answers', async () => {
      const service = makeService({ status: 'DRAFT' });
      const updateData = {
        title: 'Borrador editado',
        status: 'DRAFT',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            questionText: 'Pregunta sin respuesta',
            order: 0,
            points: 10,
            required: true,
            options: [
              { text: 'Opción A', order: 0 },
              { text: 'Opción B', order: 1 }
            ],
            // correctOptionId ausente en borrador
          } as any
        ]
      };

      const result = await service.update(mockQuestionnaireId, updateData);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
    });

    test('should throw error when updating an ACTIVE questionnaire with MC question and no correct answers', async () => {
      const service = makeService({ status: 'ACTIVE' });
      const updateData = {
        title: 'Examen Activo Editado',
        status: 'ACTIVE',
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            questionText: 'Pregunta activa sin respuesta',
            order: 0,
            points: 10,
            required: true,
            options: [
              { text: 'Opción A', order: 0 },
              { text: 'Opción B', order: 1 }
            ],
            // correctOptionId ausente
          } as any
        ]
      };

      await expect(service.update(mockQuestionnaireId, updateData))
        .rejects.toThrow(/must have at least one correct answer/);
    });

    test('should allow updating a DRAFT questionnaire with position BETWEEN_CLASSES but without afterClassId', async () => {
      const service = makeService({ status: 'DRAFT' });
      const updateData = {
        status: 'DRAFT',
        position: {
          type: 'BETWEEN_CLASSES' as any,
          // afterClassId ausente
        }
      };

      const result = await service.update(mockQuestionnaireId, updateData);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.position?.type).toBe('BETWEEN_CLASSES');
    });

    test('should throw error when updating a questionnaire to ACTIVE with position BETWEEN_CLASSES but without afterClassId', async () => {
      // El cuestionario actual es DRAFT, se intenta actualizar a ACTIVE con datos incompletos
      const service = makeService({ status: 'DRAFT' });
      const updateData = {
        status: 'ACTIVE',
        position: {
          type: 'BETWEEN_CLASSES' as any,
          // afterClassId ausente
        }
      };

      await expect(service.update(mockQuestionnaireId, updateData))
        .rejects.toThrow('afterClassId is required when position type is BETWEEN_CLASSES');
    });
  });
});
