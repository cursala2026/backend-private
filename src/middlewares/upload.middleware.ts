import multer from 'multer';
import path from 'path';

const rules: Record<string, { types: string[], maxSize: number }> = {
    photo: { types: ['image/jpeg', 'image/png', 'image/webp'], maxSize: 5 * 1024 * 1024 },
    cv: { types: ['application/pdf'], maxSize: 10 * 1024 * 1024 },
    signature: { types: ['image/png', 'image/webp', 'image/svg+xml'], maxSize: 2 * 1024 * 1024 },
    file: { types: ['application/pdf', 'application/zip', 'application/x-rar-compressed', 'text/plain', 'text/x-python', 'application/sql', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'], maxSize: 50 * 1024 * 1024 },
};

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // límite genérico
    fileFilter: (req, file, cb) => {
        const rule = rules[file.fieldname];
        if (!rule) {
            return cb(new Error('INVALID_FIELD'));
        }

        if (!rule.types.includes(file.mimetype)) {
            return cb(new Error('INVALID_FILE_TYPE'));
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExt = ['.pdf', '.zip', '.rar', '.txt', '.py', '.sql', '.jpg', '.jpeg', '.png', '.webp', '.svg'];
        if (!allowedExt.includes(ext)) {
            return cb(new Error('INVALID_EXTENSION'));
        }

        cb(null, true);
    },
});
