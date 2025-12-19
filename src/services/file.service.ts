import fs from 'fs';
import path from 'path';
import {
  sanitizeImageFileName,
  sanitizeVideoFileName,
  sanitizeAnyFileName,
  isPathInAllowedDirectories,
} from '@/utils/fileSecurity.util';
import logger from '@/utils/logger';
import BunnyService from './bunny.service';

export default class FileService {
  private bunnyService: BunnyService;

  constructor() {
    this.bunnyService = new BunnyService();
  }

  /**
   * Obtiene la imagen de un archivo.
   * @param imageFileName - Nombre del archivo de la imagen o URL completa de Bunny CDN.
   * @param requestIP - IP del cliente (para logging de seguridad)
   * @returns El contenido de la imagen como Buffer o null si no existe.
   */
  async getFileImage(imageFileName: string, requestIP?: string): Promise<Buffer | null> {
    try {
      logger.info(`📂 getFileImage called with: "${imageFileName}"`);

      // Si es una URL de Bunny CDN, descargar directamente desde allí
      if (this.bunnyService.isBunnyCdnUrl(imageFileName)) {
        logger.info(`🐰 Detected Bunny CDN URL, downloading from CDN...`);
        const buffer = await this.bunnyService.downloadFile(imageFileName);
        if (buffer) {
          logger.info(`✅ Image downloaded from Bunny CDN: ${buffer.length} bytes`);
          return buffer;
        }
        logger.warn(`❌ Failed to download from Bunny CDN, falling back to local...`);
        // Si falla, continuar con el sistema local como fallback
      }

      // Sistema legacy: búsqueda en filesystem local
      // Validar y sanitizar el nombre del archivo
      const sanitizationResult = sanitizeImageFileName(imageFileName, requestIP);

      if (!sanitizationResult.isValid) {
        logger.warn(`❌ Sanitization failed: ${sanitizationResult.reason}`);
        throw new Error(`Invalid file name: ${sanitizationResult.reason}`);
      }

      const sanitizedFileName = sanitizationResult.fileName!;
      logger.info(`✅ Sanitized fileName: "${sanitizedFileName}"`);

      // Directorios permitidos (local y remoto)
      const allowedDirectories = [
        path.resolve(__dirname, '../static/images'),
        path.resolve(__dirname, '../static-remote/images')
      ];

      // Intentar primero el directorio remoto si existe
      let filePath = path.resolve(__dirname, '../static-remote/images', sanitizedFileName);
      let isRemote = true;

      if (!fs.existsSync(filePath)) {
        // Si no existe en remoto, intentar local
        filePath = path.resolve(__dirname, '../static/images', sanitizedFileName);
        isRemote = false;
        logger.info(`🔄 Remote image not found, trying local: "${filePath}"`);
      } else {
        logger.info(`🌐 Using remote image: "${filePath}"`);
      }

      logger.info(`📍 Full file path: "${filePath}"`);

      // Verificar que el archivo está dentro del directorio permitido
      if (!isPathInAllowedDirectories(filePath, allowedDirectories, requestIP)) {
        logger.warn(`🚨 Path traversal detected for: "${filePath}"`);
        throw new Error('Access denied: Path traversal attempt detected');
      }

      logger.info(`🔍 Checking if file exists: ${filePath}`);
      if (!fs.existsSync(filePath)) {
        logger.warn(`❌ File does not exist: ${filePath}`);

        // List files in both directories for debugging
        try {
          const localDir = path.resolve(__dirname, '../static/images');
          const remoteDir = path.resolve(__dirname, '../static-remote/images');

          logger.info(`📁 Local images directory (${fs.existsSync(localDir) ? fs.readdirSync(localDir).length : 0} files):`);
          if (fs.existsSync(localDir)) {
            const localFiles = fs.readdirSync(localDir);
            localFiles.slice(0, 5).forEach(f => logger.info(`  - ${f}`));
          }

          logger.info(`📁 Remote images directory (${fs.existsSync(remoteDir) ? fs.readdirSync(remoteDir).length : 0} files):`);
          if (fs.existsSync(remoteDir)) {
            const remoteFiles = fs.readdirSync(remoteDir);
            remoteFiles.slice(0, 5).forEach(f => logger.info(`  - ${f}`));
          }
        } catch (listError) {
          logger.error('Error listing directory contents:', listError);
        }

        return null;
      }

      const fileBuffer = fs.readFileSync(filePath);
      logger.info(`✅ File read successfully: ${fileBuffer.length} bytes from ${isRemote ? 'remote' : 'local'}`);
      return fileBuffer;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`❌ Error in getFileImage:`, error);
        throw new Error(`Error reading file image: ${error.message}`);
      }
      throw new Error('Unknown error reading file image');
    }
  }

  /**
   * Obtiene el video de un archivo.
   * @param videoFileName - Nombre del archivo del video.
   * @param requestIP - IP del cliente (para logging de seguridad)
   * @returns El contenido del video como Buffer o null si no existe.
   */
  async getFileVideo(videoFileName: string, requestIP?: string): Promise<Buffer | null> {
    try {
      // Validar y sanitizar el nombre del archivo
      const sanitizationResult = sanitizeVideoFileName(videoFileName, requestIP);

      if (!sanitizationResult.isValid) {
        throw new Error(`Invalid file name: ${sanitizationResult.reason}`);
      }

      const sanitizedFileName = sanitizationResult.fileName!;

      // Directorios permitidos (local y remoto)
      const allowedDirectories = [
        path.resolve(__dirname, '../static/videos'),
        path.resolve(__dirname, '../static-remote/videos')
      ];

      // Intentar primero el directorio remoto si existe
      let filePath = path.resolve(__dirname, '../static-remote/videos', sanitizedFileName);
      let isRemote = true;

      if (!fs.existsSync(filePath)) {
        // Si no existe en remoto, intentar local
        filePath = path.resolve(__dirname, '../static/videos', sanitizedFileName);
        isRemote = false;
        logger.info(`🔄 Remote video not found, trying local: "${filePath}"`);
      } else {
        logger.info(`🌐 Using remote video: "${filePath}"`);
      }

      // Verificar que el archivo está dentro del directorio permitido
      if (!isPathInAllowedDirectories(filePath, allowedDirectories, requestIP)) {
        throw new Error('Access denied: Path traversal attempt detected');
      }

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const fileBuffer = fs.readFileSync(filePath);
      logger.info(`✅ Video file read successfully: ${fileBuffer.length} bytes from ${isRemote ? 'remote' : 'local'}`);
      return fileBuffer;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading file video: ${error.message}`);
      }
      throw new Error('Unknown error reading file video');
    }
  }

  /**
   * Obtiene un archivo de materiales de soporte.
   * @param fileName - Nombre del archivo.
   * @param requestIP - IP del cliente (para logging de seguridad)
   * @returns El contenido del archivo como Buffer o null si no existe.
   */
  async getFile(fileName: string, requestIP?: string): Promise<Buffer | null> {
    try {
      // Validar y sanitizar el nombre del archivo (permite cualquier tipo)
      const sanitizationResult = sanitizeAnyFileName(fileName, requestIP);

      if (!sanitizationResult.isValid) {
        throw new Error(`Invalid file name: ${sanitizationResult.reason}`);
      }

      const sanitizedFileName = sanitizationResult.fileName!;

      // Directorios permitidos
      const allowedDirectories = [path.resolve(__dirname, '../static/supportMaterials')];

      // Construir ruta del archivo
      const filePath = path.resolve(__dirname, '../static/supportMaterials', sanitizedFileName);

      // Verificar que el archivo está dentro del directorio permitido
      if (!isPathInAllowedDirectories(filePath, allowedDirectories, requestIP)) {
        throw new Error('Access denied: Path traversal attempt detected');
      }

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading support material file: ${error.message}`);
      }
      throw new Error('Unknown error reading support material file');
    }
  }

  /**
   * Obtiene un archivo público.
   * @param fileName - Nombre del archivo.
   * @param requestIP - IP del cliente (para logging de seguridad)
   * @returns El contenido del archivo como Buffer o null si no existe.
   */
  async getPublicFile(fileName: string, requestIP?: string): Promise<Buffer | null> {
    try {
      // Validar y sanitizar el nombre del archivo (permite cualquier tipo)
      const sanitizationResult = sanitizeAnyFileName(fileName, requestIP);

      if (!sanitizationResult.isValid) {
        throw new Error(`Invalid file name: ${sanitizationResult.reason}`);
      }

      const sanitizedFileName = sanitizationResult.fileName!;

      // Directorios permitidos
      const allowedDirectories = [path.resolve(__dirname, '../static/filesPublic')];

      // Construir ruta del archivo
      const filePath = path.resolve(__dirname, '../static/filesPublic', sanitizedFileName);

      // Verificar que el archivo está dentro del directorio permitido
      if (!isPathInAllowedDirectories(filePath, allowedDirectories, requestIP)) {
        throw new Error('Access denied: Path traversal attempt detected');
      }

      if (!fs.existsSync(filePath)) {
        return null;
      }

      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading public file: ${error.message}`);
      }
      throw new Error('Unknown error reading public file');
    }
  }
}

