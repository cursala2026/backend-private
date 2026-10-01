import { Request, Response } from 'express';
import BunnyService from '../services/bunny.service';
import { courseService } from '../services';
import { ensureString } from '../utils/type-guards';
import { UserRoles } from '../models/enums/user.enum';

export default class CourseAttachmentController {
    private readonly bunny = BunnyService.getInstance();

    /**
     * POST /api/v1/courses/:id/attachments
     * Subida de material complementario
     */
    uploadCourseAttachment = async (req: Request, res: Response) => {
        try {
            const courseId = ensureString(req.params.id);
            const file = req.file;
            if (!file) return res.status(400).json({ message: 'No se ha proporcionado un archivo' });

            const course = await courseService.findOneById(courseId);
            if (!course) return res.status(404).json({ message: 'Curso no encontrado' });

            const isAdmin = req.user?.roles === UserRoles.ADMIN;
            const isTeacher = course.teachers?.some(
                (teacherId: any) => teacherId.toString() === req.user?._id.toString()
            );
            
            if (!isAdmin && !isTeacher) return res.status(403).json({ message: 'Acceso denegado' });

            const fileUrl = await this.bunny.uploadFile(
                file.buffer,
                file.originalname,
                `courses/${courseId}/attachments`
            );

            const attachment = {
                title: req.body.title || file.originalname,
                fileUrl,
                fileType: file.mimetype,
            };

            await courseService.addAttachment(courseId, req.body.lessonId, attachment);

            return res.status(201).json({ 
                fileUrl, 
                title: req.body.title || file.originalname,
                fileType: file.mimetype,
                sizeBytes: file.size, 
            });
        } catch (error) {
            return res.status(502).json({ message: 'Error al subir el archivo' });
        }
    };

    /**
     * POST /api/v1/courses/:id/videos
     * Registro de metadata de video
     */
    registerCourseVideo = async (req: Request, res: Response) => {
        try {
            const courseId = ensureString(req.params.id);
            const { title, videoUrl, durationSeconds } = req.body;

            if (!title || !videoUrl || !durationSeconds || durationSeconds < 1) return res.status(400).json({ message: 'Datos inválidos' });

            const course = await courseService.findOneById(courseId);
            if (!course) return res.status(404).json({ message: 'Curso no encontrado' });
            
            const isAdmin = req.user?.roles === UserRoles.ADMIN;
            const isTeacher = course.teachers?.some(
                (teacherId: any) => teacherId.toString() === req.user?._id.toString()
            );
            if (!isAdmin && !isTeacher) return res.status(403).json({ message: 'Acceso denegado' });

            if (!this.bunny.isStreamUrl(videoUrl)) return res.status(400).json({ message: 'URL de video inválida' });

            const videoId = this.bunny.generateUniqueFileName(videoUrl, 'video');

            const videoData = {
                title,
                videoUrl: `https://cursala.b-cdn.net/courses/${courseId}/videos/${videoId}`,
                durationSeconds,
            };

            await courseService.addVideo(courseId, req.body.lessonId, videoData);
            
            return res.status(201).json({
                videoId,
                videoUrl: `https://cursala.b-cdn.net/courses/${courseId}/videos/${videoId}`,
                durationSeconds,
            });
        } catch (error) {
            return res.status(500).json({ message: 'Error al registrar el video' });
        }
    };
}
