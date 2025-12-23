import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import { logger } from '../utils';

interface RouteModule {
  default: Router;
}

export default async function registerRoutes() {
  const routesDir = path.join(__dirname);
  const routeFiles = fs
    .readdirSync(routesDir)
    .filter((file) => (file.endsWith('.ts') || file.endsWith('.js')) && !file.includes('index'))
    .sort();

  const routers: Router[] = [];

  for (const file of routeFiles) {
    try {
      logger.info(`🔄 Loading route file: ${file}`);
      
      // Usar path.resolve para asegurar una ruta absoluta correcta
      const filePath = path.resolve(routesDir, file);
      
      const module: RouteModule = await import(filePath);
      const router = module.default;
      
      if (!router) {
        logger.error(`❌ Route file ${file} does not export a default router`);
        continue;
      }
      
      // Extraer el nombre del archivo sin extensión y sin sufijo .route
      let prefix = file.replace(/\.(ts|js)$/, '').replace(/.route$/, '').replace(/^a-/, '');
      
      // Crear un router wrapper que incluya el prefijo
      const wrappedRouter = Router();
      if (prefix !== 'auth' && prefix !== 'role' && prefix !== 'category' && prefix !== 'files') {
        wrappedRouter.use(`/${prefix}`, router);
      } else {
        wrappedRouter.use(router);
      }
      
      routers.push(wrappedRouter);
      logger.info(`📍 Registered route: /${prefix}`);
    } catch (error: any) {
      logger.error(`❌ Error loading route file ${file}:`);
      logger.error(`   Message: ${error?.message || 'Unknown error'}`);
      logger.error(`   Stack: ${error?.stack || 'No stack trace'}`);
      throw error;
    }
  }

  return routers;
}
