import express, { Express, Router } from 'express';
import http from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { middleware } from 'express-openapi-validator';
import process from 'process';
import util from 'util';
import { errorLogger, logger as loggerMiddleware } from 'express-winston';
import { globalLimiter } from '@/middlewares/rateLimit.middleware';

import { logger } from '../utils';
import config from '@/config';
import passport from '@/middlewares/auth.middleware';

interface NodeServer {
  start(): void;
  stop(exitCode?: number): void;
}

export default class Server implements NodeServer {
  private app: Express;

  private server: http.Server;

  constructor(
    private readonly port: number,
    private readonly routes: Router[],
    private readonly setErrorHandlers: (app: Express) => void
  ) {
    try {
      this.app = express();
      this.server = http.createServer(this.app);
      
      // Basic runtime validations for production secrets
      if (config.NODE_ENV === 'production') {
        if (!config.JWT_SECRET) {
          throw new Error('JWT_SECRET must be set in production');
        }
        if (!process.env.CERTIFICATE_ENCRYPTION_KEY) {
          throw new Error('CERTIFICATE_ENCRYPTION_KEY must be set in production');
        }
      }
      
      this.setServerConfig();
      this.setListeners();
    } catch (error: any) {
      logger.error('❌ Error in Server constructor:');
      logger.error(`   Message: ${error?.message || 'Unknown error'}`);
      logger.error(`   Stack: ${error?.stack || 'No stack trace'}`);
      throw error;
    }
  }

