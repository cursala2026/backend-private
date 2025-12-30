import axios from 'axios';
import config from '@/config';
import { logger } from '@/utils';
import FormData from 'form-data';
import { Transform } from 'stream';

class BunnyService {
  private readonly storageApiKey: string;
  private readonly storageZoneName: string;
  private readonly storageRegion: string;
  private readonly cdnHostname: string;
  private readonly baseUrl: string;

  constructor() {
    this.storageApiKey = config.BUNNY_STORAGE_API_KEY || '';
    this.storageZoneName = config.BUNNY_STORAGE_ZONE_NAME || '';
    this.storageRegion = config.BUNNY_STORAGE_REGION || 'br';
    this.cdnHostname = config.BUNNY_STORAGE_CDN_HOSTNAME || '';
    this.baseUrl = `https://storage.bunnycdn.com/${this.storageZoneName}`;

    logger.info('🐰 Bunny Storage Service initialized', {
      zone: this.storageZoneName,
      region: this.storageRegion,
      cdn: this.cdnHostname,
    });
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
      // Sanitizar el nombre del archivo
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
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
      // Sanitizar el nombre del archivo
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
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
      // Extraer el path del archivo de la URL del CDN
      const filePath = fileUrl.replace(this.cdnHostname, '');
      const deleteUrl = `${this.baseUrl}${filePath}`;

      logger.info(`🗑️ Deleting from Bunny: ${deleteUrl}`);

      const response = await axios.delete(deleteUrl, {
        headers: {
          'AccessKey': this.storageApiKey,
        },
      });

      if (response.status === 200) {
        logger.info(`✅ File deleted successfully from Bunny`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`❌ Error deleting from Bunny: ${(error as Error).message}`);
      return false;
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
}

export default BunnyService;
