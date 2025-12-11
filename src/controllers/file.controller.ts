import { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs, { createReadStream, statSync } from 'fs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import http from 'http';
import { logger, prepareResponse } from '../utils';
import FileService from '@/services/file.service';
import config from '@/config';
import { getClientIP } from '@/utils/fileSecurity.util';

export default class FileController {
  constructor(private readonly fileService: FileService) {}

  getFileImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { imageFileName } = req.params;
      const clientIP = getClientIP(req);

      const fileBuffer = await this.fileService.getFileImage(imageFileName, clientIP);
      if (!fileBuffer) {
        return res.status(404).json(prepareResponse(404, 'Image not found'));
      }

      // Detect correct MIME type based on file extension
      const fileExtension = imageFileName.toLowerCase().split('.').pop();
      let contentType = 'image/jpeg'; // default

      if (fileExtension === 'png') {
        contentType = 'image/png';
      } else if (fileExtension === 'gif') {
        contentType = 'image/gif';
      } else if (fileExtension === 'webp') {
        contentType = 'image/webp';
      }

      // Security headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      res.send(fileBuffer);
    } catch (error) {
      return next(error);
    }
  };

  getFileVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoFileName } = req.params;

      const videoPath = path.join(__dirname, '../static/videos', videoFileName);

      if (!fs.existsSync(videoPath)) {
        return res.status(404).json(prepareResponse(404, 'Video not found'));
      }

      // Optimizaciones para streaming
      this.streamVideoFile(videoPath, req, res);
    } catch (error) {
      logger.error(`Error in getFileVideo: ${(error as Error).message}`);
      return next(error);
    }
  };

  // 🎞️ Método optimizado para streaming de video
  private streamVideoFile = (videoPath: string, req: Request, res: Response) => {
    const videoStats = statSync(videoPath);
    const fileSize = videoStats.size;
    const { range } = req.headers;

    // Headers de cache y seguridad
    const baseHeaders = {
      'Accept-Ranges': 'bytes',
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600, immutable',
      ETag: `"${videoStats.mtime.getTime()}-${fileSize}"`,
      'Last-Modified': videoStats.mtime.toUTCString(),
    };

    // Verificar ETag para cache
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === baseHeaders.ETag) {
      return res.status(304).end();
    }

    if (range) {
      // Streaming con Range Requests
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res
          .status(416)
          .set({
            'Content-Range': `bytes */${fileSize}`,
            ...baseHeaders,
          })
          .send('Requested range not satisfiable');
        return;
      }

      const chunkSize = end - start + 1;

      logger.info(
        `📹 Streaming video: ${path.basename(videoPath)}, Range: ${start}-${end}/${fileSize} (${(chunkSize / 1024 / 1024).toFixed(2)}MB)`
      );

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        ...baseHeaders,
      });

      const videoStream = createReadStream(videoPath, { start, end });

      videoStream.on('error', (err) => {
        logger.error(`❌ Error reading video file: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error reading the video file');
        }
      });

      videoStream.on('end', () => {
        logger.info(`✓ Video chunk sent successfully: ${start}-${end}`);
      });

      videoStream.pipe(res);
    } else {
      // Streaming completo
      logger.info(
        `📹 Streaming complete video: ${path.basename(videoPath)} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`
      );

      res.writeHead(200, {
        'Content-Length': fileSize,
        ...baseHeaders,
      });

      const videoStream = createReadStream(videoPath);

      videoStream.on('error', (err) => {
        logger.error(`❌ Error reading video file: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error reading the video file');
        }
      });

      videoStream.on('end', () => {
        logger.info(`✓ Complete video sent successfully`);
      });

      videoStream.pipe(res);
    }
  };

  getFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileName } = req.params;
      const filePath = path.join(__dirname, '../static/supportMaterials', fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json(prepareResponse(404, 'File not found'));
      }

      const fileStats = statSync(filePath);
      const fileSize = fileStats.size;

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Type': 'application/octet-stream',
      });

      const fileStream = createReadStream(filePath);
      fileStream.on('error', (err) => {
        logger.error(`Error reading the file: ${err.message}`);
        res.status(500).send('Error reading the file');
      });
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Error in getFile: ${(error as Error).message}`);
      return next(error);
    }
  };

  getPublicFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicFile } = req.params;
      const clientIP = getClientIP(req);

      // Usar el servicio que ahora tiene validación de seguridad
      const fileBuffer = await this.fileService.getPublicFile(publicFile, clientIP);

      if (!fileBuffer) {
        return res.status(404).json(prepareResponse(404, 'File not found'));
      }

      // Security headers
      res.setHeader('Content-Length', fileBuffer.length.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(publicFile)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      res.send(fileBuffer);
    } catch (error) {
      logger.error(`Error in getPublicFile: ${(error as Error).message}`);
      return next(error);
    }
  };

  // 🎆 Nuevo endpoint directo para streaming optimizado
  getDirectFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path: filePath, auth } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json(prepareResponse(400, 'Path parameter is required'));
      }

      logger.debug(`📥 Direct file request - Raw path: ${filePath}`);

      // Parsear el path: /file/{fileName}/{action} o /user/{fileName}/image
      const pathParts = filePath.split('/');
      logger.debug(`📋 Path parts (${pathParts.length}): ${JSON.stringify(pathParts)}`);

      if (pathParts.length < 4) {
        logger.warn(`❌ Invalid path format - expected at least 4 parts, got ${pathParts.length}`);
        return res.status(400).json(prepareResponse(400, 'Invalid path format'));
      }

      const [, fileType, rawFileName, action] = pathParts;
      const fileName = decodeURIComponent(rawFileName);

      logger.debug(`📝 Extracted - Type: "${fileType}", Raw: "${rawFileName}", Decoded: "${fileName}", Action: "${action}"`);

      // Validar autenticación para acciones protegidas
      if (['video', 'download'].includes(action)) {
        if (!auth || typeof auth !== 'string') {
          return res.status(401).json(prepareResponse(401, 'Authentication required'));
        }

        try {
          // Validar token (puede venir como "Bearer token" o solo "token")
          const token = auth.replace('Bearer ', '').replace('bearer ', '');
          jwt.verify(token, config.JWT_SECRET as jwt.Secret);
          logger.info(`🔐 User authenticated for ${action}: ${fileName}`);
        } catch (error) {
          logger.warn(`🚫 Invalid token for ${action}: ${fileName}`);
          return res.status(401).json(prepareResponse(401, 'Invalid authentication token'));
        }
      }

      // Validar nombre de archivo (seguridad) - solo path traversal
      if (fileName.includes('..')) {
        logger.warn(`🚨 Path traversal attempt detected: ${fileName}`);
        return res.status(400).json(prepareResponse(400, 'Invalid file name'));
      }

      // Enrutar según la acción y tipo de archivo
      logger.debug(`🔀 Routing to handler for action: ${action}, fileType: ${fileType}`);
      switch (action) {
        case 'video':
          await this.handleDirectVideo(fileName, req, res);
          break;
        case 'image':
          // Si es /user/, servir desde profile-images; si es /file/, servir desde images
          if (fileType === 'user') {
            await this.handleDirectUserProfileImage(fileName, req, res);
          } else {
            await this.handleDirectImage(fileName, req, res);
          }
          break;
        case 'download':
          await this.handleDirectDownload(fileName, req, res);
          break;
        case 'publicdownload':
          await this.handleDirectPublicDownload(fileName, req, res);
          break;
        default:
          logger.warn(`❌ Invalid action: ${action}`);
          return res.status(400).json(prepareResponse(400, 'Invalid action'));
      }
    } catch (error) {
      logger.error(`❌ Error in getDirectFile: ${(error as Error).message}`, { stack: (error as Error).stack });
      return next(error);
    }
  };

  private handleDirectVideo = async (fileName: string, req: Request, res: Response) => {
    let videoPath = path.join(__dirname, '../static-remote/videos', fileName);
    let isRemote = true;

    if (!fs.existsSync(videoPath)) {
      // Si no existe en remoto, intentar local
      videoPath = path.join(__dirname, '../static/videos', fileName);
      isRemote = false;
      logger.info(`🔄 Remote video not found, trying local: "${videoPath}"`);
    } else {
      logger.info(`🌐 Using remote video: "${videoPath}"`);
    }

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json(prepareResponse(404, 'Video not found'));
    }

    logger.info(`📹 Streaming video from ${isRemote ? 'remote' : 'local'}: ${path.basename(videoPath)}`);

    // Usar el método optimizado de streaming
    this.streamVideoFile(videoPath, req, res);
  };

  private handleDirectImage = async (fileName: string, req: Request, res: Response) => {
    try {
      logger.info(`🖼️  handleDirectImage called with fileName: "${fileName}"`);
      const clientIP = getClientIP(req);

      logger.info(`📞 Calling fileService.getFileImage for: "${fileName}"`);
      const fileBuffer = await this.fileService.getFileImage(fileName, clientIP);

      if (!fileBuffer) {
        logger.warn(`⚠️  Image not found: "${fileName}", serving placeholder instead`);
        // Servir imagen placeholder en lugar de devolver 404
        try {
          const placeholderPath = path.join(__dirname, '../static/images', 'placeholder.course.png');
          if (fs.existsSync(placeholderPath)) {
            const placeholderBuffer = fs.readFileSync(placeholderPath);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(placeholderBuffer);
          }
        } catch (placeholderError) {
          logger.error(`❌ Error loading placeholder: ${(placeholderError as Error).message}`);
        }
        // Si no hay placeholder, devolver 404
        return res.status(404).json(prepareResponse(404, 'Image not found'));
      }

      logger.info(`✅ Image loaded successfully: "${fileName}" (${fileBuffer.length} bytes)`);

      // Detect correct MIME type based on file extension
      const fileExtension = fileName.toLowerCase().split('.').pop();
      let contentType = 'image/jpeg'; // default

      if (fileExtension === 'png') {
        contentType = 'image/png';
      } else if (fileExtension === 'gif') {
        contentType = 'image/gif';
      } else if (fileExtension === 'webp') {
        contentType = 'image/webp';
      }

      // Security headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos para desarrollo

      res.send(fileBuffer);
      logger.info(`📤 Image sent to client: "${fileName}"`);
    } catch (error) {
      logger.error(`❌ Error in handleDirectImage for "${fileName}":`, error);
      throw error;
    }
  };

  private handleDirectUserProfileImage = async (fileName: string, req: Request, res: Response) => {
    try {
      logger.debug(`👤 handleDirectUserProfileImage called with fileName: "${fileName}"`);

      // Determinar el subdirectorio según el prefijo del archivo
      const isSignature = fileName.startsWith('signature-');
      const subDir = isSignature ? 'signatures' : 'profile-images';

      // Intentar primero el directorio remoto si existe
      let filePath = path.join(__dirname, '../static-remote', subDir, fileName);
      let isRemote = true;

      if (!fs.existsSync(filePath)) {
        // Si no existe en remoto, intentar local
        filePath = path.join(__dirname, '../static', subDir, fileName);
        isRemote = false;
        logger.debug(`🔄 Remote ${subDir} file not found, trying local: "${filePath}"`);
      } else {
        logger.debug(`🌐 Using remote ${subDir} file: "${filePath}"`);
      }

      logger.debug(`📍 ${isSignature ? 'Signature' : 'Profile image'} path: "${filePath}"`);

      // Validar que el archivo no intente path traversal
      if (filePath.includes('..') || (!filePath.includes('profile-images') && !filePath.includes('signatures') && !filePath.includes('static-remote'))) {
        logger.warn(`🚨 Path traversal attempt detected for user file: "${filePath}"`);
        return res.status(400).json(prepareResponse(400, 'Invalid file path'));
      }

      if (!fs.existsSync(filePath)) {
        logger.warn(`⚠️  User profile image not found: "${fileName}", serving placeholder instead`);
        // Servir imagen placeholder en lugar de devolver 404
        try {
          const placeholderPath = path.join(__dirname, '../static/images', 'placeholder.user.png');
          if (fs.existsSync(placeholderPath)) {
            const placeholderBuffer = fs.readFileSync(placeholderPath);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(placeholderBuffer);
          }
        } catch (placeholderError) {
          logger.error(`❌ Error loading placeholder: ${(placeholderError as Error).message}`);
        }
        // Si no hay placeholder, devolver 404
        return res.status(404).json(prepareResponse(404, 'User image not found'));
      }

      const fileBuffer = fs.readFileSync(filePath);

      // Detect correct MIME type based on file extension
      const fileExtension = fileName.toLowerCase().split('.').pop();
      let contentType = 'image/jpeg'; // default

      if (fileExtension === 'png') {
        contentType = 'image/png';
      } else if (fileExtension === 'gif') {
        contentType = 'image/gif';
      } else if (fileExtension === 'webp') {
        contentType = 'image/webp';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
      res.send(fileBuffer);

      logger.debug(`📤 Profile image sent to client: "${fileName}" from ${isRemote ? 'remote' : 'local'}`);
    } catch (error) {
      logger.error(`❌ Error in handleDirectUserProfileImage for "${fileName}":`, error);
      throw error;
    }
  };

  private handleDirectDownload = async (fileName: string, req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../static/supportMaterials', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json(prepareResponse(404, 'File not found'));
    }

    const fileStats = statSync(filePath);
    const fileSize = fileStats.size;

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'private, no-cache',
    });

    const fileStream = createReadStream(filePath);
    fileStream.on('error', (err) => {
      logger.error(`Error reading file: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).send('Error reading the file');
      }
    });
    fileStream.pipe(res);
  };

  private handleDirectPublicDownload = async (fileName: string, req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../static/filesPublic', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json(prepareResponse(404, 'File not found'));
    }

    const fileStats = statSync(filePath);
    const fileSize = fileStats.size;

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600', // 1 hora
    });

    const fileStream = createReadStream(filePath);
    fileStream.on('error', (err) => {
      logger.error(`Error reading file: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).send('Error reading the file');
      }
    });
    fileStream.pipe(res);
  };

  /**
   * 🔄 Proxy para peticiones POST/PATCH/PUT a través de /direct
   * Permite hacer peticiones a otras rutas de la API usando el query param 'path'
   * Usa streaming para soportar FormData/multipart correctamente
   */
  proxyDirectRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path: apiPath } = req.query;

      if (!apiPath || typeof apiPath !== 'string') {
        return res.status(400).json(prepareResponse(400, 'Path parameter is required'));
      }

      logger.info(`🔄 Proxy request - Method: ${req.method}, Path: ${apiPath}`);

      // Validar que el path no intente ataques de path traversal
      if (apiPath.includes('..')) {
        logger.warn(`🚨 Path traversal attempt detected in proxy: ${apiPath}`);
        return res.status(400).json(prepareResponse(400, 'Invalid path'));
      }

      // Obtener el token de autorización del header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        logger.warn('🚫 Missing authorization header in proxy request');
        return res.status(401).json(prepareResponse(401, 'Authorization required'));
      }

      // Construir la ruta interna
      const targetPath = `${config.BASE_URL}${apiPath}`;
      logger.info(`📍 Target path: ${targetPath}`);

      // Preparar headers para la petición interna
      const proxyHeaders: http.OutgoingHttpHeaders = {
        ...req.headers,
        host: `localhost:${config.PORT}`,
      };

      // Eliminar headers que podrían causar problemas
      delete proxyHeaders['content-length'];

      logger.info(`📤 Forwarding ${req.method} request with headers:`, {
        contentType: proxyHeaders['content-type'],
        authorization: proxyHeaders.authorization ? 'present' : 'missing',
      });

      // Hacer la petición interna usando http.request para streaming
      const proxyReq = http.request(
        {
          hostname: 'localhost',
          port: config.PORT,
          path: targetPath,
          method: req.method,
          headers: proxyHeaders,
        },
        (proxyRes) => {
          logger.info(`✅ Proxy response - Status: ${proxyRes.statusCode}`);

          // Copiar status code y headers de la respuesta
          res.status(proxyRes.statusCode || 200);

          // Copiar headers de respuesta
          Object.keys(proxyRes.headers).forEach((key) => {
            const value = proxyRes.headers[key];
            if (value !== undefined) {
              res.setHeader(key, value);
            }
          });

          // Hacer pipe de la respuesta directamente
          proxyRes.pipe(res);
        }
      );

      // Manejar errores de la petición proxy
      proxyReq.on('error', (error) => {
        logger.error(`❌ Proxy request error: ${error.message}`);
        if (!res.headersSent) {
          res.status(500).json(prepareResponse(500, 'Internal proxy error'));
        }
      });

      // Hacer pipe del body de la petición original al proxy
      req.pipe(proxyReq);
    } catch (error) {
      logger.error(`❌ Error in proxyDirectRequest: ${(error as Error).message}`, {
        stack: (error as Error).stack,
      });
      return next(error);
    }
  };
}
