import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import QuestionnaireSubmissionRepository from '@/repositories/questionnaireSubmission.repository';
import { IQuestionnaire, QuestionnaireDoc, IQuestion } from '@/models/mongo/questionnaire.model';
import { Types, Schema, ObjectId } from 'mongoose';
import QuestionMediaService from '@/services/questionMedia.service';
import { logger } from '@/utils';

class QuestionnaireService {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
    private readonly submissionRepository: QuestionnaireSubmissionRepository
  ) {}

  private readonly questionMediaService = new QuestionMediaService();

  /**
   * Crear un nuevo cuestionario
   */
  /**
   * Crear un nuevo cuestionario
   */
  async create(data: Partial<IQuestionnaire>, creatorId: string): Promise<QuestionnaireDoc> {
    // 1. Validaciones iniciales
    if (!data.questions || data.questions.length === 0) {
      throw new Error('At least one question is required');
    }

    if (data.position) {
      if (data.position.type === 'BETWEEN_CLASSES' && !data.position.afterClassId) {
        throw new Error('afterClassId is required when position type is BETWEEN_CLASSES');
      }
      if (data.position.type === 'FINAL_EXAM' && data.position.afterClassId) {
        delete data.position.afterClassId;
      }
    }

    const correctOptionIndices: { [key: number]: number[] } = {};

    // 2. Procesamiento de preguntas
    for (let i = 0; i < data.questions.length; i++) {
      const question = data.questions[i];

      // Si es MC o MS, validamos opciones
      if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
        if (!question.options || question.options.length < 2) {
          throw new Error(`Multiple choice question "${question.questionText}" must have at least 2 options`);
        }

        const hasSingle = question.correctOptionId !== undefined && question.correctOptionId !== null;
        const hasArray = Array.isArray((question as any).correctOptionIds) && (question as any).correctOptionIds.length > 0;

        // REGLA DE ENCUESTA: Solo exigimos respuesta correcta si NO es encuesta
        if (!data.isSurvey) { 
          if (!hasSingle && !hasArray) {
            throw new Error(`Multiple choice question "${question.questionText}" must have at least one correct answer`);
          }
        }

        // Procesamiento de índices (esto se mantiene igual para transformar a ObjectIds después)
        if (hasArray) {
          const arr = (question as any).correctOptionIds as any[];
          const indices: number[] = [];
          for (const v of arr) {
            const vStr = v?.toString?.() || String(v);
            if (!Types.ObjectId.isValid(vStr)) {
              const idx = typeof v === 'number' ? v : parseInt(vStr);
              if (!isNaN(idx)) indices.push(idx);
            }
          }
          if (indices.length > 0) {
            correctOptionIndices[i] = indices;
            delete (question as any).correctOptionIds;
          }
        }

        if (hasSingle && question.correctOptionId !== undefined && question.correctOptionId !== null) {
          const correctOptionIdStr = question.correctOptionId.toString();
          if (!Types.ObjectId.isValid(correctOptionIdStr)) {
            const correctIndex = typeof question.correctOptionId === 'number'
              ? question.correctOptionId
              : parseInt(correctOptionIdStr);

            if (!isNaN(correctIndex)) {
              correctOptionIndices[i] = [correctIndex];
              delete question.correctOptionId;
            }
          }
        }
      }
    } // <-- Aquí cerramos el bucle FOR correctamente

    // 3. Persistencia
    const questionnaireData = {
      ...data,
      createdBy: new Types.ObjectId(creatorId) as any,
    };

    const createdQuestionnaire = await this.questionnaireRepository.create(questionnaireData);

    // 4. Mapeo de IDs reales
    for (const [questionIndex, optionIndices] of Object.entries(correctOptionIndices)) {
      const qIndex = parseInt(questionIndex);
      const question = createdQuestionnaire.questions[qIndex];
      if (question && question.options && Array.isArray(optionIndices)) {
        const ids = optionIndices
          .map((oi) => question.options && question.options[oi] && question.options[oi]._id)
          .filter(Boolean);
        if (ids.length > 0) {
          (question as any).correctOptionIds = ids;
          question.correctOptionId = ids[0];
        }
      }
    }

    await createdQuestionnaire.save();

    // 5. Rebuild de contenido (Bunny/Cache)
    try {
      const cid = (createdQuestionnaire.courseId ? String(createdQuestionnaire.courseId) : undefined);
      if (cid) {
        const svc = await import('./index');
        const cs = svc && (svc.courseService as any);
        if (cs) await cs.rebuildOrderedContentForCourse(cid);
      }
    } catch (err) {
      logger.error('Error rebuilding orderedContent after questionnaire create', { error: (err as Error).message });
    }

    return createdQuestionnaire;
  }

  /**
   * Actualizar un cuestionario
   */
  async update(id: string, data: Partial<IQuestionnaire>): Promise<QuestionnaireDoc> {
    const existingQuestionnaire = await this.questionnaireRepository.findById(id);
    if (!existingQuestionnaire) {
      throw new Error('Questionnaire not found');
    }

    if (data.position) {
      if (data.position.type === 'BETWEEN_CLASSES' && !data.position.afterClassId) {
        throw new Error('afterClassId is required when position type is BETWEEN_CLASSES');
      }
      if (data.position.type === 'FINAL_EXAM' && data.position.afterClassId) {
        delete data.position.afterClassId;
      }
    }

    const hasSubmissions = await this.submissionRepository.hasSubmissions(id);

    if (data.questions && hasSubmissions) {
      const allowed = this.areQuestionChangesAllowed(existingQuestionnaire.questions, data.questions);
      if (!allowed) {
        // Throw a structured error so the global handler returns 400 instead of 500
        throw { status: 400, message: 'Cannot modify questions after students have submitted. You can only edit correct answers or add new questions.', key: 'questionnaire.modifications_not_allowed' };
      }
    }

    if (data.questions) {
      const correctOptionIndices: { [key: number]: number[] } = {};
      const updateData = { ...data };

      // Validate and convert indices
      for (let i = 0; i < updateData.questions!.length; i++) {
        const question = updateData.questions![i];
        if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
          if (!question.options || question.options.length < 2) {
            throw new Error(`Multiple choice question "${question.questionText}" must have at least 2 options`);
          }

          const hasSingle = question.correctOptionId !== undefined && question.correctOptionId !== null;
          const hasArray = Array.isArray((question as any).correctOptionIds) && (question as any).correctOptionIds.length > 0;

          if (!data.isSurvey && existingQuestionnaire.isSurvey !== true) {
            if (!hasSingle && !hasArray) {
              throw new Error(`Multiple choice question "${question.questionText}" must have at least one correct answer`);
            }
          }

          if (hasArray) {
            const arr = (question as any).correctOptionIds as any[];
            const indices: number[] = [];
            for (const v of arr) {
              const vStr = v?.toString?.() || String(v);
              if (!Types.ObjectId.isValid(vStr)) {
                const idx = typeof v === 'number' ? v : parseInt(vStr);
                if (!isNaN(idx)) indices.push(idx);
              }
            }
            if (indices.length > 0) {
              correctOptionIndices[i] = indices;
              delete (question as any).correctOptionIds;
            }
          }

          if (hasSingle && question.correctOptionId !== undefined && question.correctOptionId !== null) {
            const correctOptionIdStr = question.correctOptionId.toString();
            if (!Types.ObjectId.isValid(correctOptionIdStr)) {
              const correctIndex = typeof question.correctOptionId === 'number'
                ? question.correctOptionId
                : parseInt(correctOptionIdStr);

              if (!isNaN(correctIndex)) {
                correctOptionIndices[i] = [correctIndex];
                delete question.correctOptionId;
              }
            }
          }
        }
      }

      // Preserve existing option _ids
      // If there are submissions, require clients to include option `_id` for existing questions
      if (hasSubmissions && updateData.questions) {
        for (let i = 0; i < updateData.questions.length; i++) {
          const newQuestion = updateData.questions[i];
          const existingQuestion = existingQuestionnaire.questions[i];
          if (existingQuestion && (existingQuestion.type === 'MULTIPLE_CHOICE' || existingQuestion.type === 'MULTIPLE_SELECT') && newQuestion.options) {
            for (let j = 0; j < newQuestion.options.length; j++) {
              const newOption = newQuestion.options[j] as any;
              if (!newOption._id) {
                throw { status: 400, message: 'When questionnaire has submissions, option _id must be provided for existing questions to allow safe updates', key: 'questionnaire.missing_option_id' };
              }
            }
          }
        }
      }
      if (updateData.questions) {
        for (let i = 0; i < updateData.questions.length; i++) {
          const newQuestion = updateData.questions[i];
          const existingQuestion = existingQuestionnaire.questions[i]; // might be undefined for new questions
          
          if ((newQuestion.type === 'MULTIPLE_CHOICE' || newQuestion.type === 'MULTIPLE_SELECT') && newQuestion.options) {
            for (let j = 0; j < newQuestion.options.length; j++) {
              const newOption = newQuestion.options[j] as any;
            
            if (!newOption._id && existingQuestion?.options) {
              const existingOption = existingQuestion.options[j];
              if (existingOption && existingOption._id) {
                newOption._id = existingOption._id;
              } else {
                const matchingOption = existingQuestion.options.find(
                  (opt: any) => opt.text === newOption.text && opt._id
                );
                if (matchingOption) {
                  newOption._id = matchingOption._id;
                }
              }
            }
          }
        }
      }
      }

      // If submissions exist, ensure that for existing questions the options keep their identity
      // Require `_id` for existing options or allow matching by exact text to map IDs safely.
      if (hasSubmissions && updateData.questions) {
        for (let i = 0; i < existingQuestionnaire.questions.length && i < updateData.questions.length; i++) {
          const existingQ = existingQuestionnaire.questions[i];
          const newQ = updateData.questions[i];
          if (!existingQ || !newQ) continue;

          if ((existingQ.type === 'MULTIPLE_CHOICE' || existingQ.type === 'MULTIPLE_SELECT') &&
              (newQ.type === 'MULTIPLE_CHOICE' || newQ.type === 'MULTIPLE_SELECT')) {
            if (!newQ.options || newQ.options.length !== (existingQ.options?.length || 0)) {
              throw { status: 400, message: 'Cannot change options count for questions that already have submissions.', key: 'questionnaire.options_count_mismatch' };
            }
            for (let j = 0; j < (existingQ.options?.length || 0); j++) {
              const newOpt = newQ.options[j] as any;
              if (!newOpt._id) {
                const match = existingQ.options?.find((o: any) => String(o.text).trim() === String(newOpt.text).trim());
                if (match && match._id) {
                  newOpt._id = match._id;
                } else {
                  throw { status: 400, message: `Missing _id for existing option at question index ${i}, option index ${j}. Provide option _id or keep the exact text to map.`, key: 'questionnaire.missing_option_id' };
                }
              }
            }
          }
        }
      }

      const updatedQuestionnaire = await this.questionnaireRepository.update(id, updateData);

      if (Object.keys(correctOptionIndices).length > 0) {
        for (const [questionIndex, optionIndices] of Object.entries(correctOptionIndices)) {
          const qIndex = parseInt(questionIndex);
          const question = updatedQuestionnaire.questions[qIndex];
          if (question && question.options && Array.isArray(optionIndices)) {
            const ids = optionIndices
              .map((oi) => question.options && question.options[oi] && question.options[oi]._id)
              .filter(Boolean);
            if (ids.length > 0) {
              (question as any).correctOptionIds = ids;
              question.correctOptionId = ids[0];
            }
          }
        }
        await updatedQuestionnaire.save();
      }

      try {
        const cid = updatedQuestionnaire.courseId ? String(updatedQuestionnaire.courseId) : undefined;
        if (cid) {
          const svc = await import('./index');
          const cs = svc && (svc.courseService as any);
          if (cs) await cs.rebuildOrderedContentForCourse(cid);
          else logger.warn('courseService not available to rebuildOrderedContent after questionnaire update', { courseId: cid });
        }
      } catch (err) {
        logger.error('Error rebuilding orderedContent after questionnaire update', { error: (err as Error).message });
      }
      return updatedQuestionnaire;
    }

    // No questions updated
    const { questions, ...otherFields } = data;
    const updated = await this.questionnaireRepository.update(id, otherFields);
    try {
      const cid = updated.courseId ? String(updated.courseId) : undefined;
      if (cid) {
        const svc = await import('./index');
        const cs = svc && (svc.courseService as any);
        if (cs) await cs.rebuildOrderedContentForCourse(cid);
        else logger.warn('courseService not available to rebuildOrderedContent after questionnaire update', { courseId: cid });
      }
    } catch (err) {
      logger.error('Error rebuilding orderedContent after questionnaire update', { error: (err as Error).message });
    }
    return updated;
  }

  /**
   * Verificar si los cambios a las preguntas son permitidos
   * (se permite modificar la opcion correcta y agregar nuevas preguntas)
   */
  private areQuestionChangesAllowed(
    existingQuestions: IQuestion[],
    newQuestions: IQuestion[]
  ): boolean {
    try {
      if (newQuestions.length < existingQuestions.length) {
        return false;
      }

      for (let i = 0; i < existingQuestions.length; i++) {
        const existing = existingQuestions[i];
        const updated = newQuestions[i];

        // Do not allow changing question type (would break structure)
        if (existing.type !== updated.type) {
          return false;
        }

        // For multiple choice/select, ensure option count stays the same.
        if ((existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTIPLE_SELECT') && (updated.type === 'MULTIPLE_CHOICE' || updated.type === 'MULTIPLE_SELECT')) {
          if (!existing.options || !updated.options) {
            if (existing.options !== updated.options) {
              return false;
            }
            continue;
          }

          if (existing.options.length !== updated.options.length) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error comparing questions:', error);
      return false;
    }
  }

  /**
   * Eliminar un cuestionario (con cascade delete de submissions)
   */
  async delete(id: string): Promise<void> {
    // Obtener el cuestionario antes de eliminar para conocer courseId
    const existing = await this.questionnaireRepository.findById(id);
    const courseId = existing?.courseId ? String(existing.courseId) : undefined;

    // Eliminar submissions en cascada si existen
    const hasSubmissions = await this.submissionRepository.hasSubmissions(id);
    if (hasSubmissions) {
      const deletedCount = await this.submissionRepository.deleteByQuestionnaire(id);
      logger.info('Deleted questionnaire submissions in cascade', {
        questionnaireId: id,
        deletedSubmissions: deletedCount,
      });
    }

    await this.questionnaireRepository.delete(id);
    logger.info('Questionnaire deleted', { questionnaireId: id, courseId });

    if (courseId) {
      try {
        const svc = await import('./index');
        const cs = svc && (svc.courseService as any);
        if (cs) await cs.rebuildOrderedContentForCourse(courseId);
      } catch (err) {
        logger.error('Error rebuilding orderedContent after questionnaire delete', { error: (err as Error).message });
      }
    }
  }


  /**
   * Obtener cuestionario por ID
   * Oculta respuestas correctas si el usuario no ha completado
   */
  async findById(id: string, studentId?: string, userRoles?: string[]): Promise<QuestionnaireDoc | null> {
    try {
      const questionnaire = await this.questionnaireRepository.findById(id);

      if (!questionnaire) {
        return null;
      }

      // If studentId provided AND user is only a student (not professor or admin), check if they've completed it
      const isAlumno = userRoles?.some((r: any) => String(r).toUpperCase() === 'ALUMNO');
      const isAdminOrProfesor = userRoles?.some((r: any) => 
        String(r).toUpperCase() === 'PROFESOR' || String(r).toUpperCase() === 'ADMIN'
      );

      // Only hide correctOptionId for students, not for professors or admins
      if (studentId && isAlumno && !isAdminOrProfesor) {
        const submission = await this.submissionRepository.getBestSubmission(studentId, id);

        // Hide correct answers if not yet graded
        if (!submission || submission.status !== 'GRADED') {
          const questionnaireObj = questionnaire.toObject ? questionnaire.toObject() : questionnaire;
          questionnaireObj.questions = (questionnaireObj.questions || []).map((q: any) => ({
            ...q,
            correctOptionId: undefined, // Remove correct answer (backward compat)
            correctOptionIds: undefined,
          }));
          return questionnaireObj as QuestionnaireDoc;
        }

        // Only show correct answers if showCorrectAnswers is true and status is GRADED
        if (!questionnaire.showCorrectAnswers) {
          const questionnaireObj = questionnaire.toObject ? questionnaire.toObject() : questionnaire;
          questionnaireObj.questions = (questionnaireObj.questions || []).map((q: any) => ({
            ...q,
            correctOptionId: undefined,
            correctOptionIds: undefined,
          }));
          return questionnaireObj as QuestionnaireDoc;
        }
      }

      // For professors and admins, always return full questionnaire with all questions and correctOptionId
      return questionnaire;
    } catch (error) {
      console.error('[QuestionnaireService.findById] Error:', error);
      throw error;
    }
  }

  /**
   * Listar cuestionarios por curso
   */
  async findByCourseId(courseId: string): Promise<QuestionnaireDoc[]> {
    return await this.questionnaireRepository.findByCourseId(courseId);
  }

  /**
   * Indica si un cuestionario tiene envíos asociados
   */
  async hasSubmissions(id: string): Promise<boolean> {
    return await this.submissionRepository.hasSubmissions(id);
  }

  /**
   * Listar cuestionarios por profesor
   */
  async findByProfessorId(professorId: string): Promise<QuestionnaireDoc[]> {
    return await this.questionnaireRepository.findByProfessorId(professorId);
  }

  /**
   * Subir o reemplazar media de una pregunta (imagen/video).
   * - Elimina el media antiguo si existe y es manejado por Bunny
   * - Sube el nuevo media a Bunny (carpetas question-images/question-videos)
   * - Actualiza `question.promptType`, `promptMediaUrl`, `promptMediaProvider` y guarda el cuestionario
   */
  async updateQuestionMedia(
    questionnaireId: string,
    questionId: string,
    buffer: Buffer,
    originalName: string,
    promptType: 'IMAGE' | 'VIDEO'
  ): Promise<QuestionnaireDoc> {
    const questionnaire = await this.questionnaireRepository.findById(questionnaireId);
    if (!questionnaire) throw new Error('Questionnaire not found');

    const q = questionnaire.questions.find((qq) => qq._id?.toString() === questionId.toString());
    if (!q) throw new Error('Question not found');

    // If existing media is a Bunny URL, try to delete it
    if (q.promptMediaUrl && this.questionMediaService) {
      try {
        await this.questionMediaService.deleteMedia(q.promptMediaUrl as string);
      } catch (err) {
        // Log error but continue
        console.warn('Failed to delete old media:', (err as Error).message);
      }
    }

    // Upload new media
    let cdnUrl: string;
    if (promptType === 'IMAGE') {
      cdnUrl = await this.questionMediaService.uploadImage(buffer, originalName);
    } else {
      // VIDEO
      cdnUrl = await this.questionMediaService.uploadVideo(buffer, originalName);
    }

    // Prepare partial update for repository
    const partialQuestion: Partial<any> = {
      promptType,
      promptMediaUrl: cdnUrl,
      promptMediaProvider: 'BUNNY',
    };

    // Persist change using repository method that updates a single question
    const updated = await this.questionnaireRepository.updateQuestion(questionnaireId, q._id!.toString(), partialQuestion);
    return updated;
  }

  /**
   * Actualizar el estado de subida de media de una pregunta
   */
  async updateQuestionUploadStatus(
    questionnaireId: string,
    questionId: string,
    updates: Partial<{ mediaUploadStatus: 'ready' | 'processing' | 'error'; mediaOriginalName?: string; promptType?: 'IMAGE' | 'VIDEO'; promptMediaUrl?: string; promptMediaProvider?: 'BUNNY' }>
  ): Promise<QuestionnaireDoc> {
    const updated = await this.questionnaireRepository.updateQuestion(questionnaireId, questionId, updates);
    return updated;
  }

  /**
   * Subir imagen con callback de progreso
   */
  async uploadImageMedia(buffer: Buffer, originalName: string, onProgress?: (percent: number) => void): Promise<string> {
    // Para imágenes pequeñas, reportar progreso simulado
    if (onProgress) onProgress(0);
    const cdnUrl = await this.questionMediaService.uploadImage(buffer, originalName);
    if (onProgress) onProgress(100);
    return cdnUrl;
  }

  /**
   * Subir video con streaming y callback de progreso
   */
  async uploadVideoMedia(stream: import('stream').Readable, originalName: string, fileSize: number, onProgress?: (percent: number) => void): Promise<string> {
    const cdnUrl = await this.questionMediaService.uploadVideoStream(stream, originalName, fileSize, onProgress);
    return cdnUrl;
  }
}

export default QuestionnaireService;
