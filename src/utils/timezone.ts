import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Convierte una fecha string o Date a timezone argentino y retorna un objeto Date UTC
 * que representa el momento correcto en Argentina.
 *
 * @param dateInput - Fecha como string o Date object
 * @returns Date object en UTC que representa la fecha/hora en Argentina
 */
export const convertToArgentinaTime = (dateInput: string | Date): Date => {
  if (!dateInput) {
    throw new Error('Fecha es requerida');
  }

  if (typeof dateInput === 'string') {
    const argentinaDate = dayjs.tz(dateInput, ARGENTINA_TIMEZONE);
    return argentinaDate.utc().toDate();
  }

  const argentinaDate = dayjs(dateInput).tz(ARGENTINA_TIMEZONE);
  return argentinaDate.utc().toDate();
};

/**
 * Convierte una fecha UTC de la base de datos a hora argentina local.
 *
 * @param utcDate - Fecha UTC de la base de datos
 * @returns Date object representando la hora local argentina
 */
export const convertFromUTCToArgentina = (utcDate: Date): Date => {
  if (!utcDate) {
    throw new Error('Fecha UTC es requerida');
  }

  const argentinaDate = dayjs.utc(utcDate).tz(ARGENTINA_TIMEZONE);
  return argentinaDate.toDate();
};

/**
 * Obtiene la fecha/hora actual en Argentina.
 *
 * @returns Date object con la hora actual de Argentina en formato UTC
 */
export const getCurrentArgentinaTime = (): Date => {
  const now = dayjs().tz(ARGENTINA_TIMEZONE);
  return now.utc().toDate();
};

/**
 * Parsea una fecha string del frontend a Date UTC
 */
export const parseArgentinaDateFromFrontend = (dateString: string): Date => convertToArgentinaTime(dateString);

/**
 * Verifica si la fecha de inicio es anterior a la fecha de fin en zona horaria argentina
 */
export const isStartBeforeEndArgentina = (startDate: Date, endDate: Date): boolean => {
  const start = dayjs(startDate).tz(ARGENTINA_TIMEZONE);
  const end = dayjs(endDate).tz(ARGENTINA_TIMEZONE);
  return start.isBefore(end);
};

/**
 * Verifica si una fecha está en el futuro en zona horaria argentina
 */
export const isInFutureArgentina = (date: Date): boolean => {
  const now = dayjs().tz(ARGENTINA_TIMEZONE);
  const checkDate = dayjs(date).tz(ARGENTINA_TIMEZONE);
  return checkDate.isAfter(now);
};

/**
 * Formatea una fecha para mostrar en Argentina
 */
export const formatArgentinaDate = (date: Date, format?: string): string => {
  const dateFormat = format || 'YYYY-MM-DD HH:mm:ss';
  return dayjs(date).tz(ARGENTINA_TIMEZONE).format(dateFormat);
};

/**
 * Formatea una fecha para el frontend
 */
export const formatForFrontend = (date: Date): string => dayjs(date).tz(ARGENTINA_TIMEZONE).format('YYYY-MM-DDTHH:mm:ss');
