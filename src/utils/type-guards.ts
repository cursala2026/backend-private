/**
 * Utility: Type Guards para Express 5
 * Propósito: Normalizar req.params y req.query que ahora pueden ser string | string[] | undefined
 */

/**
 * Garantiza que el valor sea un string único.
 * Si recibe un array (ej. ?id=1&id=2), toma el primero.
 * Si es undefined, devuelve un string vacío (o podrías lanzar un error).
 */
export const ensureString = (value: any): string => {
  if (Array.isArray(value)) return String(value[0]);
  return value ? String(value) : '';
};

/**
 * Garantiza que el valor sea un número válido.
 * Útil para IDs numéricos o parámetros de paginación.
 */
export const ensureNumber = (value: any): number => {
  const parsed = parseInt(ensureString(value), 10);
  return isNaN(parsed) ? 0 : parsed;
};
