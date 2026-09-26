import multer from 'multer';
import path from 'path';

const rules: Record<string, { types: string[], maxSize: number }> = {
    file: { types: ['application/pdf', 'application/zip', 'application/x-rar-compressed', 'text/plain', 'text/x-python', 'application/sql', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'], maxSize: 50 * 1024 * 1024 },
};

export const uploadCourseAttachment = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
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
    }
})
