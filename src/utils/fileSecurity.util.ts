import path from 'path';
import logger from './logger';

/**
 * Resultado de la sanitización de un nombre de archivo
 */
export interface FileSanitizationResult {
  isValid: boolean;
  fileName?: string;
  reason?: string;
}

/**
 * Opciones para la sanitización de archivos
 */
export interface FileSanitizationOptions {
  allowedExtensions?: string[];
  allowedDirectories?: string[];
  requestIP?: string;
  logAttempts?: boolean;
}

/**
 * Sanitiza el nombre del archivo para prevenir path traversal y otras vulnerabilidades
 * @param fileName Nombre del archivo a sanitizar
 * @param options Opciones de sanitización
 * @returns Resultado de la sanitización
 */
export function sanitizeFileName(
  fileName: string,
  options: FileSanitizationOptions = {}
): FileSanitizationResult {
  const { allowedExtensions, requestIP, logAttempts = true } = options;

  // Validar tipo de entrada
  if (!fileName || typeof fileName !== 'string') {
    return { isValid: false, reason: 'Missing or invalid file name type' };
  }

  // Patrones peligrosos comunes
  const dangerousPatterns: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\.\./, reason: 'Path traversal sequence (..)' },
    { pattern: /\.\\/, reason: 'Path traversal sequence (.\\)' },
    { pattern: /\//, reason: 'Forward slash in filename' },
    { pattern: /\\/, reason: 'Backslash in filename' },
    // eslint-disable-next-line no-control-regex
    { pattern: /\x00/, reason: 'Null byte' },
    { pattern: /\0/, reason: 'Null byte (\\0)' },
    // Removidos: espacios, paréntesis, comas, dos puntos (excepto para Windows drive letters)
    // Solo bloqueamos caracteres realmente peligrosos: <>"?*| y null bytes
    { pattern: /[<>"|?*|]/, reason: 'Invalid characters in filename (<>"|?*|)' },
  ];

  // Verificar patrones peligrosos
  // eslint-disable-next-line no-restricted-syntax
  for (const { pattern, reason } of dangerousPatterns) {
    if (pattern.test(fileName)) {
      if (logAttempts) {
        logger.warn('Path traversal attempt detected', {
          fileName,
          reason,
          ip: requestIP || 'unknown',
          timestamp: new Date().toISOString(),
          severity: 'HIGH',
          category: 'SECURITY',
        });
      }
      return { isValid: false, reason };
    }
  }

  // Validar extensión si se especifica
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = path.extname(fileName).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      if (logAttempts) {
        logger.warn('Invalid file extension detected', {
          fileName,
          extension,
          allowedExtensions,
          ip: requestIP || 'unknown',
          timestamp: new Date().toISOString(),
          severity: 'MEDIUM',
          category: 'SECURITY',
        });
      }
      return { isValid: false, reason: `Invalid file extension: ${extension || 'none'}` };
    }
  }

  // Extraer solo el nombre base del archivo (sin directorios)
  const baseName = path.basename(fileName);

  return { isValid: true, fileName: baseName };
}

/**
 * Verifica que una ruta esté dentro de los directorios permitidos
 * @param filePath Ruta del archivo a verificar
 * @param allowedDirectories Array de directorios permitidos
 * @param requestIP IP del cliente (para logging)
 * @returns true si la ruta está permitida, false en caso contrario
 */
export function isPathInAllowedDirectories(
  filePath: string,
  allowedDirectories: string[],
  requestIP?: string
): boolean {
  const resolvedPath = path.resolve(filePath);

  const isAllowed = allowedDirectories.some(allowedDir => {
    const resolvedAllowedDir = path.resolve(allowedDir);
    return resolvedPath.startsWith(resolvedAllowedDir + path.sep) || resolvedPath === resolvedAllowedDir;
  });

  if (!isAllowed) {
    logger.warn('Directory traversal attempt detected', {
      attemptedPath: filePath,
      resolvedPath,
      allowedDirectories,
      ip: requestIP || 'unknown',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      category: 'SECURITY',
    });
  }

  return isAllowed;
}

/**
 * Extensiones permitidas por tipo de archivo
 */
export const ALLOWED_EXTENSIONS = {
  IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  VIDEOS: ['.mp4', '.webm', '.ogg', '.avi', '.mov'],
  DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
  ARCHIVES: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  ALL_FILES: [] as string[], // Empty array = no extension filtering
};

/**
 * Valida y sanitiza un nombre de archivo para imágenes
 * @param fileName Nombre del archivo
 * @param requestIP IP del cliente
 * @returns Resultado de la sanitización
 */
export function sanitizeImageFileName(fileName: string, requestIP?: string): FileSanitizationResult {
  return sanitizeFileName(fileName, {
    allowedExtensions: ALLOWED_EXTENSIONS.IMAGES,
    requestIP,
    logAttempts: true,
  });
}

/**
 * Valida y sanitiza un nombre de archivo para videos
 * @param fileName Nombre del archivo
 * @param requestIP IP del cliente
 * @returns Resultado de la sanitización
 */
export function sanitizeVideoFileName(fileName: string, requestIP?: string): FileSanitizationResult {
  return sanitizeFileName(fileName, {
    allowedExtensions: ALLOWED_EXTENSIONS.VIDEOS,
    requestIP,
    logAttempts: true,
  });
}

/**
 * Valida y sanitiza un nombre de archivo para documentos
 * @param fileName Nombre del archivo
 * @param requestIP IP del cliente
 * @returns Resultado de la sanitización
 */
export function sanitizeDocumentFileName(fileName: string, requestIP?: string): FileSanitizationResult {
  return sanitizeFileName(fileName, {
    allowedExtensions: ALLOWED_EXTENSIONS.DOCUMENTS,
    requestIP,
    logAttempts: true,
  });
}

/**
 * Valida y sanitiza cualquier nombre de archivo (sin restricción de extensión)
 * @param fileName Nombre del archivo
 * @param requestIP IP del cliente
 * @returns Resultado de la sanitización
 */
export function sanitizeAnyFileName(fileName: string, requestIP?: string): FileSanitizationResult {
  return sanitizeFileName(fileName, {
    allowedExtensions: ALLOWED_EXTENSIONS.ALL_FILES,
    requestIP,
    logAttempts: true,
  });
}

/**
 * Obtiene la IP del cliente desde el request
 * @param req Request de Express
 * @returns IP del cliente
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClientIP(req: any): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
