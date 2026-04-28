import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import QuestionnaireSubmissionRepository, { GradeReportEntry } from '@/repositories/questionnaireSubmission.repository';
import { courseProgressRepository } from '@/repositories/courseProgress.repository';
import { userRepository } from '@/repositories';
import { IQuestionnaireSubmission, IAnswer, QuestionnaireSubmissionDoc } from '@/models/mongo/questionnaireSubmission.model';
import { IQuestion } from '@/models/mongo/questionnaire.model';
import { Types, Schema } from 'mongoose';
import { logger } from '@/utils';
import { sendEmail } from '@/utils/emailer';
import config from '@/config';

class QuestionnaireSubmissionService {
  constructor(
    private readonly submissionRepository: QuestionnaireSubmissionRepository,
    private readonly questionnaireRepository: QuestionnaireRepository
  ) {}

  /**
   * Iniciar un nuevo envío de cuestionario
   */
  async startSubmission(studentId: string, questionnaireId: string): Promise<QuestionnaireSubmissionDoc> {
    const questionnaire = await this.questionnaireRepository.findById(questionnaireId);
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Check retry limits
    // Only count completed submissions (GRADED or SUBMITTED), not IN_PROGRESS
    const allAttempts = await this.submissionRepository.findByStudentAndQuestionnaire(studentId, questionnaireId);
    const completedAttempts = allAttempts.filter(
      (attempt: any) => attempt.status === 'GRADED' || attempt.status === 'SUBMITTED'
    );

    if (!questionnaire.allowRetries && completedAttempts.length > 0) {
      throw new Error('Retries not allowed for this questionnaire');
    }

    if (questionnaire.maxRetries && completedAttempts.length >= questionnaire.maxRetries) {
      throw new Error(`Maximum retries (${questionnaire.maxRetries}) exceeded`);
    }

    // Get next attempt number
    const attemptNumber = await this.submissionRepository.getNextAttemptNumber(studentId, questionnaireId);

    // Get student data for denormalization
    const student = await userRepository.getUserById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Create new submission
    return await this.submissionRepository.create({
      questionnaireId: questionnaire._id,
      courseId: questionnaire.courseId,
      studentId: new Types.ObjectId(studentId),
      studentName: `${student.firstName} ${student.lastName}`,
      studentEmail: student.email,
      profilePhotoUrl: student.profilePhotoUrl,
      attemptNumber,
      answers: [],
      status: 'IN_PROGRESS',
      autoGradedScore: 0,
      startedAt: new Date(),
    });
  }

  /**
   * Enviar respuestas y auto-calificar
   */
  async submitAnswers(submissionId: string, answers: IAnswer[]): Promise<QuestionnaireSubmissionDoc> {
    // Validar formato básico de las respuestas: questionId y selectedOptionId(s) deben ser ObjectId (string de 24 hex)
    const isValidObjectIdString = (v: any) => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);
    if (!answers || !Array.isArray(answers)) {
      throw { status: 400, key: 'validation.answers_required', message: 'Se requiere un arreglo de respuestas' };
    }
    for (const a of answers) {
      if (!a.questionId || !isValidObjectIdString(String(a.questionId))) {
        throw { status: 400, key: 'validation.invalid_question_id', message: 'Cada respuesta debe tener un questionId válido' };
      }
      if ((a as any).selectedOptionIds && Array.isArray((a as any).selectedOptionIds)) {
        for (const sid of (a as any).selectedOptionIds) {
          if (!isValidObjectIdString(String(sid))) {
            throw { status: 400, key: 'validation.invalid_selected_option_ids', message: 'Los selectedOptionIds deben ser _id válidos de las opciones (no índices)' };
          }
        }
      } else if (a.selectedOptionId) {
        if (!isValidObjectIdString(String(a.selectedOptionId))) {
          throw { status: 400, key: 'validation.invalid_selected_option_id', message: 'selectedOptionId debe ser un _id válido de la opción (no un índice)' };
        }
      }
    }

    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    if (submission.status !== 'IN_PROGRESS') {
      throw new Error('Submission already submitted');
    }

