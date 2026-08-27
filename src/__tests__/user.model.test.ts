import mongoose from 'mongoose';
import { User } from '../models/user.model';

describe('UserSchema Validations', () => {
    beforeAll(async () => {
        jest.setTimeout(30000);
        await mongoose.connect('mongodb://localhost:27017/test');
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    it('❌ Bio > 500 carateres debe fallar', async () => {
        const longBio = 'a'.repeat(501);
        const user = new User({
            username: 'bioTest',
            email: 'bio@test.com',
            password: '123456',
            firstName: 'Test',
            lastName: 'User',
            roles: 'PROFESOR',
            teacherStatus: 'NOT_REQUESTED',
            title: 'Profesor',
            yearsOfExperience: 5,
            bio: longBio,
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
        });

        await expect(user.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('❌ Role como array o valor inválido debe fallar', async () => {
        const invalidUser = new User({
            username: 'roleTest',
            email: 'role@test.com',
            password: '123456',
            firstName: 'Test',
            lastName: 'User',
            roles: ['PROFESOR'],
            teacherStatus: 'NOT_REQUESTED',
            title: 'Profesor',
            yearsOfExperience: 5,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
        });

        await expect(invalidUser.validate()).rejects.toThrow(mongoose.Error.ValidationError);

        const invalidRoleUser = new User({
            username: 'roleTest',
            email: 'role@test.com',
            password: '123456',
            firstName: 'Test',
            lastName: 'User',
            roles: 'SUPERADMIN',
            teacherStatus: 'NOT_REQUESTED',
            title: 'Profesor',
            yearsOfExperience: 5,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
        });

        await expect(invalidRoleUser.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('✅ agreementAccepted debe inicializar en false', async () => {
        const user = new User({
            username: 'agreementTest',
            email: 'agreement@test.com',
            password: '123456',
            firstName: 'Test',
            lastName: 'User',
            roles: 'PROFESOR',
            teacherStatus: 'NOT_REQUESTED',
            title: 'Profesor',
            yearsOfExperience: 2,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
        });

        expect(user.agreementAccepted).toBe(false);
    });

    it('❌ yearsOfExperience negativo debe fallar', async () => {
        const user = new User({
            username: 'experienceTest',
            email: 'experience@test.com',
            password: '123456',
            firstName: 'Test',
            lastName: 'User',
            roles: 'PROFESOR',
            teacherStatus: 'NOT_REQUESTED',
            title: 'Profesor',
            yearsOfExperience: -1,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
        });

        await expect(user.validate()).rejects.toThrow(mongoose.Error.ValidationError);
    });
});