  start(): void {
    try {
      this.server.listen(this.port, () => {
        logger.info(`⚡ Listening on ${this.port}`);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        logger.error(`❌ Server error event triggered:`);
        logger.error(`   Code: ${error.code || 'N/A'}`);
        logger.error(`   Message: ${error.message}`);
        logger.error(`   Stack: ${error.stack || 'No stack trace'}`);
        
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${this.port} is already in use.`);
          logger.error(`💡 To fix this, you can:`);
          logger.error(`   1. Stop the process using port ${this.port}`);
          logger.error(`   2. On Windows: netstat -ano | findstr :${this.port} to find the PID`);
          logger.error(`   3. On Windows: taskkill /PID <PID> /F to kill the process`);
          logger.error(`   4. Or change the PORT in your .env file`);
          this.stop(1);
        } else {
          logger.error(`Server error: ${error.message}`);
          this.stop(1);
        }
      });
    } catch (error: any) {
      logger.error('❌ Error in server.start():');
      logger.error(`   Message: ${error?.message || 'Unknown error'}`);
      logger.error(`   Stack: ${error?.stack || 'No stack trace'}`);
      throw error;
    }
  }

  stop(exitCode = 0): void {
    logger.info(`Stopping server. Waiting for connections to end...`);
    this.server.close(() => {
      logger.info(`Server closed successfully`);
      process.exit(exitCode);
    });
  }

  setServerConfig(): void {
    try {
      this.app.set('port', this.port);
      this.app.set('trust proxy', 1);
      // Disable X-Powered-By to avoid leak of Express
      this.app.disable('x-powered-by');

      // Seguridad y optimización
    // Helmet default config. Enable CSP in production for stricter security.
    this.app.use(
      helmet({
        contentSecurityPolicy: config.NODE_ENV === 'production',
      })
    );
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.url.includes('/api/v1/class/') && req.url.endsWith('/video')) {
            return false;
          }
          return compression.filter(req, res);
        },
      })
    );
    // CORS configuration: prefer a specific frontend origin in production
    // Allow configuring multiple origins in `FRONTEND_DOMAIN` using comma-separated values.
    let corsOptions: any;
    if (config.FRONTEND_DOMAIN) {
      const allowed = String(config.FRONTEND_DOMAIN)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // En desarrollo, permitir localhost automáticamente
      if (config.NODE_ENV === 'development') {
        allowed.push('http://localhost:4200', 'http://localhost:3000', 'http://127.0.0.1:4200', 'http://127.0.0.1:3000', 'http://10.231.218.153:4200');
      }

      corsOptions = {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Allow non-browser or server-to-server requests (no Origin header)
          if (!origin) return callback(null, true);
          if (allowed.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        optionsSuccessStatus: 200,
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        preflightContinue: false,
      };
    } else {
      corsOptions = { origin: true, credentials: true };
    }

    // Asegurar que el middleware de CORS se aplique primero
    this.app.use(cors(corsOptions));
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    // Middleware global para garantizar CORS
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      next();
    });

    // ⭐ CAMBIO 1: Configurar timeouts del servidor para mitigar DoS por conexiones largas
    this.server.setTimeout(2 * 60 * 1000); // 2 minutos
    // headersTimeout should be slightly larger than server timeout (node defaults: 40000). Keep safe values
    this.server.headersTimeout = 2 * 60 * 1000; // 2 minutos

    // ⭐ CAMBIO 2: Ajustar límites de parsing; usar límites realistas. Los uploads con multer deberían controlar tamaños por ruta.
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 100000 }));

    // ⭐ CAMBIO 3: Remover estas líneas duplicadas
    // this.app.use(express.urlencoded({ extended: true }));
    // this.app.use(express.json());

    // Logger
    this.app.use(
      loggerMiddleware({
        winstonInstance: logger,
        expressFormat: true,
        colorize: true,
        meta: false,
      })
    );

    // this.app.use(
    //   middleware({
    //    apiSpec: config.DIR_SWAGGER || '',
    //  validateResponses: false,
    //  validateRequests: true,

    // validateSecurity: config.NODE_ENV === 'production',
    //   ignorePaths: /\/.*\/?/,
    // })
    // );

    // Inicialización de Passport
    this.app.use(passport.initialize());

    // Rate limiting middleware global
    this.app.use(globalLimiter);

    // Validar y definir rutas
    try {
      // Aplanar arrays (algunos módulos podrían exportar arrays de routers)
      const flattenedRoutes: any[] = ([] as any[]).concat(...this.routes.map((r: any) => (Array.isArray(r) ? r : [r])));

      // Validar y filtrar elementos aplanados
      const isMiddleware = (r: any) => (r && typeof r.use === 'function') || typeof r === 'function';
      const validRoutes = flattenedRoutes.filter(isMiddleware);
      const invalidRoutes = flattenedRoutes.filter((r: any) => !isMiddleware(r));

      if (invalidRoutes.length > 0) {
        logger.warn(`⚠️ ${invalidRoutes.length} invalid route(s) skipped`);
      }

      if (validRoutes.length === 0) {
        logger.error('❌ No valid routes to register');
        throw new TypeError('No valid routes to register');
      }

      logger.info(`✅ Registered ${validRoutes.length} route(s)`);
      this.app.use(config.BASE_URL, ...validRoutes);
    } catch (err: unknown) {
      logger.error('❌ Error while registering routes:');
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(`   Message: ${errMessage}`);
      throw err;
    }

    // Middleware de logging de errores
    this.app.use(
      errorLogger({
        winstonInstance: logger,
      })
    );

    // Custom error handlers
      this.setErrorHandlers(this.app);
    } catch (error: any) {
      logger.error('❌ Error in setServerConfig:');
      logger.error(`   Message: ${error?.message || 'Unknown error'}`);
      logger.error(`   Stack: ${error?.stack || 'No stack trace'}`);
      throw error;
    }
  }

  setListeners(): void {
    process.on('uncaughtException', (error: Error, origin: string) => {
      logger.error(`Caught exception:\n${util.format(error)}`);
      logger.error(`Origin: ${origin}`);

      // ⭐ CAMBIO 5: No cerrar servidor por errores de upload
      if (error.message.includes('Unexpected end of form') || error.message.includes('maxFileSize exceeded')) {
        logger.warn('Upload error detected, server continues running');
        return;
      }

      this.stop(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.warn(`Unhandled Rejection at:\n${util.format(promise)}`);
    });

    process.on('SIGINT', () => {
      logger.info(`SIGINT signal received`);
      this.stop(0);
    });

    process.on('SIGTERM', () => {
      logger.info(`SIGTERM signal received`);
      this.stop(0);
    });

    process.on('exit', (code) => {
      logger.info(`Exiting with code ${code}`);
    });
  }
}
