import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils';
import BunnyService from './bunny.service';

// Directorios de almacenamiento (para PDFs solamente ahora)
export const uploadDirFilesPublic = path.join(__dirname, '../static/filesPublic');

// Crear directorio si no existe
if (!fs.existsSync(uploadDirFilesPublic)) {
    fs.mkdirSync(uploadDirFilesPublic, { recursive: true });
}

// Función para generar nombres únicos para PDFs
const generateUniquePdfFileName = (file: Express.Multer.File): string => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const fileNameWithoutExtension = file.originalname.slice(0, -ext.length);
    return `${fileNameWithoutExtension}[${uniqueSuffix}]${ext}`;
};

// Configuración de Multer usando memoria para todos los archivos
export const courseUploadFiles = multer({
    storage: multer.memoryStorage(), // Usar memoria para todo
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'imageFile') {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.includes(file.mimetype)) {
                return cb(null, true);
            }
            return cb(new Error('Tipo de archivo no permitido. Solo imágenes.'));
        }
        if (file.fieldname === 'programFile') {
            if (file.mimetype === 'application/pdf') {
                return cb(null, true);
            }
            return cb(new Error('Tipo de archivo no permitido. Solo PDFs.'));
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
        this.bunnyService = new BunnyService();
    }

    /**
     * Sube una imagen de curso a Bunny CDN
     */
    async uploadCourseImage(file: Express.Multer.File): Promise<string> {
        const fileName = this.bunnyService.generateUniqueFileName(file.originalname, 'course');
        const cdnUrl = await this.bunnyService.uploadFile(file.buffer, fileName, 'course-images');
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
     * Elimina un archivo de programa de curso (PDF)
     */
    deleteProgramFile(fileName: string): void {
        const filePath = path.join(uploadDirFilesPublic, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    logger.error(`Error deleting program file: ${err.message}`);
                }
            });
        }
    }

    /**
     * Guarda un archivo de programa (PDF) desde el buffer en memoria
     */
    async saveProgramFile(file: Express.Multer.File): Promise<string> {
        try {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            const fileNameWithoutExtension = file.originalname.slice(0, -ext.length);
            const fileName = `${fileNameWithoutExtension}[${uniqueSuffix}]${ext}`;
            const filePath = path.join(uploadDirFilesPublic, fileName);

            // Escribir el buffer en disco
            await fs.promises.writeFile(filePath, file.buffer);
            
            logger.info(`✅ Program file saved: ${fileName}`);
            return fileName;
        } catch (error) {
            logger.error(`Error saving program file: ${(error as Error).message}`);
            throw error;
        }
    }
}

export const courseUploadService = new CourseUploadService();
