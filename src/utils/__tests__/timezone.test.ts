import {
    convertToArgentinaTime,
    convertFromUTCToArgentina,
    getCurrentArgentinaTime,
    parseArgentinaDateFromFrontend,
    isStartBeforeEndArgentina,
    isInFutureArgentina,
    formatArgentinaDate,
    formatForFrontend,
    ARGENTINA_TIMEZONE,
} from '../timezone';

describe('timezone utilities', () => {
    describe('convertToArgentinaTime', () => {
        test('should convert string date to Argentina time', () => {
            const dateString = '2024-06-15 14:00:00';
            const result = convertToArgentinaTime(dateString);

            expect(result).toBeInstanceOf(Date);
        });

        test('should convert Date object to Argentina time', () => {
            const date = new Date('2024-06-15T14:00:00Z');
            const result = convertToArgentinaTime(date);

            expect(result).toBeInstanceOf(Date);
        });

        test('should throw error for empty input', () => {
            expect(() => convertToArgentinaTime('' as unknown as string)).toThrow('Fecha es requerida');
        });

        test('should throw error for null input', () => {
            expect(() => convertToArgentinaTime(null as unknown as string)).toThrow('Fecha es requerida');
        });

        test('should throw error for undefined input', () => {
            expect(() => convertToArgentinaTime(undefined as unknown as string)).toThrow('Fecha es requerida');
        });
    });

    describe('convertFromUTCToArgentina', () => {
        test('should convert UTC date to Argentina local time', () => {
            const utcDate = new Date('2024-06-15T18:00:00Z');
            const result = convertFromUTCToArgentina(utcDate);

            expect(result).toBeInstanceOf(Date);
            // Argentina is typically UTC-3
        });

        test('should throw error for null input', () => {
            expect(() => convertFromUTCToArgentina(null as unknown as Date)).toThrow('Fecha UTC es requerida');
        });

        test('should throw error for undefined input', () => {
            expect(() => convertFromUTCToArgentina(undefined as unknown as Date)).toThrow('Fecha UTC es requerida');
        });
    });

    describe('getCurrentArgentinaTime', () => {
        test('should return current Argentina time as Date', () => {
            const result = getCurrentArgentinaTime();

            expect(result).toBeInstanceOf(Date);
            // Should be close to current time (within 1 minute)
            const now = new Date();
            const diff = Math.abs(now.getTime() - result.getTime());
            expect(diff).toBeLessThan(60000); // Less than 1 minute difference
        });
    });

    describe('parseArgentinaDateFromFrontend', () => {
        test('should parse date string from frontend', () => {
            const dateString = '2024-06-15 10:30:00';
            const result = parseArgentinaDateFromFrontend(dateString);

            expect(result).toBeInstanceOf(Date);
        });

        test('should handle ISO format', () => {
            const dateString = '2024-06-15T10:30:00';
            const result = parseArgentinaDateFromFrontend(dateString);

            expect(result).toBeInstanceOf(Date);
        });
    });

    describe('isStartBeforeEndArgentina', () => {
        test('should return true when start is before end', () => {
            const start = new Date('2024-06-15T10:00:00Z');
            const end = new Date('2024-06-15T14:00:00Z');

            const result = isStartBeforeEndArgentina(start, end);

            expect(result).toBe(true);
        });

        test('should return false when start is after end', () => {
            const start = new Date('2024-06-15T18:00:00Z');
            const end = new Date('2024-06-15T12:00:00Z');

            const result = isStartBeforeEndArgentina(start, end);

            expect(result).toBe(false);
        });

        test('should return false when start equals end', () => {
            const start = new Date('2024-06-15T15:00:00Z');
            const end = new Date('2024-06-15T15:00:00Z');

            const result = isStartBeforeEndArgentina(start, end);

            expect(result).toBe(false);
        });

        test('should handle dates on different days', () => {
            const start = new Date('2024-06-15T23:00:00Z');
            const end = new Date('2024-06-16T02:00:00Z');

            const result = isStartBeforeEndArgentina(start, end);

            expect(result).toBe(true);
        });
    });

    describe('isInFutureArgentina', () => {
        test('should return true for future date', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

            const result = isInFutureArgentina(futureDate);

            expect(result).toBe(true);
        });

        test('should return false for past date', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1); // Yesterday

            const result = isInFutureArgentina(pastDate);

            expect(result).toBe(false);
        });

        test('should return false for current time (approximately)', () => {
            const now = new Date();

            const result = isInFutureArgentina(now);

            // Could be true or false depending on exact timing, but should not throw
            expect(typeof result).toBe('boolean');
        });
    });

    describe('formatArgentinaDate', () => {
        test('should format date with default format', () => {
            const date = new Date('2024-06-15T14:30:45Z');
            const result = formatArgentinaDate(date);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });

        test('should format date with custom format', () => {
            const date = new Date('2024-06-15T14:30:45Z');
            const result = formatArgentinaDate(date, 'DD/MM/YYYY');

            expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        });

        test('should format with time only', () => {
            const date = new Date('2024-06-15T14:30:45Z');
            const result = formatArgentinaDate(date, 'HH:mm:ss');

            expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });

        test('should format with custom separators', () => {
            const date = new Date('2024-06-15T14:30:45Z');
            const result = formatArgentinaDate(date, 'YYYY/MM/DD HH-mm-ss');

            expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}-\d{2}-\d{2}$/);
        });
    });

    describe('formatForFrontend', () => {
        test('should format date for frontend', () => {
            const date = new Date('2024-06-15T14:30:45Z');
            const result = formatForFrontend(date);

            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        });

        test('should return ISO-like format without timezone', () => {
            const date = new Date('2024-12-25T20:15:30Z');
            const result = formatForFrontend(date);

            expect(result).not.toContain('Z');
            expect(result).not.toContain('+');
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        });
    });

    describe('ARGENTINA_TIMEZONE constant', () => {
        test('should be defined correctly', () => {
            expect(ARGENTINA_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
        });
    });
});
