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
            const idx = typeof v === 'number' ? v : parseInt(v as any);
            if (!isNaN(idx)) indices.push(idx);
          }
          if (indices.length > 0) {
            correctOptionIndices[i] = indices;
            delete (question as any).correctOptionIds;
          }
        }

        if (hasSingle) {
          const correctIndex = typeof question.correctOptionId === 'number'
            ? question.correctOptionId
            : parseInt(question.correctOptionId as any);

          if (!isNaN(correctIndex)) {
            correctOptionIndices[i] = [correctIndex];
            delete question.correctOptionId;
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
    // Get existing questionnaire to check for submissions and compare questions
    const existingQuestionnaire = await this.questionnaireRepository.findById(id);
    if (!existingQuestionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Validate position if being updated
    if (data.position) {
      if (data.position.type === 'BETWEEN_CLASSES' && !data.position.afterClassId) {
        throw new Error('afterClassId is required when position type is BETWEEN_CLASSES');
      }
      // Si el tipo es FINAL_EXAM, no debe tener afterClassId
      if (data.position.type === 'FINAL_EXAM' && data.position.afterClassId) {
        delete data.position.afterClassId;
      }
    }

    // Separate questions from other fields
    const { questions, ...otherFields } = data;
    const hasSubmissions = await this.submissionRepository.hasSubmissions(id);

    // Only prevent modifying questions if there are submissions
    if (questions && hasSubmissions) {
      // Log what we're comparing
      // Check if only correctOptionId changed (allow this even with submissions)
      const onlyCorrectOptionIdChanged = this.onlyCorrectOptionIdChanged(existingQuestionnaire.questions, questions);
      
      if (onlyCorrectOptionIdChanged) {
        
        // Process questions to update only correctOptionId
        const updateData = { ...data };
        if (updateData.questions) {
          // For each question, preserve all fields but update correctOptionId
          for (let i = 0; i < updateData.questions.length; i++) {
            const newQuestion = updateData.questions[i];
            const existingQuestion = existingQuestionnaire.questions[i];
            
            if ((newQuestion.type === 'MULTIPLE_CHOICE' || newQuestion.type === 'MULTIPLE_SELECT') && (existingQuestion.type === 'MULTIPLE_CHOICE' || existingQuestion.type === 'MULTIPLE_SELECT')) {
              // Handle correctOptionId conversion from index to ObjectId if needed
              // Normalize possible single or multiple correct answers
              if ((newQuestion as any).correctOptionIds && Array.isArray((newQuestion as any).correctOptionIds)) {
                const arr = (newQuestion as any).correctOptionIds as any[];
                const resolvedIds: any[] = [];
                for (const v of arr) {
                  const vStr = v?.toString?.() || String(v);
                  if (!Types.ObjectId.isValid(vStr) && newQuestion.options) {
                    const index = parseInt(vStr);
                    if (!isNaN(index) && index >= 0 && index < newQuestion.options.length) {
                      const selectedOption = newQuestion.options[index];
                      if (selectedOption._id) resolvedIds.push(selectedOption._id);
                    }
                  } else if (Types.ObjectId.isValid(vStr)) {
                    resolvedIds.push(new Types.ObjectId(vStr));
                  }
                }
                if (resolvedIds.length > 0) {
                  (newQuestion as any).correctOptionIds = resolvedIds;
                  newQuestion.correctOptionId = resolvedIds[0];
                }
              } else if (newQuestion.correctOptionId !== undefined && newQuestion.correctOptionId !== null) {
                const correctOptionIdStr = newQuestion.correctOptionId.toString();
                
                // If it's an index, convert to ObjectId
                if (!Types.ObjectId.isValid(correctOptionIdStr) && newQuestion.options) {
                  const index = parseInt(correctOptionIdStr);
                  if (!isNaN(index) && index >= 0 && index < newQuestion.options.length) {
                    const selectedOption = newQuestion.options[index];
                    if (selectedOption._id) {
                      newQuestion.correctOptionId = selectedOption._id;
                      (newQuestion as any).correctOptionIds = [selectedOption._id];
                    }
                  }
                } else if (Types.ObjectId.isValid(correctOptionIdStr)) {
                  // It's already an ObjectId, use it directly
                  newQuestion.correctOptionId = new Types.ObjectId(correctOptionIdStr);
                  (newQuestion as any).correctOptionIds = [newQuestion.correctOptionId];
                }
              }
              
              // Preserve existing option _ids
              if (newQuestion.options && existingQuestion.options) {
                for (let j = 0; j < newQuestion.options.length; j++) {
                  const newOpt = newQuestion.options[j] as any;
                  const existingOpt = existingQuestion.options[j];
                  
                  if (!newOpt._id && existingOpt?._id) {
                    newOpt._id = existingOpt._id;
                  }
                }
              }
            }
          }
        }
        
        const updated = await this.questionnaireRepository.update(id, updateData);
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
      
      // Check if questions actually changed by comparing structure (excluding correctOptionId)
      const questionsChanged = this.haveQuestionsChanged(existingQuestionnaire.questions, questions);

      if (questionsChanged) {
        throw new Error(
          'Cannot modify questions after students have submitted. Create a new version of this questionnaire instead.'
        );
      }

      // If questions haven't changed, allow update of other fields only
      const updated = await this.questionnaireRepository.update(id, otherFields);
      try {
        const cid = updated.courseId ? String(updated.courseId) : undefined;
        if (cid) {
          const { courseService } = await import('./index');
          await courseService.rebuildOrderedContentForCourse(cid);
        }
      } catch (err) {
        logger.error('Error rebuilding orderedContent after questionnaire update', { error: (err as Error).message });
      }
      return updated;
    }

    // If no questions in update or no submissions, proceed with normal update
    if (questions) {
      // Store correct option indices temporarily (for new questions or when updating)
      const correctOptionIndices: { [key: number]: number[] } = {};
      const updateData = { ...data };

      // Validate new questions structure and handle correctOptionId conversion
      for (let i = 0; i < updateData.questions!.length; i++) {
  const question = updateData.questions![i];
  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
    if (!question.options || question.options.length < 2) {
      throw new Error(`Multiple choice question "${question.questionText}" must have at least 2 options`);
    }

    const hasSingle = question.correctOptionId !== undefined && question.correctOptionId !== null;
    const hasArray = Array.isArray((question as any).correctOptionIds) && (question as any).correctOptionIds.length > 0;

    if (!data.isSurvey) {
      if (!hasSingle && !hasArray) {
        throw new Error(`Multiple choice question "${question.questionText}" must have at least one correct answer`);
      }
    }

    // ✅ Convertir índices a correctOptionIndices (igual que create())
    if (hasArray) {
      const arr = (question as any).correctOptionIds as any[];
      const indices: number[] = [];
      for (const v of arr) {
        const idx = typeof v === 'number' ? v : parseInt(v as any);
        if (!isNaN(idx)) indices.push(idx);
      }
      if (indices.length > 0) {
        correctOptionIndices[i] = indices;
        delete (question as any).correctOptionIds;
      }
    }

    if (hasSingle) {
      const correctIndex = typeof question.correctOptionId === 'number'
        ? question.correctOptionId
        : parseInt(question.correctOptionId as any);

      if (!isNaN(correctIndex)) {
        correctOptionIndices[i] = [correctIndex];
        delete question.correctOptionId;
      }
    }
  }
}

      // existingQuestionnaire already retrieved above

      // Preserve existing option _ids when updating
      // First, try to use _ids from frontend. If not present, try to match by position
      if (updateData.questions) {
        for (let i = 0; i < updateData.questions.length; i++) {
          const newQuestion = updateData.questions[i];
          const existingQuestion = existingQuestionnaire.questions[i];
          
              if ((newQuestion.type === 'MULTIPLE_CHOICE' || newQuestion.type === 'MULTIPLE_SELECT') && newQuestion.options) {
            for (let j = 0; j < newQuestion.options.length; j++) {
              const newOption = newQuestion.options[j] as any;
              
              // If newOption doesn't have _id, try to find matching option in existing question
              if (!newOption._id && existingQuestion?.options) {
                // Try to match by position first
                const existingOption = existingQuestion.options[j];
                if (existingOption && existingOption._id) {
                  newOption._id = existingOption._id;
                } else {
                  // Try to match by text if position doesn't match
                  const matchingOption = existingQuestion.options.find(
                    (opt: any) => opt.text === newOption.text && opt._id
                  );
                  if (matchingOption) {
                    newOption._id = matchingOption._id;
                  }
                }
              }
              // If newOption already has _id from frontend, keep it
            }
          }
        }
      }

      // Update the questionnaire (Mongoose will generate _ids for new options without _id)
      const updatedQuestionnaire = await this.questionnaireRepository.update(id, updateData);

      // Now update correct option IDs with the actual ObjectIds for questions that had indices
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

        // Save the updated questionnaire with correct ObjectIds
        await updatedQuestionnaire.save();
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

      try {
        const cid = updatedQuestionnaire.courseId ? String(updatedQuestionnaire.courseId) : undefined;
        if (cid) {
          const { courseService } = await import('./index');
          await courseService.rebuildOrderedContentForCourse(cid);
        }
      } catch (err) {
        logger.error('Error rebuilding orderedContent after questionnaire update', { error: (err as Error).message });
      }
      return updatedQuestionnaire;
    }

    // If no questions to update, just update other fields
    const updated = await this.questionnaireRepository.update(id, data);
    try {
      const cid = updated.courseId ? String(updated.courseId) : undefined;
      if (cid) {
        const { courseService } = await import('./index');
        await courseService.rebuildOrderedContentForCourse(cid);
      }
    } catch (err) {
      logger.error('Error rebuilding orderedContent after questionnaire update', { error: (err as Error).message });
    }
    return updated;
  }

  /**
   * Verificar si solo cambió el correctOptionId (y no otros campos)
   */
  private onlyCorrectOptionIdChanged(
    existingQuestions: IQuestion[],
    newQuestions: IQuestion[]
  ): boolean {
    try {
      // Different number of questions means more than just correctOptionId changed
      if (existingQuestions.length !== newQuestions.length) {
        return false;
      }

      // Compare each question
      for (let i = 0; i < existingQuestions.length; i++) {
        const existing = existingQuestions[i];
        const updated = newQuestions[i];

        // Check basic fields (if any changed, it's not just correctOptionId)
        if (
          existing.type !== updated.type ||
          String(existing.questionText).trim() !== String(updated.questionText).trim() ||
          Number(existing.points) !== Number(updated.points) ||
          Boolean(existing.required) !== Boolean(updated.required) ||
          Number(existing.order) !== Number(updated.order)
        ) {
          return false;
        }

        // For multiple choice, check options (text and order)
        if ((existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTIPLE_SELECT') && (updated.type === 'MULTIPLE_CHOICE' || updated.type === 'MULTIPLE_SELECT')) {
          if (!existing.options || !updated.options) {
            if (existing.options !== updated.options) {
              return false;
            }
            continue; // Both null/undefined, skip
          }

          if (existing.options.length !== updated.options.length) {
            return false;
          }

          // Check if options changed (text or order) - if so, it's not just correctOptionId
          for (let j = 0; j < existing.options.length; j++) {
            const existingOpt = existing.options[j];
            const updatedOpt = updated.options[j];

            if (
              String(existingOpt.text).trim() !== String(updatedOpt.text).trim() ||
              Number(existingOpt.order) !== Number(updatedOpt.order)
            ) {
              return false;
            }
          }

          // If we get here, options are the same, so only correctOptionId(s) could have changed
          // Build arrays of correct option texts for existing and updated to compare sets
          const existingCorrectIds = [] as string[];
          const updatedCorrectIds = [] as string[];

          if ((existing as any).correctOptionIds && Array.isArray((existing as any).correctOptionIds)) {
            for (const cid of (existing as any).correctOptionIds) {
              if (cid) existingCorrectIds.push(cid.toString());
            }
          } else if (existing.correctOptionId) {
            existingCorrectIds.push(existing.correctOptionId.toString());
          }

          if ((updated as any).correctOptionIds && Array.isArray((updated as any).correctOptionIds)) {
            for (const cid of (updated as any).correctOptionIds) {
              if (cid) updatedCorrectIds.push(cid.toString());
            }
          } else if (updated.correctOptionId) {
            updatedCorrectIds.push(updated.correctOptionId.toString());
          } else if (updated.options && updated.correctOptionId === undefined && (updated as any).correctOptionIds === undefined) {
            // nothing provided — skip
          }

          // Try to map ids to option texts for more robust comparison (handle indices)
          const mapIdsToTexts = (opts: any[], ids: string[]) => {
            const texts: string[] = [];
            for (const id of ids) {
              if (Types.ObjectId.isValid(id)) {
                const opt = opts.find((o: any) => o._id?.toString() === id);
                if (opt) texts.push(String(opt.text).trim());
              } else {
                // maybe an index
                const idx = parseInt(id);
                if (!isNaN(idx) && idx >= 0 && idx < (opts?.length || 0)) {
                  texts.push(String(opts[idx].text).trim());
                }
              }
            }
            return texts;
          };

          let existingTexts: string[] = [];
          let updatedTexts: string[] = [];
          if (existing.options) existingTexts = mapIdsToTexts(existing.options, existingCorrectIds);
          if (updated.options) updatedTexts = mapIdsToTexts(updated.options, updatedCorrectIds);

          // If we can't determine texts, fall back to comparing id lists (as strings)
          const existingSet = new Set(existingTexts.length > 0 ? existingTexts : existingCorrectIds);
          const updatedSet = new Set(updatedTexts.length > 0 ? updatedTexts : updatedCorrectIds);

          // If both sets are empty, continue
          if (existingSet.size === 0 && updatedSet.size === 0) {
            continue;
          }

          // If sets are different, it's a correctOption change (allowed)
          const same = existingSet.size === updatedSet.size && [...existingSet].every((v) => updatedSet.has(v));
          if (same) {
            // same correct answers (possibly different ids ordering) — continue
            continue;
          }
          // else different, but still only-correct-option change — continue to check other questions
        }
      }

      // If we get here, only correctOptionId could have changed (or nothing changed)
      // Check if at least one correctOptionId actually changed
      for (let i = 0; i < existingQuestions.length; i++) {
        const existing = existingQuestions[i];
        const updated = newQuestions[i];
        
        if ((existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTIPLE_SELECT') && (updated.type === 'MULTIPLE_CHOICE' || updated.type === 'MULTIPLE_SELECT')) {
          const existingCorrectId = existing.correctOptionId?.toString();
          const updatedCorrectId = updated.correctOptionId?.toString();
          
          if (existingCorrectId !== updatedCorrectId) {
            // At least one correctOptionId changed
            return true;
          }
        }
      }

      // No correctOptionId changed
      return false;
    } catch (error) {
      // If comparison fails, be conservative and assume it's not just correctOptionId
      console.error('Error checking if only correctOptionId changed:', error);
      return false;
    }
  }

  /**
   * Verificar si las preguntas han cambiado comparando estructura
   * (excluyendo cambios en correctOptionId)
   */
  private haveQuestionsChanged(
    existingQuestions: IQuestion[],
    newQuestions: IQuestion[]
  ): boolean {
    try {
      // Different number of questions means change
      if (existingQuestions.length !== newQuestions.length) {
        return true;
      }

      // Compare each question
      for (let i = 0; i < existingQuestions.length; i++) {
        const existing = existingQuestions[i];
        const updated = newQuestions[i];

        // Check basic fields (normalize strings for comparison)
        if (
          existing.type !== updated.type ||
          String(existing.questionText).trim() !== String(updated.questionText).trim() ||
          Number(existing.points) !== Number(updated.points) ||
          Boolean(existing.required) !== Boolean(updated.required) ||
          Number(existing.order) !== Number(updated.order)
        ) {
          return true;
        }

        // For multiple choice, check options
        if ((existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTIPLE_SELECT') && (updated.type === 'MULTIPLE_CHOICE' || updated.type === 'MULTIPLE_SELECT')) {
          if (!existing.options || !updated.options) {
            if (existing.options !== updated.options) {
              return true;
            }
            continue; // Both null/undefined, skip
          }

          if (existing.options.length !== updated.options.length) {
            return true;
          }

          // Check if options changed (text or order)
          for (let j = 0; j < existing.options.length; j++) {
            const existingOpt = existing.options[j];
            const updatedOpt = updated.options[j];

            if (
              String(existingOpt.text).trim() !== String(updatedOpt.text).trim() ||
              Number(existingOpt.order) !== Number(updatedOpt.order)
            ) {
              return true;
            }
          }

          // Check if correct answer changed
          // NOTE: We ignore changes in correctOptionId here because they're handled separately
          // This method is used to detect changes OTHER than correctOptionId
          // Strategy: Since options are already compared by text/order above and match,
          // we compare by finding which option text corresponds to each correctOptionId
          
          // Check if correct answer changed - ignored here (handled elsewhere)
          continue;
        }
      }

      return false; // No changes detected
    } catch (error) {
      // If comparison fails, be conservative and assume questions changed
      console.error('Error comparing questions:', error);
      return true;
    }
  }

  /**
   * Eliminar un cuestionario
   */
  async delete(id: string): Promise<void> {
    const hasSubmissions = await this.submissionRepository.hasSubmissions(id);

    // Obtener el cuestionario antes de eliminar para conocer courseId
    const existing = await this.questionnaireRepository.findById(id);
    const courseId = existing?.courseId ? String(existing.courseId) : undefined;

    if (hasSubmissions) {
      // Eliminar todas las submissions del cuestionario en cascada
      const deletedCount = await this.submissionRepository.deleteByQuestionnaire(id);
      logger.info('Deleted questionnaire submissions in cascade', { 
        questionnaireId: id, 
        deletedSubmissions: deletedCount 
      });
    }

    await this.questionnaireRepository.delete(id);

    if (courseId) {
      try {
        const svc = await import('./index');
        const cs = svc && (svc.courseService as any);
        if (cs) await cs.rebuildOrderedContentForCourse(courseId);
        else logger.warn('courseService not available to rebuildOrderedContent after questionnaire delete', { courseId });
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
        questionnaireObj.questions = questionnaireObj.questions.map((q: any) => ({
          ...q,
          correctOptionId: undefined, // Remove correct answer (backward compat)
          correctOptionIds: undefined,
        }));
        return questionnaireObj as QuestionnaireDoc;
      }

      // Only show correct answers if showCorrectAnswers is true and status is GRADED
      if (!questionnaire.showCorrectAnswers) {
        const questionnaireObj = questionnaire.toObject ? questionnaire.toObject() : questionnaire;
        questionnaireObj.questions = questionnaireObj.questions.map((q: any) => ({
          ...q,
          correctOptionId: undefined,
          correctOptionIds: undefined,
        }));
        return questionnaireObj as QuestionnaireDoc;
      }
    }

    // For professors and admins, always return full questionnaire with all questions and correctOptionId
    return questionnaire;
  }

  /**
   * Listar cuestionarios por curso
   */
  async findByCourseId(courseId: string): Promise<QuestionnaireDoc[]> {
    return await this.questionnaireRepository.findByCourseId(courseId);
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
