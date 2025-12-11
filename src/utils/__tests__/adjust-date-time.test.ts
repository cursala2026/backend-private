import adjustDateTime from '../adjust-date-time';

describe('adjustDateTime', () => {
    test('should adjust date to specified time in UTC', () => {
        const date = new Date('2024-01-15T10:30:45.123Z');
        const result = adjustDateTime(date, 14, 30, 0, 0);

        expect(result.getUTCHours()).toBe(14);
        expect(result.getUTCMinutes()).toBe(30);
        expect(result.getUTCSeconds()).toBe(0);
        expect(result.getUTCMilliseconds()).toBe(0);
    });

    test('should preserve the date but change the time', () => {
        const date = new Date('2024-05-20T08:15:30.500Z');
        const result = adjustDateTime(date, 23, 59, 59, 999);

        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(4); // May is month 4 (0-indexed)
        expect(result.getUTCDate()).toBe(20);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(59);
        expect(result.getUTCSeconds()).toBe(59);
        expect(result.getUTCMilliseconds()).toBe(999);
    });

    test('should handle midnight time', () => {
        const date = new Date('2024-12-31T12:00:00.000Z');
        const result = adjustDateTime(date, 0, 0, 0, 0);

        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
        expect(result.getUTCMilliseconds()).toBe(0);
    });

    test('should handle different timezones correctly', () => {
        // Testing that UTC conversion is consistent
        const date1 = new Date('2024-06-15T10:00:00.000-03:00'); // Buenos Aires time
        const date2 = new Date('2024-06-15T13:00:00.000Z'); // Same moment in UTC

        const result1 = adjustDateTime(date1, 18, 0, 0, 0);
        const result2 = adjustDateTime(date2, 18, 0, 0, 0);

        // Both should result in the same UTC hour
        expect(result1.getUTCHours()).toBe(18);
        expect(result2.getUTCHours()).toBe(18);
    });

    test('should handle leap year dates', () => {
        const date = new Date('2024-02-29T12:00:00.000Z'); // Leap year
        const result = adjustDateTime(date, 6, 30, 15, 500);

        expect(result.getUTCFullYear()).toBe(2024);
        expect(result.getUTCMonth()).toBe(1); // February
        expect(result.getUTCDate()).toBe(29);
        expect(result.getUTCHours()).toBe(6);
        expect(result.getUTCMinutes()).toBe(30);
    });
});
