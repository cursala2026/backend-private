process.env.NODE_ENV = 'test';
import request from 'supertest';
import Server from '@/express/server';
import registerRoutes from '../routes';
import logger from '../utils/logger';
import { setErrorHandlers } from '../express/server';
import config from '../config';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { TeacherStatus, UserRoles, UserStatus } from '@/models/enums/user.enum';
import { Course, User, IUser } from '@/models';
import { userRepository } from '@/repositories';

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  actualMongoose.connect = jest.fn().mockResolvedValue(actualMongoose);
  return actualMongoose;
});


const fakeId = new mongoose.Types.ObjectId();
let server: Server;
let app: any;
jest.setTimeout(30000);

beforeAll(async () => {
    jest.spyOn(User, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([
            { name: 'Juan', lastName: 'Pérez', education: 'Licenciatura' }
        ])
    } as any);

    const router = await registerRoutes();
    server = new Server(config.PORT || 3000, router, setErrorHandlers);
    app = server.getApp();
});

afterAll(async () => {
    jest.restoreAllMocks();
    if (server) server.stop(0);
    if (logger.close) logger.close();
    await mongoose.connection.close(true);
    await mongoose.disconnect();
});

describe('GET /courses/:courseId/students', () => {
    const endpoint = `${config.BASE_URL}/courses/fakeCourseId/students`;

    it('rechaza a role ALUMNO con 403', async () => {
        const tokenAlumno = jwt.sign(
            { _id: fakeId.toHexString(), roles: UserRoles.ALUMNO, teacherStatus: TeacherStatus.ACTIVE }, 
            config.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        jest.spyOn(userRepository, 'findById').mockResolvedValue({
            _id: fakeId,
            username: 'Alumno',
            email: 'alumno@example.com',
            password: 'dummy',
            firstName: 'Alumno',
            lastName: 'Test',
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: UserRoles.ALUMNO,
            resetPasswordToken: '',
            hasCompletedInterestsForm: false,
            interests: [],
            teacherStatus: TeacherStatus.ACTIVE,
            title: 'Estudiante',
            yearsOfExperience: 0,
            bio: 'Alumno de prueba',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
            agreementAccepted: true,
            agreementTimestamp: new Date(),
        } as IUser);
        jest.spyOn(Course, 'findById').mockResolvedValue({
            _id: 'fakeCourseId',
            teacherId: fakeId.toHexString(),
            students: ['student1']
        });

        const res = await request(app)
            .get(endpoint)
            .set({ 'authorization': `Bearer ${tokenAlumno}` });

        expect(res.status).toBe(403);
    });

    it('rechaza a profesor PENDING_APPROVAL con 403', async () => {
        const tokenPendiente = jwt.sign(
            { _id: fakeId.toHexString(), roles: UserRoles.PROFESOR, teacherStatus: TeacherStatus.PENDING_APPROVAL }, 
            config.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        jest.spyOn(userRepository, 'findById').mockResolvedValue({
            _id: fakeId,
            username: 'Pendiente',
            email: 'pendiente@example.com',
            password: 'dummy',
            firstName: 'Profesor',
            lastName: 'Pendiente',
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: UserRoles.PROFESOR,
            resetPasswordToken: '',
            hasCompletedInterestsForm: false,
            interests: [],
            teacherStatus: TeacherStatus.PENDING_APPROVAL,
            title: 'Licenciado',
            yearsOfExperience: 5,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
            agreementAccepted: true,
            agreementTimestamp: new Date(),
        } as IUser);
        jest.spyOn(Course, 'findById').mockResolvedValue({
            _id: 'fakeCourseId',
            teacherId: fakeId.toHexString(),
            students: ['student1']
        });

        const res = await request(app)
            .get(endpoint)
            .set({ 'authorization': `Bearer ${tokenPendiente}` });

        expect(res.status).toBe(403);
    });

    it('rechaza acceso a curso de otro profesor', async () => {
        const tokenProfesor = jwt.sign(
            { _id: fakeId.toHexString(), roles: UserRoles.PROFESOR, teacherStatus: TeacherStatus.ACTIVE }, 
            config.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        jest.spyOn(userRepository, 'findById').mockResolvedValue({
            _id: fakeId,
            username: 'TestUser',
            email: 'testuser@example.com',
            password: 'dummy',
            firstName: 'Profesor',
            lastName: 'Activo',
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: UserRoles.PROFESOR,
            resetPasswordToken: '',
            hasCompletedInterestsForm: false,
            interests: [],
            teacherStatus: TeacherStatus.ACTIVE,
            title: 'Licenciado',
            yearsOfExperience: 5,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
            agreementAccepted: true,
            agreementTimestamp: new Date(),
        } as IUser);
        jest.spyOn(Course, 'findById').mockResolvedValue({
            _id: 'fakeCourseId',
            teacherId: 'otroProfesorId',
            students: ['student1']
        });

        const res = await request(app)
            .get(endpoint)
            .set({ 'authorization': `Bearer ${tokenProfesor}` });

        expect([403, 404]).toContain(res.status);
    });

    it('devuelve solo name, lastName y education', async () => {
        const tokenProfesorActivo = jwt.sign(
            { _id: fakeId.toHexString(), roles: UserRoles.PROFESOR, teacherStatus: TeacherStatus.ACTIVE }, 
            config.JWT_SECRET, 
            { expiresIn: '1h' }
        );
        jest.spyOn(userRepository, 'findById').mockResolvedValue({
            _id: fakeId,
            username: 'TestUser',
            email: 'testuser@example.com',
            password: 'dummy',
            firstName: 'Profesor',
            lastName: 'Activo',
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: UserRoles.PROFESOR,
            resetPasswordToken: '',
            hasCompletedInterestsForm: false,
            interests: [],
            teacherStatus: TeacherStatus.ACTIVE,
            title: 'Licenciado',
            yearsOfExperience: 5,
            bio: 'Mi biografia',
            photoUrl: 'https://cdn.test/photo.png',
            cvUrl: 'https://cdn.test/cv.pdf',
            signatureUrl: 'https://cdn.test/signature.png',
            agreementAccepted: true,
            agreementTimestamp: new Date(),
        } as IUser);
        jest.spyOn(Course, 'findById').mockResolvedValue({
            _id: 'fakeCourseId',
            teacherId: fakeId.toHexString(),
            students: ['student1']
        });

        const res = await request(app)
            .get(endpoint)
            .set({ 'authorization': `Bearer ${tokenProfesorActivo}` });

        expect(res.status).toBe(200);
        res.body.forEach((student: any) => {
            expect(student).toHaveProperty('name');
            expect(student).toHaveProperty('lastName');
            expect(student).toHaveProperty('education');
            expect(student).not.toHaveProperty('email');
            expect(student).not.toHaveProperty('password');
        });
    });
});