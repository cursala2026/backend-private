import request from 'supertest';
import express from 'express';

describe('rateLimit.middleware', () => {
  beforeEach(() => {
    // Forzar límites bajos durante la prueba
    process.env.RATE_LIMIT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    process.env.RATE_LIMIT_WINDOW_MS_AUTH = '2000';
    process.env.RATE_LIMIT_MAX_AUTH = '1';
    process.env.RATE_LIMIT_WINDOW_MS_PUBLIC_FILES = '3000';
    process.env.RATE_LIMIT_MAX_PUBLIC_FILES = '1';
    // Limpiar caché para que el módulo vuelva a leer las vars de entorno
    try {
      delete require.cache[require.resolve('../rateLimit.middleware')];
    } catch (e) {
      // ignore if not resolvable
    }
  });

  it('devuelve 429 y Retry-After exacto tras exceder el límite global', async () => {
    const { globalLimiter } = require('../rateLimit.middleware');
    const app = express();
    app.use(globalLimiter);
    app.get('/', (_req, res) => res.status(200).send('ok'));

    const agent = request(app);
    await agent.get('/').expect(200, 'ok');
    const res = await agent.get('/');

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('1');
    expect(res.body).toHaveProperty('message', 'Demasiadas solicitudes, por favor inténtalo más tarde.');
  });

  it('parseEnvInt maneja valores válidos e inválidos', () => {
    const { parseEnvInt } = require('../rateLimit.middleware');
    expect(parseEnvInt('42', 10)).toBe(42);
    expect(parseEnvInt(undefined, 10)).toBe(10);
    expect(parseEnvInt('', 10)).toBe(10);
    expect(parseEnvInt('not-a-number', 10)).toBe(10);
    expect(parseEnvInt('0', 10)).toBe(10);
    expect(parseEnvInt('-5', 10)).toBe(10);
  });

  it('getClientIp prefiere req.ip, luego x-forwarded-for y por último socket.remoteAddress', () => {
    const { getClientIp } = require('../rateLimit.middleware');
    const req1: any = { ip: '1.2.3.4' };
    expect(getClientIp(req1)).toBe('1.2.3.4');

    const req2: any = { ip: '', headers: { 'x-forwarded-for': '5.6.7.8, 9.9.9.9' }, socket: { remoteAddress: '10.0.0.1' } };
    expect(getClientIp(req2)).toBe('5.6.7.8');

    const req3: any = { headers: {}, socket: { remoteAddress: '10.0.0.2' } };
    expect(getClientIp(req3)).toBe('10.0.0.2');
  });

  it('Retry-After exacto para auth y publicFile limiters', async () => {
    const { authLimiter, publicFileLimiter } = require('../rateLimit.middleware');

    const appAuth = express();
    appAuth.use(authLimiter);
    appAuth.get('/', (_req, res) => res.status(200).send('ok'));

    const agentAuth = request(appAuth);
    await agentAuth.get('/').expect(200, 'ok');
    const resAuth = await agentAuth.get('/');
    // windowMs auth = 2000 -> Retry-After = 2
    expect(resAuth.status).toBe(429);
    expect(resAuth.headers['retry-after']).toBe('2');

    const appPub = express();
    appPub.use(publicFileLimiter);
    appPub.get('/', (_req, res) => res.status(200).send('ok'));

    const agentPub = request(appPub);
    await agentPub.get('/').expect(200, 'ok');
    const resPub = await agentPub.get('/');
    // windowMs public = 3000 -> Retry-After = 3
    expect(resPub.status).toBe(429);
    expect(resPub.headers['retry-after']).toBe('3');
  });
});
