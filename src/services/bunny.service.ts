import axios from 'axios';
import config from '@/config';
import { logger } from '@/utils';
import FormData from 'form-data';
import { Transform } from 'stream';
import path from 'path';

class BunnyService {
  private readonly storageApiKey: string;
  private readonly storageZoneName: string;
  private readonly storageRegion: string;
  private readonly cdnHostname: string;
  private readonly baseUrl: string;
  
  // Bunny Stream configuration
  private readonly streamApiKey: string;
  private readonly streamLibraryId: string;
  private readonly streamApiBaseUrl: string = 'https://video.bunnycdn.com';

  constructor() {
    this.storageApiKey = config.BUNNY_STORAGE_API_KEY || '';
    this.storageZoneName = config.BUNNY_STORAGE_ZONE_NAME || '';
    this.storageRegion = config.BUNNY_STORAGE_REGION || 'br';
    this.cdnHostname = config.BUNNY_STORAGE_CDN_HOSTNAME || '';
    this.baseUrl = `https://storage.bunnycdn.com/${this.storageZoneName}`;
    
    // Bunny Stream config
    this.streamApiKey = config.BUNNY_STREAM_API_KEY || '';
    this.streamLibraryId = config.BUNNY_STREAM_LIBRARY_ID || '';

    logger.info('🐰 Bunny Storage Service initialized', {
      zone: this.storageZoneName,
      region: this.storageRegion,
      cdn: this.cdnHostname,
    });
    
    if (this.streamApiKey && this.streamLibraryId) {
      logger.info('🎬 Bunny Stream Service initialized', {
        libraryId: this.streamLibraryId,
      });
    }
  }

