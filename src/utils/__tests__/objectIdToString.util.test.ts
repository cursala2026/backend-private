import { objectIdToString, stringToObjectId } from '../objectIdToString.util';
import { Types } from 'mongoose';

describe('objectIdToString utility', () => {
    describe('objectIdToString', () => {
        test('should convert array of ObjectIds to strings', () => {
            const objectIds = [
                new Types.ObjectId('507f1f77bcf86cd799439011'),
                new Types.ObjectId('507f1f77bcf86cd799439012'),
                new Types.ObjectId('507f1f77bcf86cd799439013'),
            ];

            const result = objectIdToString(objectIds);

            expect(result).toEqual([
                '507f1f77bcf86cd799439011',
                '507f1f77bcf86cd799439012',
                '507f1f77bcf86cd799439013',
            ]);
        });

        test('should return empty array for empty input', () => {
            const result = objectIdToString([]);

            expect(result).toEqual([]);
        });

        test('should handle single ObjectId', () => {
            const objectIds = [new Types.ObjectId('507f1f77bcf86cd799439011')];

            const result = objectIdToString(objectIds);

            expect(result).toEqual(['507f1f77bcf86cd799439011']);
            expect(result.length).toBe(1);
            expect(typeof result[0]).toBe('string');
        });

        test('should preserve order of ObjectIds', () => {
            const objectIds = [
                new Types.ObjectId('507f1f77bcf86cd799439011'),
                new Types.ObjectId('507f1f77bcf86cd799439012'),
                new Types.ObjectId('507f1f77bcf86cd799439013'),
            ];

            const result = objectIdToString(objectIds);

            expect(result[0]).toBe('507f1f77bcf86cd799439011');
            expect(result[1]).toBe('507f1f77bcf86cd799439012');
            expect(result[2]).toBe('507f1f77bcf86cd799439013');
        });

        test('should handle large arrays', () => {
            const objectIds = Array.from({ length: 100 }, () => new Types.ObjectId());

            const result = objectIdToString(objectIds);

            expect(result.length).toBe(100);
            result.forEach((str) => {
                expect(typeof str).toBe('string');
                expect(str.length).toBe(24); // MongoDB ObjectId length
            });
        });
    });

    describe('stringToObjectId', () => {
        test('should convert array of strings to ObjectIds', () => {
            const strings = [
                '507f1f77bcf86cd799439011',
                '507f1f77bcf86cd799439012',
                '507f1f77bcf86cd799439013',
            ];

            const result = stringToObjectId(strings);

            expect(result.length).toBe(3);
            expect(result[0]).toBeInstanceOf(Types.ObjectId);
            expect(result[1]).toBeInstanceOf(Types.ObjectId);
            expect(result[2]).toBeInstanceOf(Types.ObjectId);
            expect(result[0].toString()).toBe('507f1f77bcf86cd799439011');
            expect(result[1].toString()).toBe('507f1f77bcf86cd799439012');
            expect(result[2].toString()).toBe('507f1f77bcf86cd799439013');
        });

        test('should return empty array for empty input', () => {
            const result = stringToObjectId([]);

            expect(result).toEqual([]);
        });

        test('should handle single string', () => {
            const strings = ['507f1f77bcf86cd799439011'];

            const result = stringToObjectId(strings);

            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(Types.ObjectId);
            expect(result[0].toString()).toBe('507f1f77bcf86cd799439011');
        });

        test('should preserve order of strings', () => {
            const strings = [
                '507f1f77bcf86cd799439011',
                '507f1f77bcf86cd799439012',
                '507f1f77bcf86cd799439013',
            ];

            const result = stringToObjectId(strings);

            expect(result[0].toString()).toBe('507f1f77bcf86cd799439011');
            expect(result[1].toString()).toBe('507f1f77bcf86cd799439012');
            expect(result[2].toString()).toBe('507f1f77bcf86cd799439013');
        });

        test('should handle large arrays', () => {
            const strings = Array.from({ length: 100 }, () => new Types.ObjectId().toString());

            const result = stringToObjectId(strings);

            expect(result.length).toBe(100);
            result.forEach((id) => {
                expect(id).toBeInstanceOf(Types.ObjectId);
            });
        });

        test('should throw error for invalid ObjectId string', () => {
            const invalidStrings = ['invalid-id'];

            expect(() => stringToObjectId(invalidStrings)).toThrow();
        });

        test('should throw error for non-24-character strings', () => {
            const invalidStrings = ['12345'];

            expect(() => stringToObjectId(invalidStrings)).toThrow();
        });
    });

    describe('roundtrip conversion', () => {
        test('should convert ObjectId to string and back', () => {
            const originalIds = [
                new Types.ObjectId('507f1f77bcf86cd799439011'),
                new Types.ObjectId('507f1f77bcf86cd799439012'),
            ];

            const strings = objectIdToString(originalIds);
            const convertedBack = stringToObjectId(strings);

            expect(convertedBack[0].toString()).toBe(originalIds[0].toString());
            expect(convertedBack[1].toString()).toBe(originalIds[1].toString());
        });

        test('should convert string to ObjectId and back', () => {
            const originalStrings = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];

            const objectIds = stringToObjectId(originalStrings);
            const convertedBack = objectIdToString(objectIds);

            expect(convertedBack).toEqual(originalStrings);
        });
    });
});
