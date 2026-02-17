import './dns-fix';
import Server from './express';
import setErrorHandlers from './config/errors/error-handler';
import config from './config';
import registerRoutes from './routes';
import { authService } from './services';

// initial server

// Capturar errores no manejados
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  if (reason?.stack) {
    console.error('   Stack:', reason.stack);
  }
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:');
  console.error('   Message:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
});

(async () => {
  try {
    const routes = await registerRoutes();
    const server = new Server(config.PORT, routes, setErrorHandlers);
    server.start();
  } catch (error: any) {
    console.error('❌ Error starting server:');
    console.error('   Message:', error?.message || 'Unknown error');
    console.error('   Stack:', error?.stack || 'No stack trace');
    console.error('   Name:', error?.name || 'Unknown');
    console.error('   Code:', error?.code || 'N/A');
    console.error('   Full error:', error);
    if (error?.cause) {
      console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
})();
