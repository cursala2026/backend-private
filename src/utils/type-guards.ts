/**
 * Utility: Type Guards para Express 5
 * Propósito: Normalizar req.params y req.query que ahora pueden ser string | string[] | undefined
 */

/**
 * Garantiza que el valor sea un string único.
 * Si recibe un array (ej. ?id=1&id=2), toma el primero.
 * Si es undefined, devuelve un string vacío (o podrías lanzar un error).
 */
import { ParsedQs } from 'qs';
type QueryValue = string | string[] | ParsedQs | ParsedQs[] | (string | ParsedQs)[] | undefined;
export function ensureString(value: QueryValue): string {
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
    return '';
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return '';
  return '';
}

/**
 * Garantiza que el valor sea un número válido.
 * Útil para IDs numéricos o parámetros de paginación.
 */
export const ensureNumber = (value: any): number => {
  const parsed = parseInt(ensureString(value), 10);
  return isNaN(parsed) ? 0 : parsed;
};
