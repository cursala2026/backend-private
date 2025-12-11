import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Directorio de almacenamiento para tickets de pago
export const uploadDirPayments = path.join(__dirname, '../static/payments');

// Crear directorio si no existe
if (!fs.existsSync(uploadDirPayments)) {
    fs.mkdirSync(uploadDirPayments, { recursive: true });
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
        cb(null, uploadDirPayments);
    },
    filename: (req, file, cb) => {
        cb(null, generateUniqueFileName(file));
    },
});

export const uploadPaymentTicket = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB límite
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(new Error('Tipo de archivo no permitido. Solo imágenes (JPEG, PNG) y PDFs.'));
    },
});
