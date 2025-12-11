import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils';

// Directorios de almacenamiento
export const uploadDirImages = path.join(__dirname, '../static/images');
export const uploadDirFilesPublic = path.join(__dirname, '../static/filesPublic');

// Crear directorios si no existen
if (!fs.existsSync(uploadDirImages)) {
    fs.mkdirSync(uploadDirImages, { recursive: true });
}

if (!fs.existsSync(uploadDirFilesPublic)) {
    fs.mkdirSync(uploadDirFilesPublic, { recursive: true });
}

// Función para generar nombres únicos
const generateUniqueFileName = (file: Express.Multer.File): string => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const fileNameWithoutExtension = file.originalname.slice(0, -ext.length);
    return `${fileNameWithoutExtension}[${uniqueSuffix}]${ext}`;
};

// Configuración de almacenamiento de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'imageFile') {
            cb(null, uploadDirImages);
        } else if (file.fieldname === 'programFile') {
            cb(null, uploadDirFilesPublic);
        } else {
            cb(new Error('Campo de archivo no reconocido.'), '');
        }
    },
    filename: (req, file, cb) => {
        cb(null, generateUniqueFileName(file));
    },
});

export const courseUploadFiles = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'imageFile') {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
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
 * Servicio para manejar archivos de cursos
 */
export class CourseUploadService {
    /**
     * Elimina un archivo de imagen de curso
     */
    deleteImageFile(fileName: string): void {
        const filePath = path.join(uploadDirImages, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    logger.error(`Error deleting image: ${err.message}`);
                }
            });
        }
    }

    /**
     * Elimina un archivo de programa de curso
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
     * Resuelve archivos de curso desde la request
     */
    resolveFiles(files: Record<string, Express.Multer.File[]> | undefined): {
        imageUrl: string | undefined;
        programUrl: string | undefined;
    } {
        let imageUrl: string | undefined;
        let programUrl: string | undefined;

        if (files?.imageFile?.[0]) {
            imageUrl = files.imageFile[0].filename;
        }
        if (files?.programFile?.[0]) {
            programUrl = files.programFile[0].filename;
        }

        return { imageUrl, programUrl };
    }
}

export const courseUploadService = new CourseUploadService();
