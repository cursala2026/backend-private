import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Directorios de almacenamiento
export const uploadDirImages = path.join(__dirname, '../static/images');
export const uploadDirVideos = path.join(__dirname, '../static/videos');
export const uploadDirSupportMaterials = path.join(__dirname, '../static/supportMaterials');
export const uploadDirChunks = path.join(__dirname, '../static/chunks');

// Crear directorios si no existen
[uploadDirImages, uploadDirVideos, uploadDirSupportMaterials, uploadDirChunks].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Mapa para almacenar relación uploadId -> nombre de archivo ensamblado
export const assembledFilesMap = new Map<string, string>();

/**
 * Genera un nombre único para un archivo basado en el archivo original
 */
export const generateUniqueFileName = (file: unknown): string => {
    const f = file as unknown as Express.Multer.File;
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(f.originalname);
    const fileNameWithoutExtension = f.originalname.slice(0, -ext.length);
    return `${fileNameWithoutExtension}[${uniqueSuffix}]${ext}`;
};

/**
 * Genera un nombre único a partir del nombre original del archivo
 */
export const generateUniqueFileNameFromOriginal = (originalName: string): string => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(originalName);
    const fileNameWithoutExtension = originalName.slice(0, -ext.length);
    return `${fileNameWithoutExtension}[${uniqueSuffix}]${ext}`;
};

// Configuración de multer para chunks
const chunkStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirChunks);
    },
    filename: (req, file, cb) => {
        const tempName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        cb(null, tempName);
    },
});

export const uploadChunkMulter = multer({
    storage: chunkStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB por chunk
});

// Configuración de multer para archivos completos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            if (file.fieldname === 'imageFile') {
                cb(null, uploadDirImages);
            } else if (file.fieldname === 'videoFile') {
                cb(null, uploadDirVideos);
            } else if (file.fieldname === 'supportMaterials') {
                cb(null, uploadDirSupportMaterials);
            } else {
                cb(new Error('Campo de archivo no reconocido.'), '');
            }
        } catch (error) {
            cb(new Error(`Error al determinar el destino del archivo: ${(error as Error).message}`), '');
        }
    },
    filename: (req, file, cb) => {
        try {
            const uniqueFileName = generateUniqueFileName(file);
            cb(null, uniqueFileName);
        } catch (error) {
            cb(new Error(`Error al generar el nombre del archivo: ${(error as Error).message}`), '');
        }
    },
});

export const uploadFiles = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
    fileFilter: (req, file, cb) => {
        try {
            if (file.fieldname === 'imageFile') {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Tipo de archivo no permitido para la imagen. Solo imágenes.'));
                }
            } else if (file.fieldname === 'videoFile') {
                const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Tipo de archivo no permitido para el video. Solo videos.'));
                }
            } else if (file.fieldname === 'supportMaterials') {
                cb(null, true);
            } else {
                cb(new Error('Campo de archivo no reconocido.'));
            }
        } catch (error) {
            cb(new Error(`Error en el filtro de archivos: ${(error as Error).message}`));
        }
    },
}).fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 },
    { name: 'supportMaterials', maxCount: 10 },
]);
