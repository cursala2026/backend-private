import { QuestionnaireSchema, IQuestionnaire, QuestionnaireDoc, IQuestion } from '@/models/mongo/questionnaire.model';
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
    if (!id || !Types.ObjectId.isValid(id)) {
      const error = new Error('El ID del cuestionario proporcionado no es válido.');
      (error as any).statusCode = 400;
      throw error;
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
    // Normalizar possible payloads donde `questions[].correctOptionIds` venga como índices
    // (números o strings numéricos) y asegurar que cada opción tenga `_id` para que
    // Mongoose pueda castear a ObjectId correctamente.
    if (data.questions && Array.isArray(data.questions)) {
      for (let qi = 0; qi < data.questions.length; qi++) {
        const q: any = data.questions[qi] as any;
        // Asegurar que existan options y que cada option tenga _id (generar uno si falta)
        if (q.options && Array.isArray(q.options)) {
          for (let oi = 0; oi < q.options.length; oi++) {
            const opt = q.options[oi] as any;
            if (!opt._id) {
              opt._id = new Types.ObjectId();
            }
          }
        }

        // Mapear índices numéricos a los _id correspondientes
        if (q.correctOptionIds && Array.isArray(q.correctOptionIds)) {
          const idxs = q.correctOptionIds as any[];
          const needsMapping = idxs.some((x: any) => typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x)));
          if (needsMapping) {
            if (!q.options || !Array.isArray(q.options)) {
              throw {
                status: 400,
                key: 'validation.missing_options_for_mapping',
                message: 'No se pueden mapear correctOptionIds por índices sin `options` en la pregunta',
              };
            }
            q.correctOptionIds = idxs.map((v: any) => {
              const i = Number(v);
              const opt = q.options[i];
              if (!opt) throw {
                status: 400,
                key: 'validation.invalid_option_index',
                message: `Índice de opción inválido ${i} en la pregunta ${qi}`,
              };
              return opt._id;
            });
          }
        }
      }
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
      .sort({ 
        'position.type': -1,  // FINAL_EXAM (desc) va primero que BETWEEN_CLASSES, luego invertimos
        createdAt: 1 
      })
      .exec();
    
    // Separar y reordenar: BETWEEN_CLASSES primero, FINAL_EXAM al final
    const betweenClasses = questionnaires.filter((q: any) => q.position?.type === 'BETWEEN_CLASSES');
    const finalExams = questionnaires.filter((q: any) => q.position?.type === 'FINAL_EXAM');
    
    return [...betweenClasses, ...finalExams] as unknown as QuestionnaireDoc[];
  }

  /**
   * Encuentra todos los cuestionarios creados por un profesor
   * Busca en el array `teachers` (prioridad). La compatibilidad con `mainTeacher` fue eliminada.
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
            // Buscar únicamente en `course.teachers` (compatibilidad con `mainTeacher` eliminada)
            'course.teachers': professorObjectId
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
   * Actualiza campos de una pregunta específica dentro de un cuestionario
   * @param questionnaireId - ID del cuestionario
   * @param questionId - ID de la pregunta dentro del array
   * @param partialQuestion - Campos a actualizar en la pregunta
   * @returns El cuestionario actualizado
   */
  async updateQuestion(questionnaireId: string, questionId: string, partialQuestion: Partial<IQuestion>): Promise<QuestionnaireDoc> {
    if (!Types.ObjectId.isValid(questionnaireId) || !Types.ObjectId.isValid(questionId)) {
      throw new Error('Invalid IDs provided');
    }

    // Si se recibió correctOptionIds como índices (números o strings numéricos),
    // mapearlos a los _id de las opciones existentes para evitar CastError en Mongoose.
    if (partialQuestion.correctOptionIds && Array.isArray(partialQuestion.correctOptionIds)) {
      const idxs = partialQuestion.correctOptionIds;
      const needsMapping = idxs.some((x: any) => typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x)));
      if (needsMapping) {
        const found = await this.model.findOne({ _id: questionnaireId as any, 'questions._id': questionId as any }, { 'questions.$': 1 }).exec();
        const q = (found as any)?.questions?.[0];
        if (!q) throw {
          status: 400,
          key: 'validation.question_not_found_for_mapping',
          message: 'No se encontró la pregunta para mapear los índices de correctOptionIds',
        };
        const mapped = idxs.map((v: any) => {
          const i = Number(v);
          const opt = q.options && q.options[i];
          if (!opt) throw {
            status: 400,
            key: 'validation.invalid_option_index',
            message: `Índice de opción inválido ${i} para la pregunta ${questionId}`,
          };
          return opt._id;
        });
        partialQuestion.correctOptionIds = mapped as any;
      }
    }

    // Construir objeto $set con prefijo 'questions.$.'
    const setObj: any = {};
    for (const [k, v] of Object.entries(partialQuestion)) {
      setObj[`questions.$.${k}`] = v as any;
    }

    const updated = await this.model
      .findOneAndUpdate({ _id: questionnaireId as any, 'questions._id': questionId as any }, { $set: setObj }, { new: true })
      .exec();

    if (!updated) {
      throw new Error('Questionnaire or question not found');
    }

    return updated as unknown as QuestionnaireDoc;
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
