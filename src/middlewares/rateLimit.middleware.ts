import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Analiza un entero desde una variable de entorno y devuelve un valor por defecto si no es válido.
 *
 * @param {string|undefined} value - Valor de la variable de entorno.
 * @param {number} fallback - Valor por defecto a usar si `value` no es un entero positivo.
 * @returns {number} Entero parseado o `fallback`.
 */
export function parseEnvInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return n;
}

/**
 * Obtiene la IP del cliente de forma segura.
 *
 * Se prioriza `req.ip` (respeta `trust proxy`). Si no está disponible,
 * se toma el primer valor de `x-forwarded-for`. Como último recurso
 * se usa `req.socket.remoteAddress`.
 *
 * @param {Request} req - Objeto `Request` de Express.
 * @returns {string} IP del cliente (cadena vacía si no se encuentra).
 */
export function getClientIp(req: Request): string {
  if (req.ip) return req.ip;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  const remote = (req.socket && (req.socket.remoteAddress as string)) || '';
  return remote || '';
}

/**
 * Ventana global en milisegundos usada por `globalLimiter`.
 * @constant {number}
 */
const GLOBAL_WINDOW_MS = parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000); // 15 minutos

/**
 * Middleware global de limitación de peticiones.
 *
 * Limita el número de solicitudes por IP usando `express-rate-limit`.
 * Variables de entorno relevantes:
 *  - `RATE_LIMIT_WINDOW_MS` (milisegundos)
 *  - `RATE_LIMIT_MAX`
 *
 * @example
 * app.use(globalLimiter)
 */
export const globalLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  max: parseEnvInt(process.env.RATE_LIMIT_MAX, 1000),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.set('Retry-After', String(Math.ceil(GLOBAL_WINDOW_MS / 1000)));
    res.status(429).json({ message: 'Demasiadas solicitudes, por favor inténtalo más tarde.' });
  },
});

/**
 * Ventana para endpoints de autenticación (ms).
 * @constant {number}
 */
const AUTH_WINDOW_MS = parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS_AUTH, 15 * 60 * 1000);

/**
 * Middleware de limitación para endpoints de autenticación.
 *
 * Limita intentos de login y restablecimiento de contraseña por IP.
 * Usa `getClientIp` como `keyGenerator`.
 * Variables de entorno relevantes:
 *  - `RATE_LIMIT_WINDOW_MS_AUTH` (ms)
 *  - `RATE_LIMIT_MAX_AUTH`
 */
export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: parseEnvInt(process.env.RATE_LIMIT_MAX_AUTH, 20),
  keyGenerator: (req: Request) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.set('Retry-After', String(Math.ceil(AUTH_WINDOW_MS / 1000)));
    res.status(429).json({ message: 'Demasiados intentos de autenticación. Por favor inténtalo más tarde.' });
  },
});

/**
 * Ventana para acceso a archivos públicos (ms).
 * @constant {number}
 */
const PUBLIC_FILES_WINDOW_MS = parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS_PUBLIC_FILES, 1 * 60 * 1000);

/**
 * Middleware de limitación para acceso a archivos públicos.
 *
 * Limita el número de peticiones de archivos públicos por IP.
 * Variables de entorno relevantes:
 *  - `RATE_LIMIT_WINDOW_MS_PUBLIC_FILES` (ms)
 *  - `RATE_LIMIT_MAX_PUBLIC_FILES`
 */
export const publicFileLimiter = rateLimit({
  windowMs: PUBLIC_FILES_WINDOW_MS,
  max: parseEnvInt(process.env.RATE_LIMIT_MAX_PUBLIC_FILES, 30),
  keyGenerator: (req: Request) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.set('Retry-After', String(Math.ceil(PUBLIC_FILES_WINDOW_MS / 1000)));
    res.status(429).json({ message: 'Demasiadas solicitudes para archivos. Por favor inténtalo más tarde.' });
  },
});

