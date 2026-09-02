process.env.NODE_ENV = 'test';
import request from 'supertest';
import Server, { setErrorHandlers } from '../express/server';
import registerRoutes from '../routes';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import config from '../config';
import UserRepository from '@/repositories/user.repository';
import mongoose from 'mongoose';

const token = jwt.sign(
    { userId: 'fakeUserId' }, 
    config.JWT_SECRET, 
    { expiresIn: '1h' }
);
jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose as any);
let server: Server;
let app: any;
jest.setTimeout(30000);

jest.mock('@/repositories/user.repository');

beforeAll(async () => {
    const router = await registerRoutes();
    server = new Server(config.PORT || 3000, router, setErrorHandlers);
    app = server.getApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
    jest.restoreAllMocks();
    if (server) server.stop(0);
    if (logger.close) logger.close();
    await mongoose.disconnect(); // <--- Agregá esto acá
});
describe('POST user/teacher/apply', () => {
    const endpoint = `${config.BASE_URL}/user/teacher/apply`;
    const authHeader = { 'authorization': `Bearer ${token}` };
    
    it('rechaza si agreementAccepted es false', async () => {
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .send({
            title: 'Profesor',
            yearsOfExperience: 3,
            bio: 'Docente',
            photoUrl: 'https://cdn.bunny.net/photo.png',
            cvUrl: 'https://cdn.bunny.net/cv.pdf',
            signatureUrl: 'https://cdn.bunny.net/signature.png',
            agreementAccepted: false,
        });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Agreement accepted is required');
    });
    
    it('rechaza si falta cvUrl', async () => {
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .send({
            title: 'Profesor',
            yearsOfExperience: 3,
            bio: 'Docente',
            photoUrl: 'https://cdn.bunny.net/photo.png',
            signatureUrl: 'https://cdn.bunny.net/signature.png',
            agreementAccepted: true,
        });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('CV URL is required');
    });
    
    it('rechaza si bio excede 500 caracteres', async () => {
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .send({
            title: 'Profesor',
            yearsOfExperience: 3,
            bio: 'a'.repeat(501),
            photoUrl: 'https://cdn.bunny.net/photo.png',
            cvUrl: 'https://cdn.bunny.net/cv.pdf',
            signatureUrl: 'https://cdn.bunny.net/signature.png',
            agreementAccepted: true,
        });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Bio must be less than 500 characters');
    });
    
    it('acepta payload válido y genera timestamp', async () => {
        (UserRepository.prototype.updateUser as jest.Mock).mockResolvedValueOnce({
            _id: 'fakeUserId',
            teacherStatus: 'PENDING_APPROVAL',
            agreementTimestamp: new Date(),
            agreementAccepted: true,
            title: 'Profesor',
            yearsOfExperience: 3,
            bio: 'Docente',
            profilePhotoUrl: 'https://cdn.bunny.net/photo.png',
            cvUrl: 'https://cdn.bunny.net/cv.pdf',
            professionalSignatureUrl: 'https://cdn.bunny.net/signature.png',
        });

        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .send({
            title: 'Profesor',
            yearsOfExperience: 3,
            bio: 'Docente',
            photoUrl: 'https://cdn.bunny.net/photo.png',
            cvUrl: 'https://cdn.bunny.net/cv.pdf',
            signatureUrl: 'https://cdn.bunny.net/signature.png',
            agreementAccepted: true,
        });
        
        expect(res.status).toBe(200);
        expect(res.body.data.teacherStatus).toBe('PENDING_APPROVAL');
        expect(new Date(res.body.data.agreementTimestamp)).toEqual(expect.any(Date));
    });
});