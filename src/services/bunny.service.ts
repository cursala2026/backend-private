import axios from 'axios';
import config from '@/config';
import { logger } from '@/utils';
import FormData from 'form-data';

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