  /**
   * Sube un archivo a Bunny Storage
   * @param buffer - Buffer del archivo
   * @param fileName - Nombre del archivo con extensión
   * @param folder - Carpeta dentro del storage zone (ej: 'profile-images')
   * @returns URL del CDN del archivo subido
   */
  async uploadFile(buffer: Buffer, fileName: string, folder: string = 'profile-images'): Promise<string> {
    try {
      // Sanitizar el nombre del archivo (permitir letras Unicode, números, . _ - y [])
      const safeFileName = this.sanitizeFileName(fileName);
      const filePath = `/${folder}/${safeFileName}`;
      const uploadUrl = `${this.baseUrl}${filePath}`;

      logger.info(`🚀 Uploading to Bunny: ${uploadUrl}`);

      const response = await axios.put(uploadUrl, buffer, {
        headers: {
          'AccessKey': this.storageApiKey,
          'Content-Type': 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      if (response.status === 201 || response.status === 200) {
        const cdnUrl = `${this.cdnHostname}${filePath}`;
        logger.info(`✅ File uploaded successfully to Bunny: ${cdnUrl}`);
        return cdnUrl;
      }

      throw new Error(`Bunny upload failed with status: ${response.status}`);
    } catch (error) {
      logger.error(`❌ Error uploading to Bunny: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Sube un archivo a Bunny Storage preservando el nombre original (sanitizado).
   * Si ya existe un archivo con ese nombre en el storage, intentará agregar un sufijo incrementado.
   */
  async uploadFilePreserveOriginal(buffer: Buffer, originalName: string, folder: string = 'profile-images'): Promise<string> {
    try {
      // Sanitizar y normalizar el nombre original (preservando letras acentuadas)
      const sanitized = this.sanitizeFileName(originalName);
      const filePath = `/${folder}/${sanitized}`;
      const uploadUrl = `${this.baseUrl}${filePath}`;

      logger.info(`🚀 Uploading to Bunny (preserve original name): ${uploadUrl}`);

      const response = await axios.put(uploadUrl, buffer, {
        headers: {
          'AccessKey': this.storageApiKey,
          'Content-Type': 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      if (response.status === 201 || response.status === 200) {
        const cdnUrl = `${this.cdnHostname}${filePath}`;
        logger.info(`✅ File uploaded successfully to Bunny: ${cdnUrl}`);
        return cdnUrl;
      }

      throw new Error(`Bunny upload failed with status: ${response.status}`);
    } catch (error) {
      logger.error(`❌ Error uploading preserving original name to Bunny: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Sube un archivo a Bunny Storage usando streaming (para archivos grandes)
   * @param stream - Stream del archivo
   * @param fileName - Nombre del archivo con extensión
   * @param folder - Carpeta dentro del storage zone (ej: 'class-videos')
   * @param fileSize - Tamaño del archivo en bytes (requerido para tracking de progreso)
   * @param onProgress - Callback opcional para trackear progreso (percent: number)
   * @returns URL del CDN del archivo subido
   */
  async uploadFileStream(
    stream: NodeJS.ReadableStream,
    fileName: string,
    folder: string = 'class-videos',
    fileSize?: number,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    try {
      // Sanitizar el nombre del archivo (permitir letras Unicode)
      const safeFileName = this.sanitizeFileName(fileName);
      const filePath = `/${folder}/${safeFileName}`;
      const uploadUrl = `${this.baseUrl}${filePath}`;

      const sizeInfo = fileSize ? ` (${(fileSize / (1024 * 1024)).toFixed(2)} MB)` : '';
      logger.info(`🚀 Uploading stream to Bunny: ${uploadUrl}${sizeInfo}`);

      // Configurar tracking de progreso usando onUploadProgress de axios
      // Esto trackea el progreso real de la subida HTTP, no solo los bytes leídos del archivo
      const config: any = {
        headers: {
          'AccessKey': this.storageApiKey,
          'Content-Type': 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      };

      if (fileSize && onProgress) {
        let lastReportedPercent = -1;
        const MIN_PERCENT_CHANGE = 1; // Reportar cada 1% de cambio mínimo
        
        config.onUploadProgress = (progressEvent: any) => {
          if (progressEvent.total && progressEvent.total > 0) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            
            // Solo reportar si el porcentaje cambió significativamente
            if (percent !== lastReportedPercent && 
                Math.abs(percent - lastReportedPercent) >= MIN_PERCENT_CHANGE) {
              lastReportedPercent = percent;
              onProgress(Math.min(percent, 99)); // No reportar 100% hasta que termine completamente
            }
          } else if (fileSize) {
            // Fallback: si axios no reporta total, usar fileSize
            const percent = Math.round((progressEvent.loaded / fileSize) * 100);
            if (percent !== lastReportedPercent && 
                Math.abs(percent - lastReportedPercent) >= MIN_PERCENT_CHANGE) {
              lastReportedPercent = percent;
              onProgress(Math.min(percent, 99));
            }
          }
        };
      }

      const response = await axios.put(uploadUrl, stream, config);

      if (response.status === 201 || response.status === 200) {
        // Reportar 100% cuando la subida termine completamente
        if (fileSize && onProgress) {
          onProgress(100);
        }
        const cdnUrl = `${this.cdnHostname}${filePath}`;
        logger.info(`✅ File stream uploaded successfully to Bunny: ${cdnUrl}`);
        return cdnUrl;
      }

      throw new Error(`Bunny upload failed with status: ${response.status}`);
    } catch (error) {
      logger.error(`❌ Error uploading stream to Bunny: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Elimina un archivo de Bunny Storage
   * @param fileUrl - URL del CDN del archivo a eliminar
   * @returns true si se eliminó correctamente
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // Extraer el path del archivo de la URL del CDN de forma robusta
      let filePath = '';
      try {
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          const urlObj = new URL(fileUrl);
          filePath = urlObj.pathname; // /support-materials/xxx.pdf
        } else if (fileUrl.includes(this.cdnHostname)) {
          filePath = fileUrl.replace(this.cdnHostname, '');
        } else if (fileUrl.startsWith('/')) {
          filePath = fileUrl;
        } else {
          // Si viene solo el nombre de archivo, asumir carpeta raíz
          filePath = `/${fileUrl}`;
        }
      } catch (e) {
        // Fallback simple
        filePath = fileUrl.replace(this.cdnHostname, '');
      }

      // Normalizar path para evitar dobles // o secuencias raras
      // Usar replace para asegurar formato posix
      filePath = filePath.replace(/\\/g, '/');
      if (!filePath.startsWith('/')) filePath = `/${filePath}`;

      const deleteUrl = `${this.baseUrl}${filePath}`;

      logger.info(`🗑️ Deleting from Bunny: ${deleteUrl}`);

      const response = await axios.delete(deleteUrl, {
        headers: {
          'AccessKey': this.storageApiKey,
        },
      });

      // Considerar 200/204 como éxito; si es 404 (no existe) tratarlo como éxito también
      if (response.status === 200 || response.status === 204) {
        logger.info(`✅ File deleted successfully from Bunny`);
        return true;
      }

      // Si llega aquí, devolver false
      return false;
    } catch (error) {
      // Si es 404, interpretar como ya eliminado (éxito)
      if ((error as any).response?.status === 404) {
        logger.info(`ℹ️ File not found on Bunny (treated as deleted): ${fileUrl}`);
        return true;
      }
      logger.error(`❌ Error deleting from Bunny: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Sanitiza un nombre de archivo permitiendo letras Unicode (acentos), números y algunos signos.
   * También intenta corregir mojibake común donde un UTF-8 fue interpretado como Latin1.
   */
  private sanitizeFileName(name: string): string {
    if (!name) return name;
    try {
      // Normalizar unicode
      let s = name.normalize('NFC');

      // Detectar mojibake típico (presencia de caracteres como 'Ã') y re-decode desde latin1
      if (/Ã[\x80-\xBF]/.test(s)) {
        try {
          const decoded = Buffer.from(s, 'latin1').toString('utf8');
          // Si la decodificación produce caracteres no ASCII, adoptarla
          if (/[\u00C0-\u017F]/.test(decoded)) {
            s = decoded;
          }
        } catch (e) {
          // ignore
        }
      }

      // Reemplazar caracteres inválidos por '_' pero permitir letras Unicode y números
      // Usamos Unicode property escapes para 
      // \p{L} = letras, \p{N} = números
      s = s.replace(/[^\p{L}\p{N}._\-\[\]]+/gu, '_');

      // Colapsar múltiples guiones bajos y recortar
      s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      if (!s) return 'file';
      return s;
    } catch (e) {
      return name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    }
  }

  /**
   * Normaliza un nombre original para mostrar: corrige mojibake y mantiene
   * espacios y acentos; elimina caracteres peligrosos usados en paths.
   */
  normalizeOriginalName(name: string): string {
    if (!name) return name;
    try {
      let s = name.normalize('NFC');

      // Detectar mojibake típico y re-decode desde latin1 si aplica
      if (/Ã[\x80-\xBF]/.test(s)) {
        try {
          const decoded = Buffer.from(s, 'latin1').toString('utf8');
          if (/[\u00C0-\u017F]/.test(decoded)) {
            s = decoded;
          }
        } catch (e) {
          // ignore
        }
      }

      // Eliminar caracteres de control y separadores de path
      s = s.replace(/[\\/:*?"<>|\x00-\x1F]+/g, '');

      // Trim y devolver
      s = s.trim();
      if (!s) return 'file';
      return s;
    } catch (e) {
      return name;
    }
  }

  /**
   * Descarga un archivo desde Bunny CDN
   * @param fileUrl - URL del CDN del archivo
   * @returns Buffer del archivo
   */
  async downloadFile(fileUrl: string): Promise<Buffer | null> {
    try {
      logger.info(`📥 Downloading from Bunny CDN: ${fileUrl}`);

      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      if (response.status === 200 && response.data) {
        const buffer = Buffer.from(response.data);
        logger.info(`✅ File downloaded from Bunny CDN: ${buffer.length} bytes`);
        return buffer;
      }

      return null;
    } catch (error) {
      logger.error(`❌ Error downloading from Bunny CDN: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Verifica si una URL es de Bunny CDN
   * @param url - URL o nombre de archivo a verificar
   * @returns true si es una URL de Bunny CDN
   */
  isBunnyCdnUrl(url: string): boolean {
    return url.includes('bunnycdn') || url.includes('b-cdn.net') || url.startsWith('http');
  }

  /**
   * Genera un nombre único para el archivo
   * @param originalName - Nombre original del archivo
   * @param prefix - Prefijo para el nombre (ej: 'profile', 'signature', 'course')
   * @returns Nombre único del archivo
   */
  generateUniqueFileName(originalName: string, prefix: string = 'file'): string {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const extension = originalName.split('.').pop();
    return `${prefix}-${timestamp}-${random}.${extension}`;
  }

  /**
   * Verifica si una URL es de Bunny Stream
   * @param url - URL a verificar
   * @returns true si es una URL de Bunny Stream
   */
  isStreamUrl(url: string): boolean {
    // Las URLs de Stream tienen formato: https://vz-{libraryId}.b-cdn.net/{videoId}
    return url.includes(`vz-${this.streamLibraryId}.b-cdn.net`) || url.includes('iframe.mediadelivery.net');
  }

  /**
   * Extrae el videoId de una URL de Bunny Stream
   * @param videoUrl - URL del video en Stream
   * @returns El videoId extraído o null si no es válido
   */
  private extractVideoIdFromStreamUrl(videoUrl: string): string | null {
    try {
      // Las URLs pueden tener varios formatos:
      // https://vz-{libraryId}.b-cdn.net/{videoId}/playlist.m3u8
      // https://vz-{libraryId}.b-cdn.net/{videoId}
      // https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}

      if (videoUrl.includes('iframe.mediadelivery.net')) {
        const parts = videoUrl.split('/');
        return parts[parts.length - 1];
      }

      // Para URLs de CDN, el videoId es el primer segmento del path
      const urlObj = new URL(videoUrl);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      return pathParts[0] || null;
    } catch (error) {
      logger.error(`Error extrayendo videoId de URL: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Elimina un video de Bunny Stream
   * @param videoUrl - URL del video en Stream (formato: https://vz-{libraryId}.b-cdn.net/{videoId})
   * @returns true si se eliminó correctamente
   */
  async deleteVideoFromStream(videoUrl: string): Promise<boolean> {
    try {
      if (!this.streamApiKey || !this.streamLibraryId) {
        logger.warn('Bunny Stream API Key o Library ID no están configurados');
        return false;
      }

      const videoId = this.extractVideoIdFromStreamUrl(videoUrl);
      if (!videoId) {
        logger.error(`No se pudo extraer videoId de la URL: ${videoUrl}`);
        return false;
      }

      const deleteUrl = `${this.streamApiBaseUrl}/library/${this.streamLibraryId}/videos/${videoId}`;

      logger.info(`🗑️ Eliminando video de Bunny Stream: ${videoId}`);

      const response = await axios.delete(deleteUrl, {
        headers: {
          'AccessKey': this.streamApiKey,
        },
      });

      if (response.status === 200 || response.status === 204) {
        logger.info(`✅ Video eliminado exitosamente de Bunny Stream: ${videoId}`);
        return true;
      }

      logger.warn(`Respuesta inesperada al eliminar video de Stream: ${response.status}`);
      return false;
    } catch (error) {
      // Si el error es 404, el video ya no existe (puede haber sido eliminado previamente)
      if ((error as any).response?.status === 404) {
        logger.info(`ℹ️ Video no encontrado en Bunny Stream (posiblemente ya eliminado): ${videoUrl}`);
        return true;
      }
      logger.error(`❌ Error eliminando video de Bunny Stream: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Sube un video a Bunny Stream
   * @param stream - Stream del archivo de video
   * @param fileName - Nombre del archivo con extensión
   * @param fileSize - Tamaño del archivo en bytes (requerido para tracking de progreso)
   * @param onProgress - Callback opcional para trackear progreso (percent: number)
   * @param title - Título del video (opcional, por defecto usa el fileName)
   * @returns URL del video en Stream
   */
  async uploadVideoToStream(
    stream: NodeJS.ReadableStream,
    fileName: string,
    fileSize: number,
    onProgress?: (percent: number) => void,
    title?: string
  ): Promise<string> {
    try {
      if (!this.streamApiKey || !this.streamLibraryId) {
        throw new Error('Bunny Stream API Key o Library ID no están configurados');
      }

      const videoTitle = title || fileName.replace(/\.[^/.]+$/, ''); // Remover extensión
      const sizeInfo = fileSize ? ` (${(fileSize / (1024 * 1024)).toFixed(2)} MB)` : '';
      logger.info(`🎬 Creando video en Bunny Stream: ${videoTitle}${sizeInfo}`);

      // Paso 1: Crear el video en la biblioteca
      const createVideoUrl = `${this.streamApiBaseUrl}/library/${this.streamLibraryId}/videos`;
      const createResponse = await axios.post(
        createVideoUrl,
        { title: videoTitle },
        {
          headers: {
            'AccessKey': this.streamApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (createResponse.status !== 200 || !createResponse.data?.guid) {
        logger.error(`Error creando video: ${JSON.stringify(createResponse.data)}`);
        throw new Error(`Error creando video en Stream: ${createResponse.status}`);
      }

      const videoId = createResponse.data.guid;
      const videoLibraryId = createResponse.data.videoLibraryId || this.streamLibraryId;
      
      // Log de la respuesta completa para debugging
      logger.info(`📋 Respuesta de creación: ${JSON.stringify(createResponse.data)}`);
      logger.info(`📋 Video ID: ${videoId}, Library ID: ${videoLibraryId}`);
      
      // Según la documentación de Bunny Stream, usar el endpoint de la API para upload
      // PUT https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
      const uploadUrl = `${this.streamApiBaseUrl}/library/${this.streamLibraryId}/videos/${videoId}`;

      logger.info(`🚀 Subiendo video a Stream: ${uploadUrl}`);

      // Paso 2: Subir el archivo del video
      // Bunny Stream requiere AccessKey en el header para uploads directos
      const uploadConfig: any = {
        headers: {
          'AccessKey': this.streamApiKey,
          'Content-Type': 'application/octet-stream',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      };

      // Configurar tracking de progreso
      if (fileSize && onProgress) {
        let lastReportedPercent = -1;
        const MIN_PERCENT_CHANGE = 1;
        
        uploadConfig.onUploadProgress = (progressEvent: any) => {
          if (progressEvent.total && progressEvent.total > 0) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            
            if (percent !== lastReportedPercent && 
                Math.abs(percent - lastReportedPercent) >= MIN_PERCENT_CHANGE) {
              lastReportedPercent = percent;
              onProgress(Math.min(percent, 99));
            }
          } else if (fileSize) {
            const percent = Math.round((progressEvent.loaded / fileSize) * 100);
            if (percent !== lastReportedPercent && 
                Math.abs(percent - lastReportedPercent) >= MIN_PERCENT_CHANGE) {
              lastReportedPercent = percent;
              onProgress(Math.min(percent, 99));
            }
          }
        };
      }

      // Subir el archivo del video usando el endpoint de la API
      const uploadResponse = await axios.put(uploadUrl, stream, uploadConfig);

      if (uploadResponse.status !== 200 && uploadResponse.status !== 201 && uploadResponse.status !== 204) {
        logger.error(`Error en upload response: ${uploadResponse.status} - ${JSON.stringify(uploadResponse.data || {})}`);
        throw new Error(`Error subiendo archivo a Stream: ${uploadResponse.status}`);
      }
      
      logger.info(`✅ Archivo subido correctamente, status: ${uploadResponse.status}`);

      // Paso 3: Obtener la URL final del video
      const videoDetailsUrl = `${this.streamApiBaseUrl}/library/${this.streamLibraryId}/videos/${videoId}`;
      const detailsResponse = await axios.get(videoDetailsUrl, {
        headers: {
          'AccessKey': this.streamApiKey,
        },
      });

      if (detailsResponse.status !== 200) {
        throw new Error(`Error obteniendo detalles del video: ${detailsResponse.status}`);
      }

      // Reportar 100% cuando la subida termine completamente
      if (fileSize && onProgress) {
        onProgress(100);
      }

      // Para Bunny Stream, guardamos la URL de CDN que incluye el videoId
      // Esto permite extraer el videoId y libraryId para el reproductor embebido
      // Formato: https://vz-{libraryId}.b-cdn.net/{videoId}
      const videoUrl = `https://vz-${this.streamLibraryId}.b-cdn.net/${videoId}`;

      logger.info(`✅ Video subido exitosamente a Stream: ${videoUrl}`);
      logger.info(`📹 Video ID para embed: ${videoId}, Library ID: ${this.streamLibraryId}`);
      return videoUrl;
    } catch (error) {
      logger.error(`❌ Error subiendo video a Stream: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default BunnyService;
