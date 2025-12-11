import Server from './express';
import setErrorHandlers from './config/errors/error-handler';
import config from './config';
import registerRoutes from './routes';
import { authService } from './services';

// initial server

(async () => {
  const routes = await registerRoutes();
  const server = new Server(config.PORT, routes, setErrorHandlers);
  server.start();
})();
