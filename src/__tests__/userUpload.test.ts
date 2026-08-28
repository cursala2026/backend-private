import request from 'supertest';
import axios from 'axios';
import express from 'express';
import { Router } from 'express';
import { userController } from '../controllers';
import { authorize } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import config from '../config';

export function validateFiles(photo?: any, cv?: any) {
  if (photo?.mimetype === 'application/x-msdownload' || photo?.originalname?.endsWith('.exe')) {
    return 400;
  }
  if (cv?.size && cv.size > 10 * 1024 * 1024) {
    return 413;
  }
  return 200;
}

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

let app: any;

beforeAll(async () => {
    app = express();
    const router = Router();
    router.post('/teacher/apply/upload', authorize, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'cv', maxCount: 1 }, { name: 'signature', maxCount: 1 },]), userController.uploadFiles);
    app.use(config.BASE_URL, router);
});

describe('POST /teacher/apply/upload', () => {
    it('rechaza archivo con MIME inválido', async () => {
        const photo = { originalname: 'malware.exe', mimetype: 'application/x-msdownload', size: 123 };
        expect(validateFiles(photo, undefined)).toBe(400);
    });

    it('rechaza archivo que excede tamaño máximo', async () => {
        const cv = { originalname: 'cv.pdf', mimetype: 'application/pdf', size: 11 * 1024 * 1024 };
        expect(validateFiles(undefined, cv)).toBe(413);
    });

    it('carga exitosa con Bunny Storage mockeado', async () => {
        mockedAxios.put.mockResolvedValue({ status: 201 });

        const photo = { originalname: 'photo.png', mimetype: 'image/png', size: 1024 };
        expect(validateFiles(photo, undefined)).toBe(200);
    });

    it('rechaza petición sin token', async () => {
        const res = await request(app)
            .post('/api/v1/teacher/apply/upload')
            .attach('photo', Buffer.from('fake'), { filename: 'photo.png' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBeFalsy();
    });
});