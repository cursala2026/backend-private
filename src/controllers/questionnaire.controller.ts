import { NextFunction, Request, Response } from 'express';
import prepareResponse from '@/utils/api-response';
import { logger } from '@/utils';
import QuestionnaireService from '@/services/questionnaire.service';
import questionMediaUploadProgressService from '@/services/question-media-upload-progress.service';
import CourseService from '@/services/course.service';
import { EventEmitter } from 'events';
import fs from 'fs';
import { ensureString } from '@/utils/type-guards';

export default class QuestionnaireController {
  constructor(
    private readonly questionnaireService: QuestionnaireService,
    private readonly courseService: CourseService
  ) {}

  /**
   * Crear nuevo cuestionario
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json(prepareResponse(401, 'Not authenticated'));
      }

      // Sanitize and whitelist incoming fields to avoid unexpected data
      const body = req.body || {};
      const allowedTopFields = [
        'courseId',
        'title',
        'description',
        'status',
        'position',
        'questions',
        'passingScore',
        'allowRetries',
        'maxRetries',
        'showCorrectAnswers',
        'timeLimitMinutes',
      ];

      const questionnaireData: any = {};
      for (const k of allowedTopFields) {
        if (body[k] !== undefined) questionnaireData[k] = body[k];
      }

      // Sanitize questions if present
      if (Array.isArray(questionnaireData.questions)) {
        questionnaireData.questions = questionnaireData.questions.map((q: any) => {
          const allowedQuestionFields = [
            '_id',
            'id',
            'type',
            'questionText',
            'promptType',
            'promptMediaUrl',
            'promptMediaProvider',
            'order',
            'points',
            'required',
            'options',
            'correctOptionId',
            'correctOptionIds',
          ];
          const out: any = {};
          for (const f of allowedQuestionFields) {
            if (q[f] !== undefined) out[f] = q[f];
          }
          return out;
        });
      }

      const questionnaire = await this.questionnaireService.create(questionnaireData, user._id.toString());

      try {
        await this.courseService.rebuildOrderedContentForCourse(questionnaire.courseId.toString());
      } catch (fetchError) {
        console.error('Error fetching created questionnaire:', fetchError);
      }

      return res.status(201).json(prepareResponse(201, 'Questionnaire created successfully', questionnaire));
    } catch (error) {
      // Log error details to help debugging when 500 occurs from frontend
      try {
        logger.error('[QuestionnaireController.update] Error updating questionnaire', { error: (error as Error).message, stack: (error as Error).stack });
      } catch (e) {
        console.error('[QuestionnaireController.update] Error logging failed:', e);
      }
      return next(error);
    }
  };

  /**
   * Actualizar cuestionario
   */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = ensureString(req.params.questionnaireId);
      const body = req.body || {};
      const allowedTopFields = [
        'title',
        'description',
        'status',
        'position',
        'questions',
        'passingScore',
        'allowRetries',
        'maxRetries',
        'showCorrectAnswers',
        'timeLimitMinutes',
      ];

