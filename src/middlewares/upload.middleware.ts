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
            return cb(new Error('Campo de archivo no permitido.'));
        }

        if (!rule.types.includes(file.mimetype)) {
            return cb(new Error(`Tipo de archivo no permitido para ${file.fieldname}`));
        }

        if (file.size > rule.maxSize) {
            return cb(new Error(`Archivo demasiado grande para ${file.fieldname}. Máximo ${rule.maxSize / (1024 * 1024)} MB.`));
        }

        cb(null, true);
    },
});