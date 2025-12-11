import { generateUniqueFileName, deleteOldFile, multerDestination, multerFilename, multerFileFilter } from '../fileUpload.util';
import path from 'path';
import fs from 'fs';
import { Express } from 'express';

describe('fileUpload.util', () => {
    describe('generateUniqueFileName', () => {
        test('should generate unique filename with timestamp and random suffix', () => {
            const mockFile = { originalname: 'test-file.png' };
            const result = generateUniqueFileName(mockFile);

            expect(result).toMatch(/^test-file\[\d+-\d+\]\.png$/);
        });

        test('should sanitize suspicious characters from filename', () => {
            const mockFile = { originalname: 'test/../malicious<>.png' };
            const result = generateUniqueFileName(mockFile);

            expect(result).not.toContain('..');
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
            // path.basename removes the directory part, so 'test/../malicious<>.png' becomes 'malicious<>.png'
            expect(result).toMatch(/^malicious__\[\d+-\d+\]\.png$/);
        });

        test('should handle filenames with path traversal attempts', () => {
            const mockFile = { originalname: '../../../etc/passwd.png' };
            const result = generateUniqueFileName(mockFile);

            expect(result).not.toContain('..');
            expect(result).toMatch(/^passwd\[\d+-\d+\]\.png$/);
        });

        test('should limit filename length to 128 characters', () => {
            const longName = 'a'.repeat(200) + '.png';
            const mockFile = { originalname: longName };
            const result = generateUniqueFileName(mockFile);

            // Should be base (128) + [timestamp-random] + .png
            expect(result.length).toBeLessThan(200);
        });

        test('should preserve file extension', () => {
            const mockFile = { originalname: 'document.pdf' };
            const result = generateUniqueFileName(mockFile);

            expect(result).toMatch(/\.pdf$/);
        });
    });

    describe('multerDestination', () => {
        test('should set destination to uploadDirImages for imageFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'imageFile' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('images'));
        });

        test('should set destination to uploadDirFilesPublic for cvFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'cvFile' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('filesPublic'));
        });

        test('should set destination to uploadDirFilesPublic for programFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'programFile' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('filesPublic'));
        });

        test('should set destination to uploadDirProfileImages for photo', () => {
            const cb = jest.fn();
            const file = { fieldname: 'photo' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('profile-images'));
        });

        test('should set destination to uploadDirSignatures for signatureFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'signatureFile' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('signatures'));
        });

        test('should set destination to uploadDirMaterials for materialFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'materialFile' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('materials'));
        });

        test('should return error for unrecognized fieldname', () => {
            const cb = jest.fn();
            const file = { fieldname: 'unknownField' };

            multerDestination(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error), '');
            expect(cb.mock.calls[0][0].message).toBe('Campo de archivo no reconocido.');
        });
    });

    describe('multerFilename', () => {
        test('should generate unique filename using generateUniqueFileName', () => {
            const cb = jest.fn();
            const file = { originalname: 'test.png' };

            multerFilename(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, expect.stringMatching(/^test\[\d+-\d+\]\.png$/));
        });

        test('should handle errors during filename generation', () => {
            const cb = jest.fn();
            const file = null as unknown as Express.Multer.File; // Force error

            multerFilename(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error), expect.anything());
        });
    });

    describe('multerFileFilter', () => {
        test('should accept jpeg/png/gif for imageFile', () => {
            const cb = jest.fn();
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

            allowedTypes.forEach(mimetype => {
                cb.mockClear();
                const file = { fieldname: 'imageFile', mimetype };
                multerFileFilter(null, file, cb);
                expect(cb).toHaveBeenCalledWith(null, true);
            });
        });

        test('should reject non-image types for imageFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'imageFile', mimetype: 'application/pdf' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toBe('Tipo de archivo no permitido. Solo imágenes.');
        });

        test('should accept pdf for cvFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'cvFile', mimetype: 'application/pdf' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, true);
        });

        test('should reject non-pdf for cvFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'cvFile', mimetype: 'image/jpeg' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toBe('Tipo de archivo no permitido. Solo PDFs.');
        });

        test('should accept jpeg/png/jpg for photo', () => {
            const cb = jest.fn();
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

            allowedTypes.forEach(mimetype => {
                cb.mockClear();
                const file = { fieldname: 'photo', mimetype };
                multerFileFilter(null, file, cb);
                expect(cb).toHaveBeenCalledWith(null, true);
            });
        });

        test('should reject non-jpeg/png/jpg for photo', () => {
            const cb = jest.fn();
            const file = { fieldname: 'photo', mimetype: 'image/gif' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error));
        });

        test('should accept png for signatureFile', () => {
            const cb = jest.fn();
            const file = { fieldname: 'signatureFile', mimetype: 'image/png' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, true);
        });

        test('should accept jpeg/jpg for signatureFile (supported)', () => {
            const cb = jest.fn();
            const file = { fieldname: 'signatureFile', mimetype: 'image/jpeg' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(null, true);
        });

        test('should accept multiple document types for materialFile', () => {
            const cb = jest.fn();
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'text/plain',
            ];

            allowedTypes.forEach(mimetype => {
                cb.mockClear();
                const file = { fieldname: 'materialFile', mimetype };
                multerFileFilter(null, file, cb);
                expect(cb).toHaveBeenCalledWith(null, true);
            });
        });

        test('should reject unrecognized fieldname', () => {
            const cb = jest.fn();
            const file = { fieldname: 'unknownField', mimetype: 'image/png' };

            multerFileFilter(null, file, cb);

            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toBe('Campo de archivo no reconocido.');
        });
    });

    describe('deleteOldFile', () => {
        const testDir = path.join(__dirname, '../../static/test-temp');
        const testFile = 'test-file.txt';

        beforeEach(() => {
            // This test doesn't actually create files, just tests the logic
        });

        test('should return false for non-existent file', () => {
            const result = deleteOldFile('nonexistent.txt', 'images');
            expect(result).toBe(false);
        });

        test('should handle all directory types', () => {
            const directories: Array<'profile-images' | 'images' | 'filesPublic' | 'materials' | 'signatures'> = [
                'profile-images',
                'images',
                'filesPublic',
                'materials',
                'signatures',
            ];

            directories.forEach(dir => {
                const result = deleteOldFile('test.txt', dir);
                // Will be false because file doesn't exist, but shouldn't throw error
                expect(typeof result).toBe('boolean');
            });
        });
    });
});
