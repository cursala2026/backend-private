import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import QuestionnaireSubmissionRepository from '@/repositories/questionnaireSubmission.repository';
import { IQuestionnaire, QuestionnaireDoc, IQuestion } from '@/models/mongo/questionnaire.model';
import { Types, Schema, ObjectId } from 'mongoose';

class QuestionnaireService {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
    private readonly submissionRepository: QuestionnaireSubmissionRepository
  ) {}

  /**
   * Crear un nuevo cuestionario
   */
  async create(data: Partial<IQuestionnaire>, creatorId: string): Promise<QuestionnaireDoc> {
    // Validate questions structure
    if (!data.questions || data.questions.length === 0) {
      throw new Error('At least one question is required');
    }

    // Store correct option indices temporarily
    const correctOptionIndices: { [key: number]: number } = {};

    // Validate MC questions have options and correctOptionId
    for (let i = 0; i < data.questions.length; i++) {
      const question = data.questions[i];
      if (question.type === 'MULTIPLE_CHOICE') {
        if (!question.options || question.options.length < 2) {
          throw new Error(`Multiple choice question "${question.questionText}" must have at least 2 options`);
        }
        if (question.correctOptionId === undefined || question.correctOptionId === null) {
          throw new Error(`Multiple choice question "${question.questionText}" must have a correct answer`);
        }

        // If correctOptionId is a number or string number (index), store it
        const correctIndex = typeof question.correctOptionId === 'number'
          ? question.correctOptionId
          : parseInt(question.correctOptionId as any);

        if (!isNaN(correctIndex)) {
          correctOptionIndices[i] = correctIndex;
          // Remove it temporarily so Mongoose doesn't validate it as ObjectId
          delete question.correctOptionId;
        }
      }
    }

    // Set createdBy
    const questionnaireData = {
      ...data,
      createdBy: new Types.ObjectId(creatorId) as any,
    };

    // Create the questionnaire (Mongoose will generate _ids for options)
    const createdQuestionnaire = await this.questionnaireRepository.create(questionnaireData);

    // Now update correct option IDs with the actual ObjectIds
    for (const [questionIndex, optionIndex] of Object.entries(correctOptionIndices)) {
      const qIndex = parseInt(questionIndex);
      const question = createdQuestionnaire.questions[qIndex];
      if (question && question.options && question.options[optionIndex]) {
        question.correctOptionId = question.options[optionIndex]._id;
      }
    }

    // Save the updated questionnaire
    await createdQuestionnaire.save();

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

    // Separate questions from other fields
    const { questions, ...otherFields } = data;
    console.log('Update request received:', {
      hasQuestions: !!questions,
      questionsCount: questions?.length,
      otherFieldsKeys: Object.keys(otherFields),
      otherFields: otherFields
    });
    const hasSubmissions = await this.submissionRepository.hasSubmissions(id);
    console.log('Has submissions:', hasSubmissions);

    // Only prevent modifying questions if there are submissions
    if (questions && hasSubmissions) {
      // Log what we're comparing
      console.log('Comparing questions:', {
        existingQuestions: existingQuestionnaire.questions.map((q, i) => ({
          index: i,
          type: q.type,
          correctOptionId: q.correctOptionId?.toString(),
          options: q.options?.map((opt: any, idx: number) => ({
            index: idx,
            _id: opt._id?.toString(),
            text: opt.text
          }))
        })),
        newQuestions: questions.map((q, i) => ({
          index: i,
          type: q.type,
          correctOptionId: q.correctOptionId?.toString(),
          correctOptionIdType: typeof q.correctOptionId,
          options: q.options?.map((opt: any, idx: number) => ({
            index: idx,
            _id: opt._id?.toString(),
            text: opt.text
          }))
        }))
      });
      
      // Check if only correctOptionId changed (allow this even with submissions)
      const onlyCorrectOptionIdChanged = this.onlyCorrectOptionIdChanged(existingQuestionnaire.questions, questions);
      console.log('Only correctOptionId changed?', onlyCorrectOptionIdChanged);
      
      if (onlyCorrectOptionIdChanged) {
        // Allow updating only correctOptionId - update the questionnaire with new correctOptionIds
        console.log('Only correctOptionId changed, allowing update');
        
        // Process questions to update only correctOptionId
        const updateData = { ...data };
        if (updateData.questions) {
          // For each question, preserve all fields but update correctOptionId
          for (let i = 0; i < updateData.questions.length; i++) {
            const newQuestion = updateData.questions[i];
            const existingQuestion = existingQuestionnaire.questions[i];
            
            if (newQuestion.type === 'MULTIPLE_CHOICE' && existingQuestion.type === 'MULTIPLE_CHOICE') {
              // Handle correctOptionId conversion from index to ObjectId if needed
              if (newQuestion.correctOptionId !== undefined && newQuestion.correctOptionId !== null) {
                const correctOptionIdStr = newQuestion.correctOptionId.toString();
                
                // If it's an index, convert to ObjectId
                if (!Types.ObjectId.isValid(correctOptionIdStr) && newQuestion.options) {
                  const index = parseInt(correctOptionIdStr);
                  if (!isNaN(index) && index >= 0 && index < newQuestion.options.length) {
                    const selectedOption = newQuestion.options[index];
                    if (selectedOption._id) {
                      newQuestion.correctOptionId = selectedOption._id;
                    }
                  }
                } else if (Types.ObjectId.isValid(correctOptionIdStr)) {
                  // It's already an ObjectId, use it directly
                  newQuestion.correctOptionId = new Types.ObjectId(correctOptionIdStr);
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
        console.log('Update completed (correctOptionId only)', {
          updatedId: updated._id?.toString(),
          updatedTitle: updated.title
        });
        return updated;
      }
      
      // Check if questions actually changed by comparing structure (excluding correctOptionId)
      const questionsChanged = this.haveQuestionsChanged(existingQuestionnaire.questions, questions);
      console.log('Questions changed (excluding correctOptionId)?', questionsChanged);
      
      if (questionsChanged) {
        // Log for debugging - show all questions
        console.log('Questions changed detected (excluding correctOptionId):', {
          existingCount: existingQuestionnaire.questions.length,
          newCount: questions.length,
          existingQuestions: existingQuestionnaire.questions.map((q, i) => ({
            index: i,
            type: q.type,
            text: q.questionText,
            correctOptionId: q.correctOptionId?.toString(),
            optionsCount: q.options?.length || 0,
            options: q.options?.map((opt: any, idx: number) => ({
              index: idx,
              text: opt.text,
              _id: opt._id?.toString()
            }))
          })),
          newQuestions: questions.map((q, i) => ({
            index: i,
            type: q.type,
            text: q.questionText,
            correctOptionId: q.correctOptionId?.toString(),
            optionsCount: q.options?.length || 0,
            options: q.options?.map((opt: any, idx: number) => ({
              index: idx,
              text: opt.text,
              _id: opt._id?.toString()
            }))
          }))
        });
        throw new Error(
          'Cannot modify questions after students have submitted. Create a new version of this questionnaire instead.'
        );
      }
      // If questions haven't changed, allow update of other fields only
      // Remove questions from updateData since they haven't changed
      console.log('Questions unchanged, updating other fields only', {
        otherFields: Object.keys(otherFields),
        hasQuestions: !!questions,
        questionsLength: questions?.length
      });
      const updated = await this.questionnaireRepository.update(id, otherFields);
      console.log('Update completed, returning updated questionnaire', {
        updatedId: updated._id?.toString(),
        updatedTitle: updated.title
      });
      return updated;
    }

    // If no questions in update or no submissions, proceed with normal update
    if (questions) {
      // Store correct option indices temporarily (for new questions or when updating)
      const correctOptionIndices: { [key: number]: number } = {};
      const updateData = { ...data };

      // Validate new questions structure and handle correctOptionId conversion
      for (let i = 0; i < updateData.questions!.length; i++) {
        const question = updateData.questions![i];
        if (question.type === 'MULTIPLE_CHOICE') {
          if (!question.options || question.options.length < 2) {
            throw new Error(`Multiple choice question must have at least 2 options`);
          }
          
          // Check if correctOptionId is a number/index (from frontend) or ObjectId
          if (question.correctOptionId !== undefined && question.correctOptionId !== null) {
            // If it's a number or string number (index), store it for later conversion
            const correctIndex = typeof question.correctOptionId === 'number'
              ? question.correctOptionId
              : parseInt(question.correctOptionId as any);
            
            // Check if it's a valid index (not NaN and not an ObjectId string)
            if (!isNaN(correctIndex) && !Types.ObjectId.isValid(question.correctOptionId as any)) {
              correctOptionIndices[i] = correctIndex;
              // Remove it temporarily so Mongoose doesn't validate it as ObjectId
              delete question.correctOptionId;
            }
            // If it's already an ObjectId, leave it as is
          } else {
            throw new Error(`Multiple choice question must have a correct answer`);
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
          
          if (newQuestion.type === 'MULTIPLE_CHOICE' && newQuestion.options) {
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
        for (const [questionIndex, optionIndex] of Object.entries(correctOptionIndices)) {
          const qIndex = parseInt(questionIndex);
          const question = updatedQuestionnaire.questions[qIndex];
          if (question && question.options && question.options[optionIndex]) {
            question.correctOptionId = question.options[optionIndex]._id;
          }
        }
        
        // Save the updated questionnaire with correct ObjectIds
        await updatedQuestionnaire.save();
        return updatedQuestionnaire;
      }

      return updatedQuestionnaire;
    }

    // If no questions to update, just update other fields
    return await this.questionnaireRepository.update(id, data);
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
        if (existing.type === 'MULTIPLE_CHOICE' && updated.type === 'MULTIPLE_CHOICE') {
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

          // If we get here, options are the same, so only correctOptionId could have changed
          // Check if correctOptionId actually changed
          const existingCorrectId = existing.correctOptionId?.toString();
          const updatedCorrectId = updated.correctOptionId?.toString();
          
          // If both are null/undefined, no change
          if (!existingCorrectId && !updatedCorrectId) {
            continue; // No change, continue to next question
          }
          
          // If one is null and the other isn't, it changed
          if (!existingCorrectId || !updatedCorrectId) {
            // This is a change, but it's only correctOptionId, so return true
            // (we'll check all questions first)
          } else {
            // Both have values - check if they're different
            // Find the option text for each to compare
            let existingCorrectOptionText: string | null = null;
            let updatedCorrectOptionText: string | null = null;
            
            // Find the option text for existing correctOptionId
            if (existing.options && existingCorrectId) {
              const existingOpt = existing.options.find(
                (opt: any) => opt._id?.toString() === existingCorrectId
              );
              if (existingOpt) {
                existingCorrectOptionText = String(existingOpt.text).trim();
              }
            }
            
            // Find the option text for updated correctOptionId
            if (updated.options && updatedCorrectId) {
              if (Types.ObjectId.isValid(updatedCorrectId)) {
                const updatedOpt = updated.options.find(
                  (opt: any) => opt._id?.toString() === updatedCorrectId
                );
                if (updatedOpt) {
                  updatedCorrectOptionText = String(updatedOpt.text).trim();
                }
              } else {
                // It's likely an index
                const index = parseInt(updatedCorrectId);
                if (!isNaN(index) && index >= 0 && index < updated.options.length) {
                  const updatedOpt = updated.options[index];
                  if (updatedOpt) {
                    updatedCorrectOptionText = String(updatedOpt.text).trim();
                  }
                }
              }
            }
            
            // If they point to different option texts, correctOptionId changed
            if (existingCorrectOptionText && updatedCorrectOptionText) {
              if (existingCorrectOptionText !== updatedCorrectOptionText) {
                // Different option texts - correctOptionId changed, but that's OK
                // Continue to check other questions
              } else {
                // Same option text - no change in correctOptionId
                // Continue to next question
              }
            } else {
              // Couldn't determine option texts - compare by ObjectId directly
              if (existingCorrectId !== updatedCorrectId) {
                // Different ObjectIds - correctOptionId changed, but that's OK
                // Continue to check other questions
              }
            }
          }
        }
      }

      // If we get here, only correctOptionId could have changed (or nothing changed)
      // Check if at least one correctOptionId actually changed
      for (let i = 0; i < existingQuestions.length; i++) {
        const existing = existingQuestions[i];
        const updated = newQuestions[i];
        
        if (existing.type === 'MULTIPLE_CHOICE' && updated.type === 'MULTIPLE_CHOICE') {
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
        if (existing.type === 'MULTIPLE_CHOICE' && updated.type === 'MULTIPLE_CHOICE') {
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
          
          const existingCorrectId = existing.correctOptionId?.toString();
          const updatedCorrectId = updated.correctOptionId?.toString();
          
          // If both are null/undefined, they're the same (no change in correctOptionId, which is OK)
          if (!existingCorrectId && !updatedCorrectId) {
            // Both are null/undefined, no change - continue to next question
            // (this continue is for the outer for loop)
          } else if (!existingCorrectId || !updatedCorrectId) {
            // If one is null and the other isn't, correctOptionId changed
            // But we're ignoring correctOptionId changes here, so continue
            // (this continue is for the outer for loop)
          } else {
            // Both have values, find the option text for each
            let existingCorrectOptionText: string | null = null;
            let updatedCorrectOptionText: string | null = null;
            
            // Find the option text for existing correctOptionId
            if (existing.options && existingCorrectId) {
              const existingOpt = existing.options.find(
                (opt: any) => opt._id?.toString() === existingCorrectId
              );
              if (existingOpt) {
                existingCorrectOptionText = String(existingOpt.text).trim();
              }
            }
            
            // Find the option text for updated correctOptionId
            if (updated.options && updatedCorrectId) {
              // Check if it's an ObjectId or index
              if (Types.ObjectId.isValid(updatedCorrectId)) {
                // It's an ObjectId - find it in updated options first
                let updatedOpt = updated.options.find(
                  (opt: any) => opt._id?.toString() === updatedCorrectId
                );
                if (updatedOpt) {
                  updatedCorrectOptionText = String(updatedOpt.text).trim();
                } else {
                  // Not found in updated, try to find in existing options by ObjectId
                  if (existing.options) {
                    const existingOpt = existing.options.find(
                      (opt: any) => opt._id?.toString() === updatedCorrectId
                    );
                    if (existingOpt) {
                      updatedCorrectOptionText = String(existingOpt.text).trim();
                    } else {
                      // ObjectId not found in either - this means the ObjectId from frontend doesn't match
                      // Since options are already verified to match by text/order,
                      // find the index of the existing correct option and use the same index in updated
                      const existingCorrectIndex = existing.options.findIndex(
                        (opt: any) => opt._id?.toString() === existingCorrectId
                      );
                      if (existingCorrectIndex >= 0 && updated.options[existingCorrectIndex]) {
                        // Use the text from the option at the same index in updated
                        updatedCorrectOptionText = String(updated.options[existingCorrectIndex].text).trim();
                      }
                    }
                  }
                }
              } else {
                // It's likely an index
                const index = parseInt(updatedCorrectId);
                if (!isNaN(index) && index >= 0 && index < (updated.options?.length || 0)) {
                  const updatedOpt = updated.options[index];
                  if (updatedOpt) {
                    updatedCorrectOptionText = String(updatedOpt.text).trim();
                  }
                } else if (!isNaN(index) && index >= 0 && index < (existing.options?.length || 0)) {
                  // Try existing options if not found in updated
                  const existingOpt = existing.options[index];
                  if (existingOpt) {
                    updatedCorrectOptionText = String(existingOpt.text).trim();
                  }
                }
              }
            }
            
            // Compare by option text - if they point to different texts, it changed
            // BUT: We're ignoring correctOptionId changes here, so if only correctOptionId changed,
            // we don't consider it a change for this method
            if (existingCorrectOptionText && updatedCorrectOptionText) {
              if (existingCorrectOptionText !== updatedCorrectOptionText) {
                // Different option texts - but this is a correctOptionId change, which we ignore
                // Continue to next question (don't return true)
              }
              // Same option text, no change (even if ObjectIds are different)
            } else {
              // Couldn't find option text for one or both - but we're ignoring correctOptionId changes
              // Continue to next question
            }
          }
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

    if (hasSubmissions) {
      throw new Error(
        'Cannot delete questionnaire with student submissions. Delete all submissions first or archive this questionnaire.'
      );
    }

    await this.questionnaireRepository.delete(id);
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
          correctOptionId: undefined, // Remove correct answer
        }));
        return questionnaireObj as QuestionnaireDoc;
      }

      // Only show correct answers if showCorrectAnswers is true and status is GRADED
      if (!questionnaire.showCorrectAnswers) {
        const questionnaireObj = questionnaire.toObject ? questionnaire.toObject() : questionnaire;
        questionnaireObj.questions = questionnaireObj.questions.map((q: any) => ({
          ...q,
          correctOptionId: undefined,
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
}

export default QuestionnaireService;
