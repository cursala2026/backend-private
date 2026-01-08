import BunnyService from './bunny.service';
import { Readable } from 'stream';

class QuestionMediaService {
  private readonly bunnyService: BunnyService;

  constructor() {
    this.bunnyService = BunnyService.getInstance();
  }

  /**
   * Sube una imagen para una pregunta a Bunny Storage (carpeta question-images)
   */
  async uploadImage(buffer: Buffer, originalName: string): Promise<string> {
    const cdnUrl = await this.bunnyService.uploadFilePreserveOriginal(buffer, originalName, 'question-images');
    return cdnUrl;
  }

  /**
   * Sube un video para una pregunta a Bunny Storage (carpeta question-videos)
   * Para archivos grandes se recomienda usar `uploadVideoStream`.
   */
  async uploadVideo(buffer: Buffer, originalName: string): Promise<string> {
    const cdnUrl = await this.bunnyService.uploadFilePreserveOriginal(buffer, originalName, 'question-videos');
    return cdnUrl;
  }

  /**
   * Sube un video usando stream (mejor para archivos grandes)
   */
  async uploadVideoStream(stream: Readable, originalName: string, fileSize?: number, onProgress?: (p: number) => void): Promise<string> {
    // For stream uploads we keep behavior of uploadFileStream (sanitizes name)
    const fileName = this.bunnyService.generateUniqueFileName(originalName, 'question-video');
    const cdnUrl = await this.bunnyService.uploadFileStream(stream, fileName, 'question-videos', fileSize, onProgress);
    return cdnUrl;
  }

  /**
   * Elimina un media (imagen o video) guardado en Bunny Storage
   */
  async deleteMedia(cdnUrl: string): Promise<boolean> {
    return await this.bunnyService.deleteFile(cdnUrl);
  }
}

export default QuestionMediaService;
