import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import type { Request } from 'express';

type FileLike = { originalname?: string; fieldname?: string; mimetype?: string };

// Directorio remoto (desarrollo) - verificar si está montado
const remoteStaticDir = path.join(os.homedir(), 'cursala-remote-static');
const isRemoteMounted = fs.existsSync(remoteStaticDir);

// Directorios de almacenamiento
const uploadDirImages = isRemoteMounted
  ? path.join(remoteStaticDir, 'images')
  : path.join('/app/dist/src/static/images');
const uploadDirFilesPublic = isRemoteMounted
  ? path.join(remoteStaticDir, 'filesPublic')
  : path.join('/app/dist/src/static/files-public');
const uploadDirProfileImages = isRemoteMounted
  ? path.join(remoteStaticDir, 'profile-images')
  : path.join('/app/dist/src/static/profile-images');
export const uploadDirSignatures = isRemoteMounted
  ? path.join(remoteStaticDir, 'signatures')
  : path.join('/app/dist/src/static/signatures');
export const uploadDirMaterials = isRemoteMounted
  ? path.join(remoteStaticDir, 'materials')
  : path.join('/app/dist/src/static/materials');

// Log de configuración de directorios
console.log('🔧 File upload configuration:', {
  isRemoteMounted,
  remoteStaticDir,
  uploadDirSignatures,
  uploadDirProfileImages
});

// Crear directorios si no existen
if (!fs.existsSync(uploadDirImages)) {
  fs.mkdirSync(uploadDirImages, { recursive: true });
}

if (!fs.existsSync(uploadDirFilesPublic)) {
  fs.mkdirSync(uploadDirFilesPublic, { recursive: true });
}

if (!fs.existsSync(uploadDirProfileImages)) {
  fs.mkdirSync(uploadDirProfileImages, { recursive: true });
}

if (!fs.existsSync(uploadDirSignatures)) {
  fs.mkdirSync(uploadDirSignatures, { recursive: true });
}

if (!fs.existsSync(uploadDirMaterials)) {
  fs.mkdirSync(uploadDirMaterials, { recursive: true });
}

// Función para generar nombres únicos
export const generateUniqueFileName = (file: FileLike | Express.Multer.File, fieldname?: string): string => {
  // Use basename to avoid path traversal vectors coming from client
  const f = file as FileLike;
  const originalName = path.basename(f.originalname || 'file');
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(originalName);
  const fileNameWithoutExtension = originalName.slice(0, -ext.length);
  // Replace suspicious characters and limit length to avoid too long filenames
  const safeBase = fileNameWithoutExtension.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 128);
  // Add prefix based on fieldname
  const usedField = fieldname ?? f.fieldname ?? '';
  const prefix = usedField === 'signatureFile' ? 'signature-' : usedField === 'photo' ? 'profile-' : '';
  return `${prefix}${safeBase}[${uniqueSuffix}]${ext}`;
};

// Configuración de almacenamiento de multer
export function multerDestination(req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void): void;
export function multerDestination(req: Request | null, file: FileLike | Express.Multer.File, cb: (error: Error | null, destination: string) => void): void;
export function multerDestination(req: Request | null, file: FileLike | Express.Multer.File, cb: (error: Error | null, destination: string) => void): void {
  try {
    const f = file as FileLike;
    const field = f.fieldname ?? '';
    if (field === 'imageFile') {
      cb(null, uploadDirImages); // Directorio de imágenes
    } else if (field === 'cvFile' || field === 'programFile') {
      cb(null, uploadDirFilesPublic); // Directorio de PDFs
    } else if (field === 'photo') {
      cb(null, uploadDirProfileImages); // Directorio de imágenes de perfil
    } else if (field === 'signatureFile') {
      cb(null, uploadDirSignatures); // Directorio de firmas profesionales
    } else if (field === 'materialFile') {
      cb(null, uploadDirMaterials); // Directorio de materiales/plantillas
    } else {
      cb(new Error('Campo de archivo no reconocido.'), '');
    }
  } catch (error) {
    cb(new Error(`Error al determinar el destino del archivo: ${(error as Error).message}`), '');
  }
};

export function multerFilename(req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void): void;
export function multerFilename(req: Request | null, file: FileLike | Express.Multer.File, cb: (error: Error | null, filename: string) => void): void;
export function multerFilename(req: Request | null, file: FileLike | Express.Multer.File, cb: (error: Error | null, filename: string) => void): void {
  try {
    const f = file as FileLike;
    const field = f.fieldname ?? undefined;
    const uniqueFileName = generateUniqueFileName(file, field);
    cb(null, uniqueFileName);
  } catch (error) {
    cb(new Error(`Error al generar el nombre del archivo: ${(error as Error).message}`), '');
  }
};

// Función para eliminar archivo anterior
export const deleteOldFile = (
  fileName: string,
  directory: 'profile-images' | 'images' | 'filesPublic' | 'materials' | 'signatures'
): boolean => {
  try {
    let filePath: string;

    switch (directory) {
      case 'profile-images':
        filePath = path.join(uploadDirProfileImages, fileName);
        break;
      case 'images':
        filePath = path.join(uploadDirImages, fileName);
        break;
      case 'filesPublic':
        filePath = path.join(uploadDirFilesPublic, fileName);
        break;
      case 'materials':
        filePath = path.join(uploadDirMaterials, fileName);
        break;
      case 'signatures':
        filePath = path.join(uploadDirSignatures, fileName);
        break;
      default:
        return false;
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    // Log error silently without using console
    return false;
  }
};

export function multerFileFilter(req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void;
export function multerFileFilter(req: Request | null, file: FileLike | Express.Multer.File, cb: multer.FileFilterCallback): void;
export function multerFileFilter(req: Request | null, file: FileLike | Express.Multer.File, cb: multer.FileFilterCallback): void {
  try {
    const f = file as FileLike;
    const field = f.fieldname ?? '';
    const mimetype = f.mimetype ?? '';
    if (field === 'imageFile') {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Tipo de archivo no permitido. Solo imágenes.'));
    }
    if (field === 'cvFile' || field === 'programFile') {
      if (mimetype === 'application/pdf') {
        return cb(null, true);
      }
      return cb(new Error('Tipo de archivo no permitido. Solo PDFs.'));
    }
    if (field === 'photo') {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Tipo de archivo no permitido. Solo PNG, JPG, JPEG para fotos de perfil.'));
    }
    if (field === 'signatureFile') {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (allowedTypes.includes(mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Tipo de archivo no permitido. Solo PNG, JPG, JPEG para firmas profesionales.'));
    }
    if (field === 'materialFile') {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'text/plain',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/avi',
        'video/mov',
      ];
      if (allowedTypes.includes(mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Tipo de archivo no permitido. Solo documentos de Office, PDFs, imágenes, videos y texto.'));
    }
    return cb(new Error('Campo de archivo no reconocido.'));
  } catch (error) {
    return cb(new Error(`Error en el filtro de archivos: ${(error as Error).message}`));
  }
};

const storage = multer.diskStorage({
  destination: multerDestination,
  filename: multerFilename,
});

export const uploadFiles = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // Límite de 1GB
  fileFilter: multerFileFilter,
});
