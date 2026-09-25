import request from 'supertest';
import Server, { setErrorHandlers } from '../express/server';
import registerRoutes from '../routes';
import logger from '../utils/logger';
import config from '../config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { UserRoles } from '../models/enums/user.enum';
import { courseRepository } from '../repositories';
import { Course } from '@/models';

jest.mock('@/services/bunny.service', () => ({
    __esModule: true,
    default: {
        getInstance: () => ({
            uploadFile: jest.fn().mockResolvedValue('https://cdn.test/courses/fakeCourseId/attachments/test.pdf'),
            isStreamUrl: jest.fn().mockReturnValue(true),
            generateUniqueFileName: jest.fn().mockReturnValue('video123')
        })
    }
}));

jest.mock('../middlewares/auth.middleware', () => ({ 
    __esModule: true,
    default: { initialize: () => (req: any, res: any, next: any) => next() },
    authorize: (req: any, res: any, next: any) => {
        if (!req.headers.authorization) return res.status(401).json({ success: false });
        const token = req.headers.authorization.replace('Bearer ', '');
        try {
            const payload = jwt.verify(token, config.JWT_SECRET);
            req.user = payload;
            next();
        } catch (err) {
            return res.status(401).json({ success: false });
        }
    },
}));

let server: Server;
let app: any;
const fakeCourseId = new mongoose.Types.ObjectId().toHexString();
const fakeLessonId = new mongoose.Types.ObjectId().toHexString();
const fakeTeacherId = new mongoose.Types.ObjectId();

const validToken = jwt.sign(
    { _id: fakeTeacherId.toHexString(), roles: UserRoles.ADMIN },
    config.JWT_SECRET,
    { expiresIn: '1h' }
);

jest.spyOn(courseRepository, 'findOneById').mockResolvedValue({
    _id: fakeCourseId,
    modules: [{ lessons: [{ _id: fakeLessonId }] }],
    teachers: [fakeTeacherId]
} as any);

beforeAll(async () => {
    const router = await registerRoutes();
    server = new Server(config.PORT || 3000, router, setErrorHandlers);
    app = server.getApp();
    
    jest.spyOn(Course, 'findById').mockResolvedValue({
        _id: fakeCourseId,
        modules: [{
            lessons: [{ _id: fakeLessonId }]
        }],
        teachers: [fakeTeacherId],
        save: jest.fn().mockResolvedValue(true)
    } as any);
});

afterEach(() => {
    jest.clearAllMocks();
});

afterAll(() => {
    server.stop(0);
    if (logger.close) logger.close();
});

describe('CourseAttachmentController', () => {
    const endpoint = (id: string) => `${config.BASE_URL}/courses/${id}/attachments`;
    const authHeader = { Authorization: `Bearer ${validToken}` };
    
    it('✅ subida exitosa y retorno JSON correcto', async () => {
        const res = await request(app)
        .post(endpoint(fakeCourseId))
        .set(authHeader)
        .field('lessonId', fakeLessonId)
        .attach('file', Buffer.from('fake'), { filename: 'test.pdf' });
        
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('fileUrl');
        expect(res.body).toHaveProperty('title');
        expect(res.body).toHaveProperty('fileType');
    });
    
    it('🚫 bloqueo ante extensiones ejecutables', async () => {
        const res = await request(app)
        .post(endpoint(fakeCourseId))
        .set(authHeader)
        .field('lessonId', fakeLessonId)
        .attach('file', Buffer.from('fake'), { filename: 'malware.exe' });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Tipo de archivo no permitido/i);
    });
    
    it('🚫 bloqueo cuando el archivo excede 50 MB', async () => {
        const bigBuffer = Buffer.alloc(51 * 1024 * 1024);
        const res = await request(app)
        .post(endpoint(fakeCourseId))
        .set(authHeader)
        .field('lessonId', fakeLessonId)
        .attach('file', bigBuffer, { filename: 'cv.pdf' });
        
        expect(res.status).toBe(413);
        expect(res.body.message).toMatch(/Archivo demasiado grande/i);
    });
    
    it('🚫 control de pertenencia: 403 si no es dueño/profesor', async () => {
        const unauthorizedUserId = new mongoose.Types.ObjectId();
        const otherTeacherId = new mongoose.Types.ObjectId();
        
        jest.spyOn(Course, 'findById').mockResolvedValue({
            _id: fakeCourseId,
            modules: [{ lessons: [{ _id: fakeLessonId }] }],
            teachers: [otherTeacherId],
            save: jest.fn().mockResolvedValue(true)
        } as any);
        
        const tokenAlumno = jwt.sign(
            { _id: unauthorizedUserId.toHexString(), roles: UserRoles.ALUMNO },
            config.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        const res = await request(app)
        .post(endpoint(fakeCourseId))
        .set({ authorization: `Bearer ${tokenAlumno}` })
        .field('lessonId', fakeLessonId)
        .attach('file', Buffer.from('fake'), { filename: 'test.pdf' });
        
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Acceso denegado/i);
    });
});
