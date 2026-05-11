import multer from 'multer';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { logger } from '../utils';
import BunnyService from './bunny.service';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { ICourse } from '../models/mongo/course.model';
import CourseRepository from '../repositories/course.repository';
import QuestionnaireService from '../services/questionnaire.service';
import QuestionnaireSubmissionRepository from '../repositories/questionnaireSubmission.repository';
import QuestionnaireRepository from '../repositories/questionnaire.repository';

// Conexión a la MongoDb
async function conection() {
    try {
        await mongoose.connect(process.env.DATABASE_URL!);
        const courseRepository = new CourseRepository(mongoose.connection);
        const questionnaireRepository = new QuestionnaireRepository(mongoose.connection);
        const questionnaireSubmissionRepository = new QuestionnaireSubmissionRepository(mongoose.connection);
        const questionnaireService = new QuestionnaireService(questionnaireRepository, questionnaireSubmissionRepository);
        return { courseRepository, questionnaireService };
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

export default conection;

// Interfaz para los datos del pdf
export async function main(req: Request, res: Response) {
    try {
        const courseId = req.params.courseId;
        const { courseRepository } = await conection();
        const course = await courseRepository.findOneById(courseId);
        
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        
        const programData = await mapCourseToPdfData(course);
        const programGeneratorService = new ProgramGeneratorService();
        const pdfBuffer = await programGeneratorService.generateProgramPDF(programData);
        
        // Configuración de la respuesta
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${programData.course?.name}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Error fetching course data:', error);
        throw error;
    }
}

interface CursosPdfData {
    course?: {
        name: string;
        presentacion?: string;
        descripcion?: string;
    };
    cuestionarios?: { title: string }[];
    dias?: string[];
    horarios?: string;
    precio?: number;
    modalidad?: string;
    teacherInfo?: { teacherName: string; email: string }[];
    contenidos?: { title: string; description?: string }[];
};

export async function mapCourseToPdfData(course: ICourse): Promise<CursosPdfData> {
    const { questionnaireService, courseRepository } = await conection();
    const questionnaires = await questionnaireService.findByCourseId(course._id.toString());
    const courses : any = await courseRepository.findOneById(course._id.toString()) as CursosPdfData;
  return {
    course: {
      name: course.name,
      presentacion: course.description,
      descripcion: course.longDescription,
    },
    cuestionarios: (questionnaires || []).filter((q: any) => q.status === 'ACTIVE').map((q: any) => ({ title: q.title })),
    dias: course.days,
    horarios: course.time,
    precio: course.price,
    modalidad: course.modality,
    teacherInfo: [ ...(courses.teacherInfo || []) ].map((t: any) => ({ teacherName: t.teacherName, email: t.email })),
    contenidos: (course.orderedContent || []).map((item: any) => ({ title: item.data.title, description: item.data.description })),
  };
}

/**
 * Generador de PDF para programas de cursos
 */
export class ProgramGeneratorService {
    private courseUploadService: CourseUploadService;

    constructor() {
        this.courseUploadService = new CourseUploadService();
    }

    public async generateProgramPDF(programData: CursosPdfData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers: Buffer[] = [];
                try {
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const finalBuffer = Buffer.concat(buffers);
                    resolve(finalBuffer);
                });

                doc.on('error', (err) => {
                    console.error('Error generating PDF:', err);
                    reject(err);
                });

                // Portada
                doc.fontSize(20).text(`${programData.course?.name}`, { align: 'center' });
                doc.moveDown();

                // Presentación
                doc.fontSize(14).text('Presentación', { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(`${programData.course?.presentacion}`);
                doc.moveDown();

                // Descripción
                if (programData.course?.descripcion) {
                    doc.fontSize(14).text('Descripción', { underline: true });
                    doc.moveDown();
                    doc.fontSize(12).text(`${programData.course?.descripcion}`);
                    doc.moveDown();
                }

                // Días y horarios
                if (programData.dias && programData.dias.length > 0) {
                    doc.fontSize(14).text('Días y horarios', { underline: true });
                    doc.moveDown();
                    doc.fontSize(12).text(`Días: ${programData.dias.join(', ')}`, { align: 'left' });
                    doc.fontSize(12).text(`Horarios: ${programData.horarios}`, { align: 'left' });
                    doc.moveDown();
                }

                // Precio
                if (programData.precio) {
                    doc.fontSize(14).text('Precio', { underline: true });
                    doc.moveDown();
                    doc.fontSize(12).text(`Precio: ${programData.precio}`);
                    doc.moveDown();
                }

                // Modalidad
                if (programData.modalidad) {
                    doc.fontSize(14).text('Modalidad', { underline: true });
                    doc.moveDown();
                    doc.fontSize(12).text(`${programData.modalidad}`);
                    doc.moveDown();
                }

                // Profesores
                if (programData.teacherInfo && programData.teacherInfo.length > 0) {
                    doc.fontSize(14).text('Profesores', { underline: true });
                    doc.moveDown();
                    programData.teacherInfo.forEach((teacherInfo: any) => {
                        doc.fontSize(12).text(`Profesor: ${teacherInfo.teacherName} ${teacherInfo.email}`);
                    });
                    doc.moveDown();
                }

                // Programa
                if (programData.contenidos && programData.contenidos.length > 0) {
                    doc.fontSize(14).text('Programa', { underline: true });
                    doc.moveDown();
                    programData.contenidos.forEach((contenido: any, i : number) => {
                        doc.fontSize(12).text(`Programa ${i + 1}: ${contenido.title}`);
                        if (contenido.description) {
                            doc.fontSize(10).text(`Descripción: ${contenido.description}`);
                        }
                        doc.moveDown();
                    });
                }

                // Cuestionarios
                if (programData.cuestionarios && programData.cuestionarios.length > 0) {
                    doc.fontSize(14).text('Cuestionarios', { underline: true });
                    doc.moveDown();
                    programData.cuestionarios.forEach((cuestionario: { title: string }, i: number) => {
                        doc.fontSize(12).text(`Cuestionario ${i + 1}: ${cuestionario.title}`);

                    });
                    doc.moveDown();
                }

                doc.end();
                logger.info(`✅ Program PDF generated successfully`);
            } catch (error) {
                logger.error('Error generating program PDF', error);
                reject(error);
            }
        });
    }
    async generateAndUploadProgramPDF(programData: CursosPdfData, oldUrl?: string): Promise<string> {
        // Si hay un PDF antiguo, eliminarlo antes de generar el nuevo
        if (oldUrl) {
            await this.courseUploadService.deleteProgramFile(oldUrl);
        }

        // Generar nuevo PDF y subirlo
        const pdfBuffer = await this.generateProgramPDF(programData);
        const filename = `${programData.course?.name}_${Date.now()}.pdf`;
        const programUrl = await this.courseUploadService.uploadProgramFile(pdfBuffer, filename, 'course-programs');
        return programUrl;
    }
}

