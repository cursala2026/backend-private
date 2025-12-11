import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs, { createWriteStream } from 'fs';
import { logger } from '../utils';
import {
    uploadDirImages,
    uploadDirVideos,
    uploadDirSupportMaterials,
    uploadDirChunks,
    assembledFilesMap,
    generateUniqueFileNameFromOriginal,
    uploadChunkMulter,
} from './upload.config';

// Re-exportar configuración de Multer para rutas
export { uploadFiles, uploadChunkMulter } from './upload.config';

/**
 * Servicio para manejar operaciones de upload de archivos
 * Incluye soporte para uploads por chunks para archivos grandes
 */
export class FileUploadService {
    /**
     * Procesa un chunk individual de un archivo grande
     */
    async processChunk(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        return new Promise((resolve) => {
            uploadChunkMulter.single('chunk')(req, res, async (err) => {
                if (err) {
                    logger.error(`❌ Error en uploadChunkMulter: ${err.message}`);
                    resolve(res.status(400).json({
                        message: err.message,
                        error: 'Error en multer uploadChunk',
                    }));
                    return;
                }

                if (!req.file) {
                    logger.error('❌ No se recibió archivo chunk');
                    resolve(res.status(400).json({
                        message: 'No se recibió archivo chunk',
                    }));
                    return;
                }

                const { uploadId, chunkIndex, totalChunks, fileName, fieldName } = req.body;

                if (!uploadId || chunkIndex === undefined || !totalChunks || !fileName || !fieldName) {
                    fs.unlinkSync(req.file.path);
                    logger.error('Faltan parámetros requeridos para procesar chunk');
                    resolve(res.status(400).json({
                        message: 'Faltan parámetros requeridos: uploadId, chunkIndex, totalChunks, fileName, fieldName',
                    }));
                    return;
                }

                const correctChunkName = `${uploadId}_chunk_${chunkIndex}`;
                const correctChunkPath = path.join(uploadDirChunks, correctChunkName);

                try {
                    fs.renameSync(req.file.path, correctChunkPath);
                } catch (renameError) {
                    logger.error(`Error renombrando archivo chunk: ${(renameError as Error).message}`);
                    try {
                        fs.unlinkSync(req.file.path);
                    } catch (cleanupError) {
                        logger.error(`Error limpiando archivo temporal: ${(cleanupError as Error).message}`);
                    }
                    resolve(res.status(500).json({
                        message: 'Error procesando chunk',
                        error: (renameError as Error).message,
                    }));
                    return;
                }

                if (!fs.existsSync(correctChunkPath)) {
                    resolve(res.status(500).json({
                        message: 'Error procesando chunk - archivo no creado correctamente',
                    }));
                    return;
                }

                const chunkStats = fs.statSync(correctChunkPath);
                logger.info(`Chunk procesado exitosamente (${chunkStats.size} bytes)`);

                resolve(res.json({
                    success: true,
                    message: `Chunk ${parseInt(chunkIndex, 10) + 1}/${totalChunks} procesado`,
                    uploadId,
                    chunkSize: chunkStats.size,
                    chunkPath: correctChunkPath,
                    chunkName: correctChunkName,
                }));
            });
        });
    }

