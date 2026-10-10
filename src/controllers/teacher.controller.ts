import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { logger, prepareResponse } from '../utils';

export default class TeacherController {
  uploadDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json(prepareResponse(400, 'ningún archivo fue proporcionado'));
      }

      const urls: { [key: string]: string } = {};

      // procesar cada archivo subido
      for (const fieldName in files) {
        const fileArray = files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];

          // generar nombre único para el archivo
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const ext = path.extname(file.originalname);
          const fileName = `${fieldName}-${timestamp}-${randomStr}${ext}`;

          // guardar en carpeta local (puedes cambiar a bunny cdn si quieres)
          const uploadsDir = path.join(__dirname, '../static/teacher-uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, file.buffer);

          // generar url del archivo (ajusta según tu setup)
          urls[fieldName] = `/api/v1/files/teacher/${fileName}`;

          logger.info(`✅ archivo subido: ${fileName} (${fieldName})`);
        }
      }

      return res.status(200).json(prepareResponse(200, 'archivos subidos exitosamente', { urls }));
    } catch (error) {
      logger.error(`❌ error al subir archivos: ${(error as Error).message}`);
      return res.status(500).json(prepareResponse(500, 'error al subir los archivos'));
    }
  };
}
