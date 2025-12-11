import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Limiter global: evita abuso general (configurar en env si es necesario)
export const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000), // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX ?? 1000), // limit each IP to 1000 requests per windowMs (aumentado para dev)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  },
});

// Limiter para endpoints sensibles (auth)
export const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS_AUTH ?? 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX_AUTH ?? 20), // p. ej. 20 attemps por 15min (aumentado para dev)
  // Use X-Forwarded-For or socket remote address first to support IPv6 and proxied requests
  keyGenerator: (req: Request) => {
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const remote = (req.socket && (req.socket.remoteAddress as string)) || '';
    return forwarded.split(',')[0].trim() || remote || '';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({ message: 'Too many authentication attempts. Please try again later.' });
  },
});

// Limiter para endpoints públicos de archivos estáticos
export const publicFileLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS_PUBLIC_FILES ?? 1 * 60 * 1000), // 1 minuto
  max: Number(process.env.RATE_LIMIT_MAX_PUBLIC_FILES ?? 30), // 30 requests por minuto por IP
  keyGenerator: (req: Request) => {
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const remote = (req.socket && (req.socket.remoteAddress as string)) || '';
    return forwarded.split(',')[0].trim() || remote || '';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({ message: 'Too many requests for files. Please try again later.' });
  },
  skip: (req: Request) => 
    // Opcionalmente, puedes skipear rate limiting para ciertas IPs confiables
    // const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    // const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress;
    // return trustedIPs.includes(clientIP || '');
     false
  ,
});

export default {};
