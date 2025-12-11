import mongoose from 'mongoose';

declare module 'mongoose' {
  // Añadir una firma opcional para `paginate` y `aggregate` que usaremos en repositorios.
  interface Model<T> {
    paginate?: (query?: mongoose.QueryFilter<T> | Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
    aggregate: (...pipeline: unknown[]) => Promise<unknown[]>;
  }
}
