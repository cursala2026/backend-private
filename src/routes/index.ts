import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
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
      // Usar path.resolve para asegurar una ruta absoluta correcta
      const filePath = path.resolve(routesDir, file);

      // En Windows import dinámico necesita un file:// URL
      const fileUrl = pathToFileURL(filePath).href;
      
      let module: any;
      try {
        // Prefer CommonJS require when running the compiled `dist` (avoids passing file:// URLs to require)
        // Fallback to dynamic import when require isn't available (e.g. ESM runtimes).
        // @ts-ignore
        if (typeof require === 'function') {
          // @ts-ignore
          module = require(filePath);
        } else {
          module = await import(fileUrl);
        }
      } catch (importError: any) {
        logger.error(`❌ Import failed for ${file}: ${importError?.message}`);
        throw importError;
      }

      const isRouterLike = (x: any) => {
        if (!x) return false;
        if (typeof x === 'function') return true;
        if (typeof x.use === 'function' && typeof x.route === 'function') return true;
        if (Array.isArray(x) && x.length > 0 && x.every((v) => typeof v === 'function')) return true;
        return false;
      };

      // Manejar tanto ESM como CommonJS
      let router: any = module.default;
      
      // Si module.default es un objeto con una propiedad default (CommonJS wrapping)
      if (router && typeof router === 'object' && router.default && !isRouterLike(router)) {
        router = router.default;
      }

      // Si no es router, buscar en otras exportaciones del módulo
      if (!isRouterLike(router)) {
        const candidates = Object.values(module || {});
        const found = candidates.find((v) => isRouterLike(v));
        if (found) {
          router = found;
        } else {
          logger.error(`❌ Skipping route file ${file}: no valid router export found`);
          continue;
        }
      }
      
      // Extraer el nombre del archivo sin extensión y sin sufijo .route
      let prefix = file.replace(/\.(ts|js)$/, '').replace(/.route$/, '').replace(/^a-/, '');
      
      // Registrar directamente con el prefijo apropiado
      if (prefix !== 'auth' && prefix !== 'role' && prefix !== 'category' && prefix !== 'files') {
        const wrappedRouter = Router();
        wrappedRouter.use(`/${prefix}`, router);
        routers.push(wrappedRouter);

        // Exponer alias amigable para frontend: cuando el archivo es `bankAccount.route.ts`
        // también montar el mismo router bajo `/bank-accounts` para mantener compatibilidad
        // con llamadas que usan `/bank-accounts/...`.
        // Y para `supportTicket.route.ts` a `/support-tickets`.
        if (prefix === 'bankAccount') {
          const altRouter = Router();
          altRouter.use('/bank-accounts', router);
          routers.push(altRouter);
        } else if (prefix === 'supportTicket') {
          const altRouter = Router();
          altRouter.use('/support-tickets', router);
          routers.push(altRouter);
        }
      } else {
        routers.push(router);
      }
    } catch (error: any) {
      logger.error(`❌ Error loading route file ${file}:`);
      logger.error(`   Message: ${error?.message || 'Unknown error'}`);
      logger.error(`   Stack: ${error?.stack || 'No stack trace'}`);
      throw error;
    }
  }

  return routers;
}
