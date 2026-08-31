import multer from 'multer';

const rules: Record<string, { types: string[], maxSize: number }> = {
    photo: { types: ['image/jpeg', 'image/png', 'image/webp'], maxSize: 5 * 1024 * 1024 },
    cv: { types: ['application/pdf'], maxSize: 10 * 1024 * 1024 },
    signature: { types: ['image/png', 'image/webp', 'image/svg+xml'], maxSize: 2 * 1024 * 1024 },
};

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // límite genérico
    fileFilter: (req, file, cb) => {
        const rule = rules[file.fieldname];
        if (!rule) {
            return cb(new Error('INVALID_FIELD'));
        }

        if (!rule.types.includes(file.mimetype)) {
            return cb(new Error('INVALID_FILE_TYPE'));
        }
        cb(null, true);
    },
});