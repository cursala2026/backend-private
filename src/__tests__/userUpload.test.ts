import request from 'supertest';
import axios from 'axios';
import Server, { setErrorHandlers } from '../express/server';
import registerRoutes from '../routes';
import logger from '../utils/logger';
import config from '../config';

jest.mock('../middlewares/auth.middleware', () => ({ 
    __esModule: true,
    default: { initialize: () => (req: any, res: any, next: any) => next() },
    authorize: (req: any, res: any, next: any) => {
        if (!req.headers.authorization) return res.status(401).json({ success: false });
        req.user = { _id: 'test-user-id' };
        next();
    },
}));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

let server: Server;
let app: any;

beforeAll(async () => {
    const router = await registerRoutes();
    server = new Server(config.PORT || 3000, router, setErrorHandlers);
    app = server.getApp();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  server.stop(0);
  if (logger.close) logger.close();
});

describe('POST user/teacher/apply/upload', () => {
    const endpoint = `${config.BASE_URL}/user/teacher/apply/upload`;
    const authHeader = { Authorization: 'Bearer fake.jwt.token' };
    
    it('rechaza archivo con MIME inválido', async () => {
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .attach('photo', Buffer.from('fake'), { filename: 'malware.exe' });
        
        expect(res.status).toBe(400);
        expect(res.body.success).toBeFalsy();
    });
    
    it('rechaza archivo que excede tamaño máximo', async () => {
        const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .attach('cv', bigBuffer, { filename: 'cv.pdf' });
        
        expect(res.status).toBe(413);
    });
    
    it('carga exitosa con Bunny Storage mockeado', async () => {
        mockedAxios.put.mockResolvedValue({ status: 201 });
        
        const res = await request(app)
        .post(endpoint)
        .set(authHeader)
        .attach('photo', Buffer.from('fake'), { filename: 'photo.png', contentType: 'image/png' });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.urls.photo).toMatch(new RegExp(`${process.env.BUNNY_STORAGE_CDN_HOSTNAME}/teachers/`));
    });
    
    it('rechaza petición sin token', async () => {
        const res = await request(app)
        .post(endpoint)
        .attach('photo', Buffer.from('fake'), { filename: 'photo.png', contentType: 'image/png' });
        
        expect(res.status).toBe(401);
        expect(res.body.success).toBeFalsy();
    });
});