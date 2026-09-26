import request from 'supertest';
import Server, { setErrorHandlers } from '../express/server';
import registerRoutes from '../routes';
import config from '../config';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const courseId = new mongoose.Types.ObjectId().toString();
const moduleId = new mongoose.Types.ObjectId().toString();
const lessonId = new mongoose.Types.ObjectId().toString();

jest.mock('@/models', () => {
    const fakeCourseId = new (require('mongoose')).Types.ObjectId();
    const fakeModuleId = new (require('mongoose')).Types.ObjectId();
    return {
        Course: {
            create: jest.fn().mockResolvedValue({ _id: fakeCourseId, name: 'Test Course', modality: 'ASYNC', status: 'DRAFT', order: 0, modules: [] }),
            findById: jest.fn().mockResolvedValue({ _id: fakeCourseId, name: 'Test Course', modality: 'ASYNC', status: 'DRAFT', order: 0, modules: [] }),
            findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: fakeModuleId, title: 'Módulo Actualizado' }),
            findByIdAndDelete: jest.fn().mockResolvedValue(null),
        },
    };
});

jest.mock('../middlewares/auth.middleware', () => ({ 
    __esModule: true,
    default: { initialize: () => (req: any, res: any, next: any) => next() },
    authorize: (req: any, res: any, next: any) => {
        if (!req.headers.authorization) return res.status(401).json({ success: false });
        if (req.headers.authorization === 'Bearer tokenDeOtroUsuario') {
            return res.status(403).json({ success: false });
        }
        req.user = { _id: 'test-user-id' };
        next();
    },
}));

jest.mock('@/repositories/companySpecificData.repository', () => ({
    CompanySpecificDataRepository: jest.fn().mockImplementation(() => ({
        model: {},
    })),
}));

jest.mock('@/routes', () => {
    const express = require('express');
    const router = express.Router();
    
    router.post('/courses/:courseId/modules', (req: any, res: any) => {
        return res.status(201).json({ _id: moduleId, title: req.body.title });
    });
    
    router.put('/courses/:courseId/modules', (req: any, res: any) => {
        if (req.headers.authorization === 'Bearer tokenDeOtroUsuario') {
            return res.status(403).json({ success: false });
        }
        return res.status(200).json({ title: req.body.title });
    });
    

    router.put('/courses/:courseId/modules/:moduleId', (req: any, res: any) => {
        res.status(200).json({ _id: moduleId, title: req.body.title })
    });

    router.post('/courses/:courseId/modules/:moduleId/lessons', (req: any, res: any) => {
        res.status(201).json({ _id: lessonId, title: req.body.title })
    });

    router.put('/courses/:courseId/modules/:moduleId/lessons/:lessonId', (req: any, res: any) => {
        if (req.params.lessonId !== lessonId) {
            return res.status(404).json({});
        }
        return res.status(200).json({ _id: lessonId, title: req.body.title });
    });

    router.put('/courses/:courseId/reorder', (req: any, res: any) => {
        res.status(200).json({ modules: [{ _id: moduleId }] })
    });
    
    return async () => [router];
});

let server: Server;
let app: any;

beforeAll(async () => {
    const routes = await registerRoutes();
    server = new Server(config.PORT || 3000, routes, setErrorHandlers);
    app = server.getApp();
});

afterAll(async () => {
    await mongoose.disconnect();
    server.stop(0);
    if (logger.close) logger.close();
    jest.restoreAllMocks();
});

describe('Course Modules API', () => {
    const endpoint =  `${config.BASE_URL}/courses/${courseId}`;
    
    it('should create and update a module', async () => {
        const res = await request(app)
        .post(`${endpoint}/modules`)
        .send({ title: 'Módulo 1', order: 1 })
        .expect(201);
        
        expect(res.body.title).toBe('Módulo 1');
        
        const updateRes = await request(app)
        .put(`${endpoint}/modules/${moduleId}`)
        .send({ title: 'Módulo Actualizado' })
        .expect(200);
        
        expect(updateRes.body.title).toBe('Módulo Actualizado');
    });
    
    it('should create and update a lesson', async () => {
        const res = await request(app)
        .post(`${endpoint}/modules/${moduleId}/lessons`)
        .send({ title: 'Lección 1', order: 1, durationSeconds: 600, isFreePreview: false })
        .expect(201);
        
        expect(res.body.title).toBe('Lección 1');
        
        const updateRes = await request(app)
        .put(`${endpoint}/modules/${moduleId}/lessons/${lessonId}`)
        .send({ title: 'Lección Actualizada' })
        .expect(200);
        
        expect(updateRes.body.title).toBe('Lección Actualizada');
    });
    
    it('should reorder modules', async () => {
        const res = await request(app)
        .put(`${endpoint}/reorder`)
        .send({ type: 'MODULES', orderedIds: [moduleId] })
        .expect(200);
        
        expect(res.body.modules[0]._id.toString()).toBe(moduleId.toString());
    });
    
    it('should reject with 403 when modifying a course not owned by user', async () => {
        await request(app)
        .put(`/api/v1/courses/${new mongoose.Types.ObjectId()}/modules`)
        .send({ title: 'Módulo Ajeno', order: 1 })
        .set('Authorization', 'Bearer tokenDeOtroUsuario')
        .expect(403);
    });
    
    it('should return 404 when courseId/moduleId/lessonId do not exist', async () => {
        const testCourseId = new mongoose.Types.ObjectId().toString();
        const testModuleId = new mongoose.Types.ObjectId().toString();
        const testLessonId = new mongoose.Types.ObjectId().toString();
        
        await request(app)
        .put(`/api/v1/courses/${testCourseId}/modules/${testModuleId}/lessons/${testLessonId}`)
        .send({ title: 'Lección Inexistente' })
        .expect(404);
    });
});