      const updateData: any = {};
      for (const k of allowedTopFields) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }

      if (Array.isArray(updateData.questions)) {
        updateData.questions = updateData.questions.map((q: any) => {
          const allowedQuestionFields = [
            '_id',
            'id',
            'type',
            'questionText',
            'promptType',
            'promptMediaUrl',
            'promptMediaProvider',
            'order',
            'points',
            'required',
            'options',
            'correctOptionId',
            'correctOptionIds',
          ];
          const out: any = {};
          for (const f of allowedQuestionFields) {
            if (q[f] !== undefined) out[f] = q[f];
          }
          return out;
        });
      }

      // Check if questionnaire already has submissions: if so, block edits
      try {
        const has = await this.questionnaireService.hasSubmissions(id);
        console.log('[DEBUG] Questionnaire update called', { questionnaireId: id, hasSubmissions: has, incomingBody: body });
        if (has) {
          return res.status(400).json(prepareResponse(400, 'Questionnaire has submissions and cannot be edited'));
        }
      } catch (dbgErr) {
        console.warn('[DEBUG] Failed to check hasSubmissions:', dbgErr);
      }

      const updated = await this.questionnaireService.update(id, updateData);

      try {
        await this.courseService.rebuildOrderedContentForCourse(updated.courseId.toString());
      } catch (fetchError) {
        console.error('Error fetching updated questionnaire:', fetchError);
      }

      return res.json(prepareResponse(200, 'Questionnaire updated successfully', updated));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Eliminar cuestionario
   */
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = ensureString(req.params.questionnaireId);

      // Obtener el cuestionario antes de eliminar para obtener el courseId
      const questionnaire = await this.questionnaireService.findById(id);
      if (!questionnaire) {
        return res.status(404).json(prepareResponse(404, 'Questionnaire not found'));
      }

      await this.questionnaireService.delete(id);

      try {
        await this.courseService.rebuildOrderedContentForCourse(questionnaire.courseId.toString());
      } catch (fetchError) {
        console.error('Error fetching deleted questionnaire:', fetchError);
      }

      return res.json(prepareResponse(200, 'Questionnaire deleted successfully'));
    } catch (error: any) {
      return next(error);
    }
  };

  /**
   * Obtener cuestionario por ID
   */
  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = ensureString(req.params.questionnaireId);
      const user = (req as any).user;

      // Only pass studentId if user is a student (ALUMNO), not if they're a professor or admin
      // This ensures professors can see correctOptionId when editing questionnaires
      const isStudent = user?.roles && Array.isArray(user.roles) && 
        user.roles.some((r: any) => String(r).toUpperCase() === 'ALUMNO') &&
        !user.roles.some((r: any) => String(r).toUpperCase() === 'PROFESOR' || String(r).toUpperCase() === 'ADMIN');
      
      const studentId = isStudent ? user?._id?.toString() : undefined;
      const userRoles = user?.roles || [];

      const questionnaire = await this.questionnaireService.findById(id, studentId, userRoles);

      if (!questionnaire) {
        return res.status(404).json(prepareResponse(404, 'Questionnaire not found'));
      }

      return res.json(prepareResponse(200, 'Questionnaire fetched successfully', questionnaire));
    } catch (error) {
      console.error('[QuestionnaireController.findById] Error fetching questionnaire:', error);
      return next(error);
    }
  };

  /**
   * Check if questionnaire has submissions
   */
  hasSubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = ensureString(req.params.questionnaireId);
      const has = await this.questionnaireService.hasSubmissions(id);
      return res.json(prepareResponse(200, 'Has submissions', { hasSubmissions: has }));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Listar cuestionarios por curso
   */
  findByCourse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = ensureString(req.params.courseId);

      const questionnaires = await this.questionnaireService.findByCourseId(courseId);
      return res.json(prepareResponse(200, 'Questionnaires fetched successfully', questionnaires));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Listar cuestionarios por profesor
   */
  findByProfessor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const professorId = ensureString(req.params.professorId);

      const questionnaires = await this.questionnaireService.findByProfessorId(professorId);
      return res.json(prepareResponse(200, 'Questionnaires fetched successfully', questionnaires));
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Subir / reemplazar media para una pregunta (asíncrono - procesa en segundo plano)
   */
  uploadQuestionMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId, questionId } = req.params as any;
      const user = (req as any).user;
      if (!user) return res.status(401).json(prepareResponse(401, 'Not authenticated'));

      // Multer file
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json(prepareResponse(400, 'No file uploaded'));

      // Determine promptType (prefer body, else infer from mimetype)
      const providedType = (req.body.promptType || '').toString().toUpperCase();
      let promptType: 'IMAGE' | 'VIDEO';
      if (providedType === 'IMAGE' || providedType === 'VIDEO') {
        promptType = providedType as any;
      } else if (file.mimetype.startsWith('image/')) {
        promptType = 'IMAGE';
      } else {
        promptType = 'VIDEO';
      }

      const uploadId = `${questionnaireId}_${questionId}`;

      // Marcar la pregunta como "processing"
      await this.questionnaireService.updateQuestionUploadStatus(questionnaireId, questionId, {
        mediaUploadStatus: 'processing',
        mediaOriginalName: file.originalname,
        promptType,
      });

      // Iniciar tracking de progreso
      questionMediaUploadProgressService.startTracking(uploadId);

      // Lanzar subida en segundo plano
      this.uploadMediaInBackground(questionnaireId, questionId, file.path, file.originalname, file.size, promptType, uploadId).catch((err) => {
        console.error('Error in background upload:', err);
      });

      // Retornar inmediatamente con status 202 (Accepted) - el cliente usará SSE para el progreso
      return res.status(202).json(
        prepareResponse(202, 'Upload started, use SSE for progress tracking', { uploadId })
      );
    } catch (error) {
      return next(error);
    }
  };

  /**
   * Subir media en segundo plano (imagen o video)
   */
  private async uploadMediaInBackground(
    questionnaireId: string,
    questionId: string,
    localFilePath: string,
    originalName: string,
    fileSize: number,
    promptType: 'IMAGE' | 'VIDEO',
    uploadId: string
  ): Promise<void> {
    try {
      let cdnUrl: string;

      if (promptType === 'IMAGE') {
        // Para imágenes, leer buffer y subir (usualmente son más pequeñas)
        const buffer = fs.readFileSync(localFilePath);
        cdnUrl = await this.questionnaireService.uploadImageMedia(buffer, originalName, (percent) => {
          questionMediaUploadProgressService.updateProgress(uploadId, percent);
        });
      } else {
        // Para videos, usar streaming (más eficiente para archivos grandes)
        const stream = fs.createReadStream(localFilePath);
        cdnUrl = await this.questionnaireService.uploadVideoMedia(stream, originalName, fileSize, (percent) => {
          questionMediaUploadProgressService.updateProgress(uploadId, percent);
        });
      }

      // Eliminar archivo local
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }

      // Actualizar la pregunta con la URL final y marcar como 'ready'
      await this.questionnaireService.updateQuestionUploadStatus(questionnaireId, questionId, {
        promptMediaUrl: cdnUrl,
        promptMediaProvider: 'BUNNY',
        mediaUploadStatus: 'ready',
      });

      // Marcar tracking como completado
      questionMediaUploadProgressService.finishTracking(uploadId);
    } catch (error) {
      // Limpiar archivo local en caso de error
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }

      // Marcar como error
      questionMediaUploadProgressService.setError(uploadId, (error as Error).message);
      await this.questionnaireService.updateQuestionUploadStatus(questionnaireId, questionId, {
        mediaUploadStatus: 'error',
      });

      throw error;
    }
  }

  /**
   * SSE endpoint para progreso de subida de media de pregunta
   */
  getQuestionMediaUploadProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionnaireId, questionId } = req.params as any;
      const uploadId = `${questionnaireId}_${questionId}`;

      // Configurar headers SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

      // Crear EventEmitter para este cliente
      const clientEmitter = new EventEmitter();

      // Registrar cliente SSE
      questionMediaUploadProgressService.registerSSEClient(uploadId, clientEmitter);

      // Enviar progreso inicial
      const initialProgress = questionMediaUploadProgressService.getProgress(uploadId);
      res.write(`data: ${JSON.stringify({ percent: initialProgress })}\n\n`);

      let lastSentPercent = initialProgress;

      // Escuchar eventos de progreso
      clientEmitter.on('progress', (data: { percent: number }) => {
        // Solo enviar si el porcentaje cambió (evitar spam)
        if (data.percent !== lastSentPercent && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ percent: data.percent })}\n\n`);
          lastSentPercent = data.percent;
        }
      });

      clientEmitter.on('complete', (data: { percent: number }) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ percent: data.percent })}\n\n`);
          res.end();
        }
      });

      clientEmitter.on('error', (data: { message: string }) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: data.message })}\n\n`);
          res.end();
        }
      });

      // Heartbeat cada 30 segundos para mantener conexión viva
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`: heartbeat\n\n`);
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup cuando el cliente se desconecte
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        questionMediaUploadProgressService.unregisterSSEClient(uploadId, clientEmitter);
        clientEmitter.removeAllListeners();
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);
    } catch (error) {
      return next(error);
    }
  };
}