    const questionnaire = await this.questionnaireRepository.findById(submission.questionnaireId.toString());
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Validate all required questions are answered
    for (const question of questionnaire.questions) {
      if (question.required) {
        const answer = answers.find((a) => a.questionId.toString() === question._id!.toString());
        if (!answer) {
          throw new Error(`Question "${question.questionText}" is required`);
        }
      }
    }

    // Auto-grade multiple choice questions
    const { gradedAnswers, autoGradedScore } = this.autoGradeMultipleChoice(questionnaire.questions, answers);

    // Check if there are text questions
    const hasTextQuestions = questionnaire.questions.some((q) => q.type === 'TEXT');

    // Calculate if fully graded
    // Calculate if fully graded - Si es encuesta, siempre es GRADED con 100%
    const status = questionnaire.isSurvey ? 'GRADED' : (hasTextQuestions ? 'SUBMITTED' : 'GRADED');
    const finalScore = questionnaire.isSurvey ? 100 : (hasTextQuestions ? undefined : autoGradedScore);
    
    // Update submission
    const updated = await this.submissionRepository.update(submissionId, {
      answers: gradedAnswers,
      status,
      autoGradedScore: questionnaire.isSurvey ? 100 : autoGradedScore,
      finalScore, // <--- Esto ahora valdrá 100 si es encuesta
      submittedAt: new Date(),
    });

    // Auditoría: Esto es clave para que el alumno pueda ver su certificado
    if (status === 'GRADED' && finalScore !== undefined) {
      await courseProgressRepository.updateQuestionnaireProgress(
        submission.studentId.toString(),
        submission.courseId.toString(),
        submission.questionnaireId.toString(),
        finalScore // Mandará 100, marcando el ítem como completado con éxito
      );
    }

    // If fully graded (no text questions), update course progress
    if (status === 'GRADED' && finalScore !== undefined) {
      await courseProgressRepository.updateQuestionnaireProgress(
        submission.studentId.toString(),
        submission.courseId.toString(),
        submission.questionnaireId.toString(),
        finalScore
      );
    }

    // Si quedó en SUBMITTED (pendiente de corrección manual), notificar al/los profesor(es)
    if (status === 'SUBMITTED') {
      try {
        // Preferir creator del cuestionario como profesor responsable
        const professorId = questionnaire.createdBy?.toString();
        if (professorId) {
          const professor = await userRepository.getUserById(professorId);
          if (professor && professor.email) {
            const frontendBase = (config.FRONTEND_DOMAIN || '').split(',')[0] || '';
            const gradingUrl = `${frontendBase}/admin/questionnaires/${questionnaire._id?.toString()}/submissions`;
            await sendEmail({
              email: professor.email,
              subject: `Nuevo envío pendiente de corrección: ${questionnaire.title || 'Cuestionario'}`,
              html: `
                <div style="font-family: Inter, Arial, Helvetica, sans-serif; max-width:680px; margin:0 auto; background:#f4f6f8; padding:24px;">
                  <div style="background:#ffffff; border-radius:8px; padding:24px; box-shadow:0 2px 12px rgba(18,38,63,0.06);">
                    <h2 style="margin:0 0 8px; font-size:18px; color:#0f172a;">Nuevo envío pendiente de corrección</h2>
                    <p style="margin:0 0 12px; color:#374151;">El alumno <strong>${submission.studentName || '—'}</strong> realizó un envío para el cuestionario <strong>${questionnaire.title || ''}</strong> y requiere corrección manual.</p>
                    <p style="margin:12px 0; color:#374151;">Intento número: <strong>${submission.attemptNumber ?? '—'}</strong></p>
                    <p style="margin:16px 0 0;"><a href="${gradingUrl || '#'}" style="display:inline-block; background:#2563eb; color:#fff; padding:10px 14px; border-radius:6px; text-decoration:none; font-weight:600;">Ir a corregir envío</a></p>
                    <p style="margin:18px 0 0; color:#9ca3af; font-size:12px;">Equipo Cursala</p>
                  </div>
                </div>
              `,
            });
          }
        }
      } catch (notifyErr) {
        logger.error('Error notificando a profesor sobre envío pendiente', { error: (notifyErr as Error).message });
      }
    }

