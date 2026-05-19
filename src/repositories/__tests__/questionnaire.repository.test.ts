import { Types } from 'mongoose';
import QuestionnaireRepository from '@/repositories/questionnaire.repository';

// Mock del modelo de Mongoose
const mockModel = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
};

// Mock de la conexión
const mockConnection = {
  model: jest.fn().mockReturnValue(mockModel),
} as any;

describe('QuestionnaireRepository', () => {
  let repository: QuestionnaireRepository;
  const validId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new QuestionnaireRepository(mockConnection);
  });

  // ==================== findById ====================

  describe('findById', () => {
    test('should return questionnaire when found', async () => {
      const mockQuestionnaire = { _id: validId, title: 'Test' };
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockQuestionnaire) });

      const result = await repository.findById(validId);

      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(result).toEqual(mockQuestionnaire);
    });

    test('should return null when not found', async () => {
      mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await repository.findById(validId);

      expect(result).toBeNull();
    });

    test('should throw error with statusCode 400 for invalid id', async () => {
      await expect(repository.findById('invalid-id')).rejects.toMatchObject({
        message: 'El ID del cuestionario proporcionado no es válido.',
        statusCode: 400,
      });
    });

    test('should throw error for empty string id', async () => {
      await expect(repository.findById('')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ==================== create ====================

  describe('create', () => {
    test('should create and return questionnaire', async () => {
      const data = { title: 'Nuevo cuestionario', courseId: new Types.ObjectId() as any };
      const created = { _id: validId, ...data };
      mockModel.create.mockResolvedValue(created);

      const result = await repository.create(data);

      expect(mockModel.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });

    test('should propagate error if model.create fails', async () => {
      mockModel.create.mockRejectedValue(new Error('DB error'));

      await expect(repository.create({})).rejects.toThrow('DB error');
    });
  });

  // ==================== update ====================

  describe('update', () => {
    test('should update and return questionnaire', async () => {
      const data = { title: 'Actualizado' };
      const updated = { _id: validId, ...data };
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await repository.update(validId, data);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(validId, data, { new: true });
      expect(result).toEqual(updated);
    });

    test('should throw error when questionnaire not found on update', async () => {
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(repository.update(validId, {})).rejects.toThrow('Questionnaire not found.');
    });

    test('should throw error for invalid id on update', async () => {
      await expect(repository.update('bad-id', {})).rejects.toThrow(
        'El ID del cuestionario proporcionado no es válido.'
      );
    });

    test('should assign _id to options without _id when updating questions', async () => {
      const data = {
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            questionText: 'Pregunta',
            options: [{ text: 'Opción A' }, { text: 'Opción B' }],
          } as any,
        ],
      };
      const updated = { _id: validId, ...data };
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      await repository.update(validId, data);

      // Verificar que se asignaron _ids a las opciones
      const options = data.questions[0].options;
      expect(options[0]._id).toBeDefined();
      expect(options[1]._id).toBeDefined();
    });

    test('should map numeric correctOptionIds to ObjectIds', async () => {
      const optionId0 = new Types.ObjectId();
      const optionId1 = new Types.ObjectId();
      const data = {
        questions: [
          {
            type: 'MULTIPLE_SELECT',
            questionText: 'Pregunta',
            options: [
              { _id: optionId0, text: 'A' },
              { _id: optionId1, text: 'B' },
            ],
            correctOptionIds: [0, 1], // índices numéricos
          } as any,
        ],
      };
      const updated = { _id: validId, ...data };
      mockModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      await repository.update(validId, data);

      const mappedIds = data.questions[0].correctOptionIds;
      expect(mappedIds[0]).toEqual(optionId0);
      expect(mappedIds[1]).toEqual(optionId1);
    });

    test('should throw if correctOptionIds has out-of-range index', async () => {
      const data = {
        questions: [
          {
            type: 'MULTIPLE_CHOICE',
            options: [{ _id: new Types.ObjectId(), text: 'A' }],
            correctOptionIds: [5], // índice fuera de rango
          } as any,
        ],
      };

      await expect(repository.update(validId, data)).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    test('should delete and return questionnaire', async () => {
      const deleted = { _id: validId, title: 'A eliminar' };
      mockModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(deleted) });

      const result = await repository.delete(validId);

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
      expect(result).toEqual(deleted);
    });

    test('should return null when questionnaire not found on delete', async () => {
      mockModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await repository.delete(validId);

      expect(result).toBeNull();
    });

    test('should throw error for invalid id on delete', async () => {
      await expect(repository.delete('not-an-id')).rejects.toThrow(
        'El ID del cuestionario proporcionado no es válido.'
      );
    });
  });

  // ==================== findByCourseId ====================

  describe('findByCourseId', () => {
    test('should return questionnaires ordered (BETWEEN_CLASSES first, FINAL_EXAM last)', async () => {
      const courseId = new Types.ObjectId().toString();
      const between = { _id: new Types.ObjectId(), position: { type: 'BETWEEN_CLASSES' } };
      const final = { _id: new Types.ObjectId(), position: { type: 'FINAL_EXAM' } };

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([final, between]),
        }),
      });

      const result = await repository.findByCourseId(courseId);

      // BETWEEN_CLASSES debe ir antes que FINAL_EXAM
      expect((result[0] as any).position.type).toBe('BETWEEN_CLASSES');
      expect((result[1] as any).position.type).toBe('FINAL_EXAM');
    });

    test('should throw error for invalid courseId', async () => {
      await expect(repository.findByCourseId('bad-id')).rejects.toThrow(
        'El ID del curso proporcionado no es válido.'
      );
    });
  });
});