import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import QuestionnaireSubmissionRepository, { GradeReportEntry } from '@/repositories/questionnaireSubmission.repository';
import { courseProgressRepository } from '@/repositories/courseProgress.repository';
import { userRepository } from '@/repositories';
import { IQuestionnaireSubmission, IAnswer, QuestionnaireSubmissionDoc } from '@/models/mongo/questionnaireSubmission.model';
import { IQuestion } from '@/models/mongo/questionnaire.model';
import { Types, Schema } from 'mongoose';
import { logger } from '@/utils';

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
    const status = hasTextQuestions ? 'SUBMITTED' : 'GRADED';
    const finalScore = hasTextQuestions ? undefined : autoGradedScore;

    // Update submission
    const updated = await this.submissionRepository.update(submissionId, {
      answers: gradedAnswers,
      status,
      autoGradedScore,
      finalScore,
      submittedAt: new Date(),
    });

    // If fully graded (no text questions), update course progress
    if (status === 'GRADED' && finalScore !== undefined) {
      await courseProgressRepository.updateQuestionnaireProgress(
        submission.studentId.toString(),
        submission.courseId.toString(),
        submission.questionnaireId.toString(),
        finalScore
      );
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
          isCorrect: answer.isCorrect,
          pointsAwarded: answer.pointsAwarded,
          feedback: answer.feedback,
        };
      }

      if (question.type === 'MULTIPLE_CHOICE') {
        totalMCPoints += question.points;
        const isCorrect = answer.selectedOptionId?.toString() === question.correctOptionId?.toString();
        const pointsAwarded = isCorrect ? question.points : 0;
        earnedMCPoints += pointsAwarded;

        // Convert to plain object to avoid Mongoose subdocument issues
        return {
          questionId: answer.questionId,
          questionType: answer.questionType,
          textAnswer: answer.textAnswer,
          selectedOptionId: answer.selectedOptionId,
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