// Configuración de Multer usando memoria para todos las imagenes
export const courseUploadFiles = multer({
    storage: multer.memoryStorage(), // Usar memoria para imagenes
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'imageFile') {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.includes(file.mimetype)) {
                return cb(null, true);
            }
            return cb(new Error('Tipo de archivo no permitido. Solo imágenes.'));
        }
        return cb(new Error('Campo de archivo no reconocido.'));
    },
});


/**
 * Servicio para manejar archivos de cursos con Bunny CDN
 */
export class CourseUploadService {
    private bunnyService: BunnyService;

    constructor() {
        this.bunnyService = BunnyService.getInstance();
    }

    /**
     * Sube una imagen de curso a Bunny CDN
     */
    async uploadCourseImage(file: Express.Multer.File): Promise<string> {
        // Preserve original filename when uploading to Bunny
        const cdnUrl = await this.bunnyService.uploadFilePreserveOriginal(file.buffer, file.originalname, 'course-images');
        logger.info(`✅ Course image uploaded to Bunny CDN: ${cdnUrl}`);
        return cdnUrl;
    }

    /**
     * Elimina una imagen de curso desde Bunny CDN
     */
    async deleteCourseImage(imageUrl: string): Promise<boolean> {
        try {
            // Si la URL es del CDN, eliminarla
            if (imageUrl.includes('bunnycdn') || imageUrl.includes('b-cdn.net')) {
                const deleted = await this.bunnyService.deleteFile(imageUrl);
                if (deleted) {
                    logger.info(`✅ Course image deleted from Bunny CDN: ${imageUrl}`);
                }
                return deleted;
            }

            // Si es una imagen antigua del filesystem local, no hacer nada
            logger.info(`ℹ️ Legacy image not deleted (local filesystem): ${imageUrl}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting course image: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Sube un archivo de programa de curso (PDF) a Bunny CDN
     */
    async uploadProgramFile(buffer: Buffer, filename: string, folder: string): Promise<string> {
        try {
            const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME!;
            const accessKey = process.env.BUNNY_STORAGE_API_KEY!;
            const cdnHostName = process.env.BUNNY_STORAGE_CDN_HOSTNAME;

            const url = `https://storage.bunnycdn.com/${storageZone}/${folder}/${filename}`;
            await axios.put(url, buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'AccessKey': accessKey,
                'Cache-Control': 'no-cache',
            },
            });

            const cdnUrl = `${cdnHostName}/${folder}/${filename}`;
            logger.info(`✅ Program file uploaded to Bunny CDN: ${cdnUrl}`);
            return cdnUrl;
        } catch (error) {
            logger.error(`Error uploading program file: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Eliminar un archivo de programa de curso (PDF) de Bunny CDN
     */
    async deleteProgramFile(programUrl: string): Promise<boolean> {
        try {
            // Si la URL es del CDN, eliminarla
            if (programUrl.includes('bunnycdn') || programUrl.includes('b-cdn.net')) {
                const deleted = await this.bunnyService.deleteFile(programUrl);
                if (deleted) {
                    logger.info(`✅ Program file deleted from Bunny CDN: ${programUrl}`);
                } else {
                    logger.warn(`⚠️ Program file not found or failed to delete from Bunny CDN: ${programUrl}`);
                }
                return deleted;
            }

            // Si no es una URL del CDN, no hacer nada
            logger.warn(`⚠️ Program file URL is not from Bunny CDN: ${programUrl}`);
            return false;
        } catch (error) {
            logger.error(`Error deleting program file: ${(error as Error).message}`);
            return false;
        }
    }
}

export const courseUploadService = new CourseUploadService();
