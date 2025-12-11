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
    const module: RouteModule = await import(path.join(routesDir, file));
    const router = module.default;
    
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
  }

  return routers;
}
