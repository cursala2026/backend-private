import {
  QuestionnaireSubmissionSchema,
  IQuestionnaireSubmission,
  QuestionnaireSubmissionDoc,
} from '@/models/mongo/questionnaireSubmission.model';
import { Connection, Model, Types } from '@/models';

interface GradeReportEntry {
  studentId: Types.ObjectId;
  studentName: string;
  studentEmail: string;
  profilePhotoUrl?: string;
  attemptCount: number;
  bestScore: number | null;
  lastAttempt: Date | null;
  allSubmissions: IQuestionnaireSubmission[];
}

class QuestionnaireSubmissionRepository {
  private readonly model: Model<IQuestionnaireSubmission>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IQuestionnaireSubmission>(
      'QuestionnaireSubmission',
      QuestionnaireSubmissionSchema,
      'questionnaireSubmissions'
    );
  }

  /**
   * Crea un nuevo envío de cuestionario
   * @param data - Datos del envío a crear
   * @returns El envío creado
   */
  async create(data: Partial<IQuestionnaireSubmission>): Promise<QuestionnaireSubmissionDoc> {
    const created = await this.model.create(data);
    return created as unknown as QuestionnaireSubmissionDoc;
  }

  /**
   * Encuentra un envío por su ID
   * @param id - ID del envío
   * @returns El envío encontrado o null si no existe
   */
  async findById(id: string): Promise<QuestionnaireSubmissionDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del envío proporcionado no es válido.');
    }
    const res = await this.model.findById(id).exec();
    return res as unknown as QuestionnaireSubmissionDoc | null;
  }

  /**
   * Actualiza un envío existente
   * @param id - ID del envío
   * @param data - Datos a actualizar
   * @returns El envío actualizado
   */
  async update(id: string, data: Partial<IQuestionnaireSubmission>): Promise<QuestionnaireSubmissionDoc> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del envío proporcionado no es válido.');
    }
    const updated = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updated) {
      throw new Error('Submission not found.');
    }
    return updated as unknown as QuestionnaireSubmissionDoc;
  }

  /**
   * Encuentra todos los envíos de un estudiante para un cuestionario
   * @param studentId - ID del estudiante
   * @param questionnaireId - ID del cuestionario
   * @returns Lista de envíos ordenados por número de intento
   */
  async findByStudentAndQuestionnaire(
    studentId: string,
    questionnaireId: string
  ): Promise<QuestionnaireSubmissionDoc[]> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const submissions = await this.model
      .find({
        studentId: studentId as any,
        questionnaireId: questionnaireId as any,
      })
      .sort({ attemptNumber: 1 })
      .exec();

    return submissions as unknown as QuestionnaireSubmissionDoc[];
  }

  /**
   * Obtiene el mejor envío de un estudiante (por puntaje final)
   * @param studentId - ID del estudiante
   * @param questionnaireId - ID del cuestionario
   * @returns El mejor envío o null si no hay envíos
   */
  async getBestSubmission(
    studentId: string,
    questionnaireId: string
  ): Promise<QuestionnaireSubmissionDoc | null> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const submission = await this.model
      .findOne({
        studentId: studentId as any,
        questionnaireId: questionnaireId as any,
        status: 'GRADED',
      })
      .sort({ finalScore: -1 })
      .exec();

    return submission as unknown as QuestionnaireSubmissionDoc | null;
  }

  /**
   * Calcula el siguiente número de intento para un estudiante
   * @param studentId - ID del estudiante
   * @param questionnaireId - ID del cuestionario
   * @returns El siguiente número de intento
   */
  async getNextAttemptNumber(studentId: string, questionnaireId: string): Promise<number> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const lastSubmission = await this.model
      .findOne({
        studentId: studentId as any,
        questionnaireId: questionnaireId as any,
      })
      .sort({ attemptNumber: -1 })
      .exec() as QuestionnaireSubmissionDoc | null;

    return lastSubmission ? lastSubmission.attemptNumber + 1 : 1;
  }

  /**
   * Encuentra envíos pendientes de calificación manual (tienen preguntas de texto)
   * @param questionnaireId - ID del cuestionario
   * @returns Lista de envíos pendientes de calificación
   */
  async findPendingGrading(questionnaireId: string): Promise<QuestionnaireSubmissionDoc[]> {
    if (!Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }

    const submissions = await this.model
      .find({
        questionnaireId: questionnaireId as any,
        status: 'SUBMITTED', // Not yet fully graded
      })
      .sort({ submittedAt: 1 })
      .exec();

    return submissions as unknown as QuestionnaireSubmissionDoc[];
  }

  /**
   * Encuentra todos los envíos de un cuestionario
   * @param questionnaireId - ID del cuestionario
   * @returns Lista de todos los envíos
   */
  async findAllByQuestionnaire(questionnaireId: string): Promise<QuestionnaireSubmissionDoc[]> {
    if (!Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }

    const submissions = await this.model
      .find({ questionnaireId: questionnaireId as any })
      .sort({ studentId: 1, attemptNumber: 1 })
      .exec();

    return submissions as unknown as QuestionnaireSubmissionDoc[];
  }

  /**
   * Genera un reporte de calificaciones con aggregation
   * Agrupa por estudiante, calcula mejor puntaje, cuenta intentos, y hace lookup a users
   * @param questionnaireId - ID del cuestionario
   * @returns Reporte de calificaciones por estudiante
   */
  async getGradeReport(questionnaireId: string): Promise<GradeReportEntry[]> {
    if (!Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }

    const report = await this.model
      .aggregate([
        { 
          $match: { 
            questionnaireId: new Types.ObjectId(questionnaireId),
            status: 'GRADED' // Solo incluir submissions que ya fueron calificados
          } 
        },
        {
          $group: {
            _id: '$studentId',
            attemptCount: { $sum: 1 },
            bestScore: { $max: '$finalScore' },
            lastAttempt: { $max: '$submittedAt' },
            submissions: { $push: '$$ROOT' },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'student',
          },
        },
        { $unwind: '$student' },
        {
          $project: {
            studentId: '$_id',
            studentName: { $concat: ['$student.firstName', ' ', '$student.lastName'] },
            studentEmail: '$student.email',
            profilePhotoUrl: '$student.profilePhotoUrl',
            attemptCount: 1,
            bestScore: 1,
            lastAttempt: 1,
            allSubmissions: '$submissions',
          },
        },
        { $sort: { studentName: 1 } },
      ])
      .exec();

    return report as GradeReportEntry[];
  }

  /**
   * Verifica si existe al menos un envío para un cuestionario
   * @param questionnaireId - ID del cuestionario
   * @returns true si existe al menos un envío, false si no
   */
  async hasSubmissions(questionnaireId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('El ID del cuestionario proporcionado no es válido.');
    }

    const count = await this.model
      .countDocuments({ questionnaireId: questionnaireId as any })
      .exec();

    return count > 0;
  }

  /**
   * Elimina todas las submissions de un estudiante para un cuestionario
   * @param studentId - ID del estudiante
   * @param questionnaireId - ID del cuestionario
   * @returns Número de submissions eliminadas
   */
  async deleteByStudentAndQuestionnaire(
    studentId: string,
    questionnaireId: string
  ): Promise<number> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(questionnaireId)) {
      throw new Error('Los IDs proporcionados no son válidos.');
    }

    const result = await this.model
      .deleteMany({
        studentId: studentId as any,
        questionnaireId: questionnaireId as any,
      })
      .exec();

    return result.deletedCount || 0;
  }

  /**
   * Obtiene todos los exámenes pendientes de calificar para un profesor
   * @param teacherId - ID del profesor
   * @returns Lista de exámenes pendientes con información del estudiante y cuestionario
   */
  async findPendingGradingByTeacher(teacherId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(teacherId)) {
      throw new Error('El ID del profesor proporcionado no es válido.');
    }

    const pendingSubmissions = await this.model
      .aggregate([
        {
          $match: {
            status: 'SUBMITTED', // Solo exámenes pendientes de calificación
          },
        },
        {
          $lookup: {
            from: 'questionnaires',
            localField: 'questionnaireId',
            foreignField: '_id',
            as: 'questionnaire',
          },
        },
        {
          $unwind: '$questionnaire',
        },
        {
          $match: {
            'questionnaire.createdBy': new Types.ObjectId(teacherId),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student',
          },
        },
        {
          $unwind: '$student',
        },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
          },
        },
        {
          $unwind: '$course',
        },
        {
          $project: {
            _id: 1,
            submissionId: '$_id',
            questionnaireId: '$questionnaire._id',
            questionnaireTitle: '$questionnaire.title',
            courseId: '$course._id',
            courseName: '$course.name',
            studentId: '$student._id',
            studentName: { $concat: ['$student.firstName', ' ', '$student.lastName'] },
            studentEmail: '$student.email',
            attemptNumber: 1,
            submittedAt: 1,
            autoGradedScore: 1,
          },
        },
        {
          $sort: { submittedAt: 1 }, // Más antiguos primero
        },
      ])
      .exec();

    return pendingSubmissions;
  }
}

export default QuestionnaireSubmissionRepository;
export type { GradeReportEntry };
