import multer from 'multer';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { logger } from '../utils';
import BunnyService from './bunny.service';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { ICourse } from '../models/mongo/course.model';
import { ensureString } from '../utils/type-guards';
import CourseRepository from '../repositories/course.repository';

// Conexión a la MongoDb
async function conection() {
    try {
        await mongoose.connect(process.env.DATABASE_URL!);
        const courseRepository = new CourseRepository(mongoose.connection);
        return { courseRepository };
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

export default conection;

// Interfaz para los datos del pdf
export async function main(req: Request, res: Response) {
    try {
        const courseId = ensureString(req.params.courseId);
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
        descripcion?: string;
    };
    dias?: string[];
    horarios?: string;
    duracion?: number;
    modalidad?: string;
    contenidos?: { title: string; description?: string }[];
};

export async function mapCourseToPdfData(course: ICourse): Promise<CursosPdfData> {
    return {
        course: {
        name: course.name,
        descripcion: course.description,
        },
        dias: course.days,
        horarios: course.time,
        duracion: course.duration,
        modalidad: course.modality,
        contenidos: (course.classes || []).map((item: any) => ({ title: item?.title || item?.name, description: item?.description })),
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
            const doc = new PDFDocument({ size: 'A4', margin: 0 });
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

                doc.on('pageAdded', () => {
                    footer(doc);
                });

                function cleanText(str: string) {
                return str
                    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, '')
                    .replace(/•/g, '-')
                    .replace(/–/g, '-')
                    .replace(/—/g, '-')
                    .replace(/\uFFFD/g, '');
                }

                // Encabezado con logo de Cursala
                doc.image('src/static/images/cursala.png', 30, 20, { fit: [200, 200] });
                doc.moveTo(30, 80).lineTo(570, 80).strokeColor('#028dbb').lineWidth(1).stroke();
                let y = doc.y + 105;

                // Presentación
                if (programData.course?.descripcion) {
                    doc.font('Helvetica-Bold').fontSize(25).text(cleanText(`${programData.course?.name}`), 35, y, { width: 350 });
                    y = doc.y + 3;
                    doc.fillColor('gray').fontSize(12).text(cleanText(`${programData.course?.descripcion}`), 35, y, { width: 350 });
                }
                doc.image('src/static/images/certificado.png', 470, y - 25, { fit: [70, 70] });
                doc.image('src/static/images/birrete.png', 420, y, { fit: [70, 70] });

                y = doc.y + 10;
                let lineY = y + 80;

                // Días
                doc.moveTo(35, y).lineTo(560, y).strokeColor('#e4e4e4').lineWidth(1).stroke();
                doc.image('src/static/images/calendario.png', 77, y + 5, { fit: [35, 35] });
                doc.fillColor('#5924d3').fontSize(14).text('Días', 80, y + 45);
                if (programData.dias && programData.dias.filter(d => d && d.trim() !== '').length > 0) {
                    let diasY = y + 62;
                    if (programData.dias.length > 2) {
                        doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText('Varios días'), 65, diasY, { width: 60, align: 'center' });
                    } else {
                        programData.dias.forEach((dia: string) => {
                            doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText(dia), 68, diasY, { width: 55, align: 'center' });
                            diasY += 10;
                        });
                    }

                    if (diasY > lineY) lineY = diasY;
                } else {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText('-'), 67, y + 62, { width: 55, align: 'center' });
                }

                // Horarios
                doc.moveTo(35, y).lineTo(35, lineY).strokeColor('#e4e4e4').lineWidth(1).stroke();
                doc.moveTo(160, y + 10).lineTo(160, lineY - 10).strokeColor('#e4e4e4').lineWidth(1).stroke();
                doc.image('src/static/images/reloj.png', 207, y + 5, { fit: [35, 35] });
                doc.font('Helvetica-Bold').fillColor('#5924d3').fontSize(14).text('Horarios', 195, y + 45);
                if (programData.horarios && programData.horarios.trim() !== '') {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText(`${programData.horarios}`), 210, y + 62);
                } else {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText('-'), 223, y + 62);
                }

                // Modalidad
                doc.moveTo(290, y + 10).lineTo(290, lineY - 10).strokeColor('#e4e4e4').lineWidth(1).stroke();
                doc.image('src/static/images/laptop.png', 345, y + 5, { fit: [35, 35] });
                doc.font('Helvetica-Bold').fillColor('#5924d3').fontSize(14).text('Modalidad', 327, y + 45);
                if (programData.modalidad && programData.modalidad.trim() !== '') {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText(`${programData.modalidad}`), 343, y + 62);
                } else {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText('-'), 355, y + 62);
                }

                // Duración
                doc.moveTo(435, y + 10).lineTo(435, lineY - 10).strokeColor('#e4e4e4').lineWidth(1).stroke();
                doc.image('src/static/images/reloj_arena.png', 480, y + 5, { fit: [35, 35] });
                doc.font('Helvetica-Bold').fillColor('#5924d3').fontSize(14).text('Duración', 468, y + 45);
                if (programData.duracion && programData.duracion > 0) {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText(`${programData.duracion}`), 478, y + 62, { width: 35, align: 'center' });
                } else {
                    doc.font('Helvetica').fillColor('black').fontSize(12).text(cleanText('-'), 480, y + 62, { width: 35, align: 'center' });
                }
                doc.moveTo(560, y).lineTo(560, lineY).strokeColor('#e4e4e4').lineWidth(1).stroke();
                y = lineY;
                doc.moveTo(35, y).lineTo(560, y).strokeColor('#e4e4e4').lineWidth(1).stroke();

                // Temario
                if (programData.contenidos && programData.contenidos.length > 0) {
                    const contenidosValidos = programData.contenidos.filter(c => c?.title || c?.description);
                    if (contenidosValidos.length > 0) {
                        const pageHeight = doc.page.height;
                        const bottomMargin = 5;
                        const footerHeight = 100;
                        let itemY = y + 15;
                        let lines = itemY;

                        doc.moveTo(35, itemY).lineTo(560, itemY).strokeColor('#e4e4e4').lineWidth(1).stroke();
                        doc.image('src/static/images/libro.png', 40, itemY + 7, { fit: [30, 30] });
                        doc.fillColor('#5924d3').font('Helvetica-Bold').fontSize(16).text('Temario', 80, itemY + 13);
                        doc.moveTo(80, itemY + 33).lineTo(550, itemY + 33).strokeColor('#5924d3').lineWidth(1).stroke();
                        y = itemY + 50;

                        contenidosValidos.forEach((contenido: any, i : number) => {
                            let estimatedHeight = doc.heightOfString(contenido.title, { width: 480}) + 30;
                            if (contenido?.description) {
                                const description = cleanText(`${contenido.description}`);
                                const opciones = { width: 480 };
                                const lineas = splitLines(doc.font('Helvetica').fontSize(10), description, opciones.width);
                                estimatedHeight += (doc.currentLineHeight() * 5) + 20;
                            }

                            const freeSpace = pageHeight - y - footerHeight - bottomMargin;
                            if (estimatedHeight > freeSpace) {
                                // Salto de página
                                doc.moveTo(35, itemY).lineTo(35, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                                doc.moveTo(560, itemY).lineTo(560, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                                doc.moveTo(35, lines).lineTo(560, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                                footer(doc);

                                doc.addPage();
                                itemY = 20;
                                lines = itemY;

                                doc.moveTo(35, itemY).lineTo(560, itemY).strokeColor('#e4e4e4').lineWidth(1).stroke();
                                doc.image('src/static/images/libro.png', 40, itemY + 7, { fit: [30, 30] });
                                doc.fillColor('#5924d3').font('Helvetica-Bold').fontSize(16).text('Temario (cont.)', 80, itemY + 13);
                                doc.moveTo(80, itemY + 33).lineTo(550, itemY + 33).strokeColor('#5924d3').lineWidth(1).stroke();
                                y = itemY + 50; // Reiniciar Y para la nueva página
                            }

                            // Escribir el contenido
                            doc.image('src/static/images/cuadrado.png', 40, y - 5, { fit: [21, 21] });
                            doc.font('Helvetica-Bold').fillColor('black').fontSize(16).text(cleanText(`${i + 1}`), 40, y, { width: 20, align: 'center' });
                            if (contenido?.title) {
                                doc.fillColor('black').font('Helvetica-Bold').fontSize(14).text(cleanText(`${contenido.title}`), 65, y);
                                y = doc.y + 5;
                            } else {
                                doc.fillColor('black').font('Helvetica-Bold').fontSize(14).text(cleanText(`Clase`), 65, y);
                                y = doc.y + 5;
                            }

                            if (contenido?.description) {
                                const description = cleanText(`${contenido.description}`);
                                const opciones = { width: 480 };
                                const lineas = splitLines(doc.font('Helvetica').fontSize(10), description, opciones.width);

                                let textoFinal: string[];
                                if (lineas.length > 5) {
                                    textoFinal = lineas.slice(0, 5);
                                    let quinta = textoFinal[4];
                                    while (doc.widthOfString(quinta + '(...)') > opciones.width && quinta.length > 0) {
                                        quinta = quinta.slice(0, -1);
                                    }
                                    textoFinal[4] = quinta + '(...)'; // Agregar el punto suspensivo
                                } else {
                                    textoFinal = [...lineas];
                                    while (textoFinal.length < 5) textoFinal.push(''); // Rellenar con líneas vacías si hay menos de 5 líneas
                                }
                                doc.fillColor('black').font('Helvetica').fontSize(10).text(textoFinal.join('\n'), 70, y, opciones);
                                y = y + (doc.currentLineHeight() * 5) + 20;
                            }

                            if (y > lines) lines = y;
                            doc.moveTo(35, lines).lineTo(560, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                            y += 15;
                        });
                        doc.moveTo(35, itemY).lineTo(35, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                        doc.moveTo(560, itemY).lineTo(560, lines).strokeColor('#e4e4e4').lineWidth(1).stroke();
                    }
                }

                footer(doc);
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

function splitLines(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach(word => {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = doc.widthOfString(testLine);
        if (testWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
}

function footer(doc: PDFKit.PDFDocument) {
    // Pie de página
    const footerHeight = 150;
    const footerY = doc.page.height - footerHeight;
    doc.rect(0, footerY, doc.page.width, footerHeight).fill('#028dbb');
    doc.image('src/static/images/cursala_blanco.png', 50, footerY + 35, { fit: [150, 150] });
    doc.moveTo(230, footerY + 15).lineTo(230, footerY + 95).strokeColor('white').lineWidth(1).stroke();
    
    // Información de contacto
    doc.font('Helvetica').fillColor('white').fontSize(14).text('CONTACTO', 245, footerY + 13);
    doc.image('src/static/images/email.png', 245, footerY + 33, { fit: [18, 18] });
    doc.fontSize(10).text('info@cursala.com.ar', 273, footerY + 36);

    doc.image('src/static/images/web.png', 245, footerY + 53, { fit: [18, 18] });
    doc.text('www.cursala.com.ar', 273, footerY + 60);
    
    doc.image('src/static/images/telefono.png', 250, footerY + 77, { fit: [18, 18] });
    doc.text('+54 9 2612 38-0499', 270, footerY + 83);
    doc.moveTo(395, footerY + 15).lineTo(395, footerY + 95).strokeColor('white').lineWidth(1).stroke();
    
    // Redes sociales
    doc.fillColor('white').fontSize(14).text('SEGUINOS', 423, footerY + 13);
    doc.image('src/static/images/instagram.png', 420, footerY + 43, { fit: [30, 30] });
    doc.link(420, footerY + 43, 30, 30, 'https://www.instagram.com/cursala.online?igsh=aG4zaml1NGdjYXI4');
    
    doc.image('src/static/images/linkedin.png', 460, footerY + 43, { fit: [30, 30] });
    doc.link(460, footerY + 43, 30, 30, 'https://www.linkedin.com/company/cursala/');
    
    doc.image('src/static/images/youtube.png', 500, footerY + 43, { fit: [30, 30] });
    doc.link(500, footerY + 43, 30, 30, 'https://youtube.com/@cursalaenvivo?si=znn0m5gZfU6dBgtO');
    
    doc.image('src/static/images/facebook.png', 540, footerY + 43, { fit: [30, 30] });
    doc.link(540, footerY + 43, 30, 30, 'https://www.facebook.com/share/18h5Kz5uD5/');
    
    // Derechos de autor
    doc.moveTo(30, doc.page.height - 35).lineTo(570, doc.page.height - 35).strokeColor('white').lineWidth(1).stroke();
    doc.fontSize(12).text('© 2026 Cursala - Todos los derechos reservados', 170, doc.page.height - 25);
    
};

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
