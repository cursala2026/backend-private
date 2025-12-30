import { QuestionnaireSchema, IQuestionnaire, QuestionnaireDoc } from '@/models/mongo/questionnaire.model';
import { Connection, Model, Types } from '@/models';

class QuestionnaireRepository {
  private readonly model: Model<IQuestionnaire>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IQuestionnaire>('Questionnaire', QuestionnaireSchema, 'questionnaires');
  }

  /**
   * Crea un nuevo cuestionario
   * @param data - Datos del cuestionario a crear
   * @returns El cuestionario creado
   */
  async create(data: Partial<IQuestionnaire>): Promise<QuestionnaireDoc> {
    const created = await this.model.create(data);
    return created as unknown as QuestionnaireDoc;
  }

  /**
   * Encuentra un cuestionario por su ID
   * @param id - ID del cuestionario
   * @returns El cuestionario encontrado o null si no existe
   */
  async findById(id: string): Promise<QuestionnaireDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }
    const res = await this.model.findById(id).exec();
    return res as unknown as QuestionnaireDoc | null;
  }

  /**
   * Actualiza un cuestionario existente
   * @param id - ID del cuestionario
   * @param data - Datos a actualizar
   * @returns El cuestionario actualizado
   */
  async update(id: string, data: Partial<IQuestionnaire>): Promise<QuestionnaireDoc> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }
    const updated = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updated) {
      throw new Error('Questionnaire not found.');
    }
    return updated as unknown as QuestionnaireDoc;
  }

  /**
   * Elimina un cuestionario por su ID
   * @param id - ID del cuestionario
   * @returns El cuestionario eliminado o null si no existe
   */
  async delete(id: string): Promise<QuestionnaireDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndDelete(id).exec();
    return res as unknown as QuestionnaireDoc | null;
  }

  /**
   * Encuentra todos los cuestionarios de un curso
   * @param courseId - ID del curso
   * @returns Lista de cuestionarios ordenados por posición
   */
  async findByCourseId(courseId: string): Promise<QuestionnaireDoc[]> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const questionnaires = await this.model
      .find({ courseId: courseId as any })
      .sort({ 'position.type': 1, createdAt: 1 })
      .exec();
    return questionnaires as unknown as QuestionnaireDoc[];
  }

  /**
   * Encuentra todos los cuestionarios creados por un profesor
   * Busca en el array teachers (prioridad) y mainTeacher (compatibilidad)
   * @param professorId - ID del profesor
   * @returns Lista de cuestionarios del profesor
   */
  async findByProfessorId(professorId: string): Promise<QuestionnaireDoc[]> {
    if (!Types.ObjectId.isValid(professorId)) {
      throw new Error('El ID del profesor proporcionado no es válido.');
    }

    const professorObjectId = new Types.ObjectId(professorId);

    const questionnaires = await this.model
      .aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
          },
        },
        { $unwind: '$course' },
        {
          $match: {
            $or: [
              // Prioridad: buscar en el array teachers
              { 'course.teachers': professorObjectId },
              // Compatibilidad: buscar en mainTeacher solo si no tiene teachers o el profesor no está en teachers
              {
                $and: [
                  { 'course.mainTeacher': professorObjectId },
                  {
                    $or: [
                      { 'course.teachers': { $exists: false } },
                      { 'course.teachers': { $size: 0 } },
                      { 'course.teachers': { $ne: professorObjectId } }
                    ]
                  }
                ]
              }
            ]
          },
        },
        { $sort: { 'course.name': 1, 'position.type': 1, createdAt: 1 } },
      ])
      .exec();

    return questionnaires as unknown as QuestionnaireDoc[];
  }

  /**
   * Encuentra un cuestionario posicionado después de una clase específica
   * @param courseId - ID del curso
   * @param afterClassId - ID de la clase después de la cual está el cuestionario
   * @returns El cuestionario encontrado o null
   */
  async findByPosition(courseId: string, afterClassId: string): Promise<QuestionnaireDoc | null> {
    if (!Types.ObjectId.isValid(courseId) || !Types.ObjectId.isValid(afterClassId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const questionnaire = await this.model
      .findOne({
        courseId: courseId as any,
        'position.type': 'BETWEEN_CLASSES',
        'position.afterClassId': afterClassId as any,
      })
      .exec();

    return questionnaire as unknown as QuestionnaireDoc | null;
  }

  /**
   * Encuentra el examen final de un curso
   * @param courseId - ID del curso
   * @returns El cuestionario de examen final o null
   */
  async findFinalExam(courseId: string): Promise<QuestionnaireDoc | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    const questionnaire = await this.model
      .findOne({
        courseId: courseId as any,
        'position.type': 'FINAL_EXAM',
      })
      .exec();

    return questionnaire as unknown as QuestionnaireDoc | null;
  }

  /**
   * Verifica si un cuestionario tiene envíos activos de estudiantes
   * @param questionnaireId - ID del cuestionario
   * @returns true si tiene envíos, false si no
   */
  async hasActiveSubmissions(questionnaireId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }

    // This will be implemented by checking the QuestionnaireSubmission collection
    // For now, we'll return false as a placeholder
    // The actual implementation will be in the service layer using QuestionnaireSubmissionRepository
    return false;
  }

  /**
   * Cuenta el número de cuestionarios en un curso
   * @param courseId - ID del curso
   * @returns Número de cuestionarios
   */
  async countQuestionnairesByCourse(courseId: string): Promise<number> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    return await this.model.countDocuments({ courseId: courseId as any }).exec();
  }
}

export default QuestionnaireRepository;
