import type { IUser } from '../models/user.model';

declare global {
  namespace Express {
    // Hacemos que User sea exactamente IUser
    type User = IUser;
  }
}

declare module 'passport-jwt' {
  interface Strategy {
    authenticate(req: unknown, options?: unknown): void;
  }
}