    /**
     * Ensambla todos los chunks en un archivo final
     */
    async finalizeChunks(uploadId: string, fileName: string, fieldName: string): Promise<{
        success: boolean;
        fileName?: string;
        fileSize?: number;
        chunksProcessed?: number;
        chunksDeleted?: number;
        error?: string;
    }> {
        logger.info(`🔧 Finalizando upload: ${uploadId}`);

        if (!fs.existsSync(uploadDirChunks)) {
            return { success: false, error: 'Directorio de chunks no existe' };
        }

        const allFiles = fs.readdirSync(uploadDirChunks);
        const chunkFiles = allFiles
            .filter((file) => file.startsWith(`${uploadId}_chunk_`))
            .sort((a, b) => {
                const aIndex = parseInt(a.split('_chunk_')[1], 10);
                const bIndex = parseInt(b.split('_chunk_')[1], 10);
                return aIndex - bIndex;
            });

        if (chunkFiles.length === 0) {
            return { success: false, error: 'No se encontraron chunks para ensamblar' };
        }

        // Determinar directorio de destino
        let destinationDir: string;
        if (fieldName === 'imageFile' || fieldName.startsWith('imageFile')) {
            destinationDir = uploadDirImages;
        } else if (fieldName === 'videoFile' || fieldName.startsWith('videoFile')) {
            destinationDir = uploadDirVideos;
        } else if (fieldName.includes('supportMaterials')) {
            destinationDir = uploadDirSupportMaterials;
        } else {
            return { success: false, error: `Tipo de archivo no reconocido: ${fieldName}` };
        }

        const finalFileName = generateUniqueFileNameFromOriginal(fileName);
        const finalFilePath = path.join(destinationDir, finalFileName);
        const writeStream = createWriteStream(finalFilePath);
        let hasError = false;

        try {
            // Procesar cada chunk secuencialmente
            const processChunkFile = (index: number): Promise<void> =>
                new Promise((resolve, reject) => {
                    if (index >= chunkFiles.length) {
                        resolve();
                        return;
                    }

                    const chunkFile = chunkFiles[index];
                    const chunkPath = path.join(uploadDirChunks, chunkFile);

                    if (!fs.existsSync(chunkPath)) {
                        reject(new Error(`Chunk no encontrado: ${chunkPath}`));
                        return;
                    }

                    const readStream = fs.createReadStream(chunkPath);

                    readStream.on('data', (chunk) => {
                        if (!hasError) {
                            writeStream.write(chunk);
                        }
                    });

                    readStream.on('end', () => {
                        logger.info(`✅ Chunk ${index + 1}/${chunkFiles.length} procesado`);
                        processChunkFile(index + 1).then(resolve).catch(reject);
                    });

                    readStream.on('error', (error) => {
                        hasError = true;
                        reject(error);
                    });
                });

            await processChunkFile(0);
            writeStream.end();

            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            if (!fs.existsSync(finalFilePath)) {
                throw new Error('El archivo final no se creó correctamente');
            }

            const finalFileStats = fs.statSync(finalFilePath);
            assembledFilesMap.set(uploadId, finalFileName);

            // Limpiar chunks
            let deletedCount = 0;
            chunkFiles.forEach((chunkFile) => {
                try {
                    const chunkPath = path.join(uploadDirChunks, chunkFile);
                    fs.unlinkSync(chunkPath);
                    deletedCount += 1;
                } catch (unlinkError) {
                    logger.warn(`⚠️ No se pudo eliminar chunk ${chunkFile}: ${(unlinkError as Error).message}`);
                }
            });

            return {
                success: true,
                fileName: finalFileName,
                fileSize: finalFileStats.size,
                chunksProcessed: chunkFiles.length,
                chunksDeleted: deletedCount,
            };
        } catch (error) {
            hasError = true;
            logger.error(`❌ Error durante el ensamblaje: ${(error as Error).message}`);

            if (fs.existsSync(finalFilePath)) {
                try {
                    fs.unlinkSync(finalFilePath);
                } catch (unlinkError) {
                    logger.error(`❌ Error eliminando archivo parcial: ${(unlinkError as Error).message}`);
                }
            }
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Limpia chunks de un upload fallido o cancelado
     */
    cleanupChunks(uploadId: string): { success: boolean; deletedCount: number; deletedFiles: string[] } {
        logger.info(`🧹 Limpieza de chunks para uploadId: ${uploadId}`);

        if (!fs.existsSync(uploadDirChunks)) {
            return { success: true, deletedCount: 0, deletedFiles: [] };
        }

        const allFiles = fs.readdirSync(uploadDirChunks);
        const chunkFiles = allFiles.filter((file) => file.startsWith(`${uploadId}_chunk_`));

        let deletedCount = 0;
        chunkFiles.forEach((chunkFile) => {
            try {
                const chunkPath = path.join(uploadDirChunks, chunkFile);
                fs.unlinkSync(chunkPath);
                deletedCount += 1;
            } catch (error) {
                logger.error(`❌ Error eliminando chunk ${chunkFile}: ${(error as Error).message}`);
            }
        });

        return { success: true, deletedCount, deletedFiles: chunkFiles };
    }

    /**
     * Busca un archivo ensamblado por su uploadId
     */
    findAssembledFile(uploadId: string, directory: string): string | null {
        logger.info(`🔍 Buscando archivo para uploadId: ${uploadId}`);

        const mappedFileName = assembledFilesMap.get(uploadId);
        if (mappedFileName) {
            const filePath = path.join(directory, mappedFileName);
            if (fs.existsSync(filePath)) {
                return mappedFileName;
            }
            assembledFilesMap.delete(uploadId);
        }

        // Fallback: buscar por timestamp
        const files = fs.readdirSync(directory);
        const timestamp = uploadId.split('-')[0];
        const matchingFile = files.find((file) => file.includes(timestamp));

        if (matchingFile) {
            return matchingFile;
        }

        logger.error('❌ No se encontró archivo para uploadId');
        return null;
    }

    /**
     * Resuelve el nombre de archivo desde un upload normal o por chunks
     */
    resolveFileName(
        normalFile: Express.Multer.File | undefined,
        chunkUploadId: string | undefined,
        directory: string
    ): string | null {
        if (normalFile) {
            return normalFile.filename;
        }
        if (chunkUploadId) {
            return this.findAssembledFile(chunkUploadId, directory);
        }
        return null;
    }

    /**
     * Elimina un archivo del sistema de archivos
     */
    deleteFile(directory: string, fileName: string): boolean {
        try {
            const filePath = path.join(directory, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`🗑️ Archivo eliminado: ${fileName}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`❌ Error eliminando archivo ${fileName}: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Limpia el mapeo de archivos ensamblados después de usarlos
     */
    cleanupAssembledFilesMappings(uploadIds: string[]): void {
        uploadIds.forEach((uploadId) => {
            if (uploadId) {
                assembledFilesMap.delete(uploadId);
                logger.info(`🧹 Limpieza mapeo: ${uploadId}`);
            }
        });
    }

    /**
   * Resuelve los archivos de clase desde uploads normales o por chunks
   * @returns Objeto con imageUrl, videoUrl y supportMaterials resueltos
   */
    resolveClassFiles(
        files: { [fieldname: string]: Express.Multer.File[] } | undefined,
        imageFileId: string | undefined,
        videoFileId: string | undefined,
        supportMaterialIds: string | string[] | undefined
    ): {
        imageUrl: string | undefined;
        videoUrl: string | undefined;
        supportMaterials: string[];
        errors: string[];
        uploadIdsToClean: string[];
    } {
        const errors: string[] = [];
        const uploadIdsToClean: string[] = [];
        let imageUrl: string | undefined;
        let videoUrl: string | undefined;
        const supportMaterials: string[] = [];

        // Procesar imagen
        if (files?.imageFile) {
            imageUrl = files.imageFile[0].filename;
            logger.info(`🖼️ Imagen normal: ${imageUrl}`);
        } else if (imageFileId) {
            const chunkFile = this.findAssembledFile(imageFileId, uploadDirImages);
            if (chunkFile) {
                imageUrl = chunkFile;
                uploadIdsToClean.push(imageFileId);
                logger.info(`🖼️ Imagen por chunks: ${imageUrl}`);
            } else {
                errors.push('Archivo de imagen por chunks no encontrado');
            }
        }

        // Procesar video
        if (files?.videoFile) {
            videoUrl = files.videoFile[0].filename;
            logger.info(`🎥 Video normal: ${videoUrl}`);
        } else if (videoFileId) {
            const chunkFile = this.findAssembledFile(videoFileId, uploadDirVideos);
            if (chunkFile) {
                videoUrl = chunkFile;
                uploadIdsToClean.push(videoFileId);
                logger.info(`🎥 Video por chunks: ${videoUrl}`);
            } else {
                logger.warn('Video por chunks no encontrado, continuando sin video');
            }
        }

        // Procesar archivos de soporte normales
        if (files?.supportMaterials) {
            const normalFiles = files.supportMaterials.map((file) => file.filename);
            supportMaterials.push(...normalFiles);
            logger.info(`📁 Archivos soporte normales: ${normalFiles.length}`);
        }

        // Procesar archivos de soporte por chunks
        if (supportMaterialIds) {
            const chunkIds = Array.isArray(supportMaterialIds) ? supportMaterialIds : [supportMaterialIds];
            chunkIds.forEach((chunkId) => {
                const chunkFile = this.findAssembledFile(chunkId, uploadDirSupportMaterials);
                if (chunkFile) {
                    supportMaterials.push(chunkFile);
                    uploadIdsToClean.push(chunkId);
                    logger.info(`📁 Archivo soporte por chunks: ${chunkFile}`);
                } else {
                    logger.warn(`⚠️ Archivo soporte no encontrado: ${chunkId}`);
                }
            });
        }

        return { imageUrl, videoUrl, supportMaterials, errors, uploadIdsToClean };
    }

    /**
     * Resuelve archivos para actualización de clase (maneja archivos existentes)
     */
    resolveClassFilesForUpdate(
        files: { [fieldname: string]: Express.Multer.File[] } | undefined,
        imageFileId: string | undefined,
        videoFileId: string | undefined,
        supportMaterialIds: string | string[] | undefined,
        existingImageUrl: string | undefined,
        existingVideoUrl: string | undefined,
        existingSupportMaterials: string[] | undefined,
        deleteImage: boolean,
        deleteVideo: boolean,
        deleteSupportMaterials: string[] | undefined
    ): {
        imageUrl: string | undefined;
        videoUrl: string | undefined;
        supportMaterials: string[];
        filesToDelete: { directory: string; fileName: string }[];
        uploadIdsToClean: string[];
    } {
        const uploadIdsToClean: string[] = [];
        const filesToDelete: { directory: string; fileName: string }[] = [];
        let imageUrl = existingImageUrl;
        let videoUrl = existingVideoUrl;
        let supportMaterials = [...(existingSupportMaterials || [])];

        // Procesar nueva imagen
        if (files?.imageFile) {
            if (existingImageUrl) {
                filesToDelete.push({ directory: uploadDirImages, fileName: existingImageUrl });
            }
            imageUrl = files.imageFile[0].filename;
        } else if (imageFileId) {
            const chunkFile = this.findAssembledFile(imageFileId, uploadDirImages);
            if (chunkFile) {
                if (existingImageUrl) {
                    filesToDelete.push({ directory: uploadDirImages, fileName: existingImageUrl });
                }
                imageUrl = chunkFile;
                uploadIdsToClean.push(imageFileId);
            }
        } else if (deleteImage && existingImageUrl) {
            filesToDelete.push({ directory: uploadDirImages, fileName: existingImageUrl });
            imageUrl = undefined;
        }

        // Procesar nuevo video
        if (files?.videoFile) {
            if (existingVideoUrl) {
                filesToDelete.push({ directory: uploadDirVideos, fileName: existingVideoUrl });
            }
            videoUrl = files.videoFile[0].filename;
        } else if (videoFileId) {
            const chunkFile = this.findAssembledFile(videoFileId, uploadDirVideos);
            if (chunkFile) {
                if (existingVideoUrl) {
                    filesToDelete.push({ directory: uploadDirVideos, fileName: existingVideoUrl });
                }
                videoUrl = chunkFile;
                uploadIdsToClean.push(videoFileId);
            }
        } else if (deleteVideo && existingVideoUrl) {
            filesToDelete.push({ directory: uploadDirVideos, fileName: existingVideoUrl });
            videoUrl = undefined;
        }

        // Procesar eliminación de materiales de soporte
        if (deleteSupportMaterials && deleteSupportMaterials.length > 0) {
            deleteSupportMaterials.forEach((material) => {
                filesToDelete.push({ directory: uploadDirSupportMaterials, fileName: material });
                supportMaterials = supportMaterials.filter((m) => m !== material);
            });
        }

        // Agregar nuevos materiales de soporte
        if (files?.supportMaterials) {
            const normalFiles = files.supportMaterials.map((file) => file.filename);
            supportMaterials.push(...normalFiles);
        }

        if (supportMaterialIds) {
            const chunkIds = Array.isArray(supportMaterialIds) ? supportMaterialIds : [supportMaterialIds];
            chunkIds.forEach((chunkId) => {
                const chunkFile = this.findAssembledFile(chunkId, uploadDirSupportMaterials);
                if (chunkFile) {
                    supportMaterials.push(chunkFile);
                    uploadIdsToClean.push(chunkId);
                }
            });
        }

        return { imageUrl, videoUrl, supportMaterials, filesToDelete, uploadIdsToClean };
    }

    /**
     * Ejecuta eliminación de archivos pendientes
     */
    deleteFiles(filesToDelete: { directory: string; fileName: string }[]): void {
        filesToDelete.forEach(({ directory, fileName }) => {
            this.deleteFile(directory, fileName);
        });
    }

    /**
     * Obtiene un stream de video y sus estadísticas
     */
    getVideoStream(videoFileName: string, range?: string): {
        fileSize: number;
        start: number;
        end: number;
        chunkSize: number;
        stream: fs.ReadStream;
        headers: Record<string, string | number>;
        status: number;
    } | null {
        const videoPath = path.join(uploadDirVideos, videoFileName);

        if (!fs.existsSync(videoPath)) {
            return null;
        }

        const videoStats = fs.statSync(videoPath);
        const fileSize = videoStats.size;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                return {
                    fileSize,
                    start,
                    end,
                    chunkSize: 0,
                    stream: fs.createReadStream(videoPath), // Dummy stream
                    headers: {
                        'Content-Range': `bytes */${fileSize}`,
                    },
                    status: 416
                };
            }

            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(videoPath, { start, end });

            return {
                fileSize,
                start,
                end,
                chunkSize,
                stream,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': 'video/mp4',
                },
                status: 206
            };
        } else {
            const stream = fs.createReadStream(videoPath);
            return {
                fileSize,
                start: 0,
                end: fileSize - 1,
                chunkSize: fileSize,
                stream,
                headers: {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                },
                status: 200
            };
        }
    }
}

// Exportar instancia singleton
export const fileUploadService = new FileUploadService();