    return updated;
  }

  /**
   * Calificar preguntas de texto manualmente
   */
  async gradeTextQuestions(
    submissionId: string,
    gradedAnswers: Array<{ questionId: string; points: number; feedback?: string }>,
    professorId: string,
    overallFeedback?: string
  ): Promise<QuestionnaireSubmissionDoc> {
    

    const submission = await this.submissionRepository.findById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    

    // Allow grading of both SUBMITTED and GRADED submissions (for re-grading)
    if (submission.status !== 'SUBMITTED' && submission.status !== 'GRADED') {
      throw new Error('Submission must be submitted before grading');
    }

    const questionnaire = await this.questionnaireRepository.findById(submission.questionnaireId.toString());
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }
    

    // Update text answers with grades
    const updatedAnswers = submission.answers.map((answer) => {
      if (answer.questionType === 'TEXT') {
        const graded = gradedAnswers.find((g) => g.questionId === answer.questionId.toString());
        if (graded) {
          // Convert to plain object to avoid Mongoose subdocument issues
          return {
            questionId: answer.questionId,
            questionType: answer.questionType,
            textAnswer: answer.textAnswer,
            selectedOptionId: answer.selectedOptionId,
            selectedOptionIds: (answer as any).selectedOptionIds,
            isCorrect: answer.isCorrect,
            pointsAwarded: graded.points,
            feedback: graded.feedback,
          };
        }
      }
      // Convert to plain object
      return {
        questionId: answer.questionId,
        questionType: answer.questionType,
        textAnswer: answer.textAnswer,
        selectedOptionId: answer.selectedOptionId,
        selectedOptionIds: (answer as any).selectedOptionIds,
        isCorrect: answer.isCorrect,
        pointsAwarded: answer.pointsAwarded,
        feedback: answer.feedback,
      };
    });

    // Calculate final score
    const finalScore = this.calculateFinalScore(questionnaire.questions, updatedAnswers);

    // Update submission
    const updated = await this.submissionRepository.update(submissionId, {
      answers: updatedAnswers,
      status: 'GRADED',
      finalScore,
      gradedBy: new Types.ObjectId(professorId) as any,
      gradedAt: new Date(),
      feedback: overallFeedback,
    });
    

    // Update course progress
    await courseProgressRepository.updateQuestionnaireProgress(
      submission.studentId.toString(),
      submission.courseId.toString(),
      submission.questionnaireId.toString(),
      finalScore
    );
    
    // Notificar al alumno y enviar email (el transporte decide si realmente envía)
    try {
      try {
        // AUDITORÍA FIX: Solo enviamos emails reales en producción
        if (submission.studentEmail && process.env.NODE_ENV === 'production') {
          const frontendBase = (config.FRONTEND_DOMAIN || '').split(',')[0] || '';
          const questionnaireTitle = questionnaire.title || 'Tu cuestionario';
          await sendEmail({
            email: submission.studentEmail,
            subject: `Corrección disponible: ${questionnaireTitle}`,
            html: `
              <div style="font-family: Arial, Helvetica, sans-serif; max-width:680px; margin:0 auto; background:#f4f6f8; padding:24px;">
                <div style="background:#ffffff; border-radius:8px; padding:28px; box-shadow:0 2px 12px rgba(18,38,63,0.06);">
                  <h1 style="font-size:20px; color:#1f2937; margin:0 0 12px;">Corrección disponible</h1>
                  <p style="margin:0 0 18px; color:#374151; font-size:15px;">Hola <strong>${submission.studentName || ''}</strong>,</p>
                  <p style="margin:0 0 8px; color:#374151; font-size:15px;">Tu envío para el cuestionario <strong>${questionnaireTitle}</strong> fue corregido.</p>
                  <div style="display:flex; align-items:center; gap:12px; margin:16px 0;">
                    <div style="background:#eef2ff; color:#3730a3; font-weight:600; padding:10px 14px; border-radius:6px;">Puntuación: ${finalScore}%</div>
                    ${overallFeedback ? `<div style="flex:1; background:#f8fafc; padding:10px 14px; border-radius:6px; color:#374151;"><strong>Feedback:</strong> ${overallFeedback}</div>` : ''}
                  </div>
                  <p style="margin:18px 0 0;">
                    <a href="${frontendBase || '#'}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 16px; border-radius:6px; text-decoration:none; font-weight:600;">Ver mi corrección</a>
                  </p>
                  <p style="margin:22px 0 0; color:#9ca3af; font-size:13px;">Si no reconoces esta acción, contacta al equipo de soporte.</p>
                  <hr style="border:none; border-top:1px solid #eef2f6; margin:20px 0;" />
                  <p style="margin:0; color:#9ca3af; font-size:12px;">Equipo Cursala</p>
                </div>
              </div>
            `,
          });
        } else if (!submission.studentEmail) {
          logger.warn('No student email available; skipping sendEmail');
        } else {
          logger.info('Development environment detected; skipping sendEmail');
        }
      } catch (emailErr) {
        logger.error('Error enviando email de corrección al alumno', { error: (emailErr as Error).message });
      }

      // Enviar notificación persistente + SSE para el toast en frontend
      try {
        const svc = await import('./index');
        if (svc && svc.notificationService) {
          await svc.notificationService.sendNotification(submission.studentId.toString(), {
            title: 'Corrección disponible',
            message: `Tu corrección para "${questionnaire.title || 'el cuestionario'}" fue enviada. Puntuación: ${finalScore}`,
            type: 'success',
            metadata: {
              questionnaireId: submission.questionnaireId?.toString(),
              submissionId: submissionId,
            },
          });
        }
      } catch (notifErr) {
        logger.error('Error creando notificación de corrección', { error: (notifErr as Error).message });
      }
    } catch (err) {
      logger.error('Error en post-grading notifications', { error: (err as Error).message });
    }


    return updated;
  }

  /**
   * Auto-calificar preguntas de opción múltiple
   */
  private autoGradeMultipleChoice(
    questions: IQuestion[],
    answers: IAnswer[]
  ): { gradedAnswers: IAnswer[]; autoGradedScore: number } {
    let totalMCPoints = 0;
    let earnedMCPoints = 0;

    const gradedAnswers = answers.map((answer) => {
      const question = questions.find((q) => q._id!.toString() === answer.questionId.toString());
      if (!question) {
        // Convert to plain object
        return {
          questionId: answer.questionId,
          questionType: answer.questionType,
          textAnswer: answer.textAnswer,
          selectedOptionId: answer.selectedOptionId,
          selectedOptionIds: (answer as any).selectedOptionIds,
          isCorrect: answer.isCorrect,
          pointsAwarded: answer.pointsAwarded,
          feedback: answer.feedback,
        };
      }

      if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
        // Determine correct ids first. If there are no correct answers stored,
        // skip counting this question in the total auto-graded pool to avoid
        // penalizing students when the question wasn't configured correctly.
        // Support multiple correct options and multiple selected options
        const correctIds: string[] = [];
        if ((question as any).correctOptionIds && Array.isArray((question as any).correctOptionIds)) {
          for (const cid of (question as any).correctOptionIds) {
            if (cid) correctIds.push(cid.toString());
          }
        } else if ((question as any).correctOptionId) {
          correctIds.push((question as any).correctOptionId.toString());
        }

        if (correctIds.length === 0) {
          // Missing correct answers for this question in DB — log and skip its points
          logger.warn('Skipping auto-grade for question without correctOptionId(s)', {
            questionId: question._id?.toString(),
            questionnaireQuestion: question.questionText,
          });
          // Return the answer as-is but with 0 pointsAwarded so grading proceeds
          return {
            questionId: answer.questionId,
            questionType: answer.questionType,
            textAnswer: answer.textAnswer,
            selectedOptionId: answer.selectedOptionId,
            selectedOptionIds: (answer as any).selectedOptionIds,
            isCorrect: false,
            pointsAwarded: 0,
            feedback: answer.feedback,
          };
        }
        // Only count this question's points in the total if correct answers exist
        totalMCPoints += question.points;

        const selectedIds: string[] = [];
        if ((answer as any).selectedOptionIds && Array.isArray((answer as any).selectedOptionIds)) {
          for (const sid of (answer as any).selectedOptionIds) {
            if (sid) selectedIds.push(sid.toString());
          }
        } else if (answer.selectedOptionId) {
          selectedIds.push(answer.selectedOptionId.toString());
        }

        // Scoring with penalización por selecciones incorrectas (falsos positivos):
        // scoreRaw = (correctSelections - wrongSelections) / correctCount
        // no puede ser negativo (min 0). isCorrect = true solo para match exacto (mismo conjunto).
        const correctSet = new Set(correctIds);
        const selectedSet = new Set(selectedIds);
        const intersectionCount = [...correctSet].filter((v) => selectedSet.has(v)).length;
        const wrongSelections = [...selectedSet].filter((v) => !correctSet.has(v)).length;
        const correctCount = correctSet.size || 0;
        let isCorrect = false;
        let pointsAwarded = 0;
        if (correctCount > 0) {
          // exact match requires same size and same elements
          if (correctSet.size === selectedSet.size && [...correctSet].every((v) => selectedSet.has(v))) {
            isCorrect = true;
          }

          const penaltyFactor = 0.5; // cada selección incorrecta resta medio acierto
          const raw = (intersectionCount - penaltyFactor * wrongSelections) / correctCount;
          const ratio = Math.max(0, raw);
          pointsAwarded = Math.round(question.points * ratio);
          earnedMCPoints += pointsAwarded;
        } else {
          pointsAwarded = 0;
          earnedMCPoints += 0;
        }

        // Return graded answer object
        return {
          questionId: answer.questionId,
          questionType: answer.questionType,
          textAnswer: answer.textAnswer,
          selectedOptionId: answer.selectedOptionId,
          selectedOptionIds: (answer as any).selectedOptionIds,
          isCorrect,
          pointsAwarded,
          feedback: answer.feedback,
        };
      }

      // Convert to plain object for text questions
      return {
        questionId: answer.questionId,
        questionType: answer.questionType,
        textAnswer: answer.textAnswer,
        selectedOptionId: answer.selectedOptionId,
        selectedOptionIds: (answer as any).selectedOptionIds,
        isCorrect: answer.isCorrect,
        pointsAwarded: answer.pointsAwarded,
        feedback: answer.feedback,
      };
    });

    const autoGradedScore = totalMCPoints > 0 ? Math.round((earnedMCPoints / totalMCPoints) * 100) : 0;

    return { gradedAnswers, autoGradedScore };
  }

  /**
   * Calcular puntaje final combinando todas las preguntas
   */
  private calculateFinalScore(questions: IQuestion[], answers: IAnswer[]): number {
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints = answers.reduce((sum, a) => sum + (a.pointsAwarded || 0), 0);

    return totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  }

  /**
   * Obtener envíos de un estudiante
   */
  async getStudentSubmissions(studentId: string, questionnaireId: string): Promise<QuestionnaireSubmissionDoc[]> {
    return await this.submissionRepository.findByStudentAndQuestionnaire(studentId, questionnaireId);
  }

  /**
   * Obtener mejor puntaje de un estudiante
   */
  async getBestScore(studentId: string, questionnaireId: string): Promise<number | null> {
    const bestSubmission = await this.submissionRepository.getBestSubmission(studentId, questionnaireId);
    return bestSubmission?.finalScore || null;
  }

  /**
   * Obtener reporte de calificaciones
   */
  async getGradeReport(questionnaireId: string): Promise<QuestionnaireSubmissionDoc[]> {
    return await this.submissionRepository.getGradeReport(questionnaireId);
  }

  /**
   * Obtener un envío por ID
   */
  async getSubmissionById(id: string): Promise<QuestionnaireSubmissionDoc | null> {
    return await this.submissionRepository.findByIdWithStudent(id);
  }

  /**
   * Resetear intentos de un estudiante para un cuestionario
   * Elimina todas las submissions y el progreso del cuestionario
   */
  async resetStudentAttempts(studentId: string, questionnaireId: string): Promise<{ deletedCount: number }> {
    // Eliminar todas las submissions del estudiante para este cuestionario
    const deletedCount = await this.submissionRepository.deleteByStudentAndQuestionnaire(
      studentId,
      questionnaireId
    );

    // Eliminar el progreso del cuestionario del estudiante
    const questionnaire = await this.questionnaireRepository.findById(questionnaireId);
    if (questionnaire && questionnaire.courseId) {
      await courseProgressRepository.removeQuestionnaireProgress(
        studentId,
        questionnaire.courseId.toString(),
        questionnaireId
      );
    }

    return { deletedCount };
  }
}

export default QuestionnaireSubmissionService;
