import mongoose, { Types, Connection, Schema } from 'mongoose';

export { Connection, Types } from 'mongoose';
export type Model<T> = import('mongoose').Model<T, unknown, unknown, unknown, unknown, unknown, unknown, unknown>;
export type ObjectId = Types.ObjectId;
export const { ObjectId } = Types;

// Helper alias to reference Mongoose document types from our project imports.
// Use `MongooseDocument<T>` in repositories to get a HydratedDocument<T> type
// while preserving a single source of mongoose types for the compiler.
export type MongooseDocument<T> = import('mongoose').HydratedDocument<T>;

// Minimal typed wrapper for models that may include pagination/aggregation helpers.
// We keep signatures wide to avoid tight coupling with plugin types while giving
// a typed surface to use instead of `any` in repositories.
export type AnyModel<T> = Model<T> & {
	paginate?: (query?: import('mongoose').QueryFilter<T> | Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
	aggregate: (...pipeline: unknown[]) => Promise<unknown[]>;
};

// Create a typed model instance using an optional connection (useful in tests).
export function createModel(
	connection: Connection | typeof mongoose = mongoose,
	name?: string,
	schema?: Schema<unknown>,
	collection?: string
): AnyModel<unknown> {
	if (!name || !schema) throw new Error('createModel requires a model name and schema');
	const maybeConn = connection as unknown;
	const conn = (maybeConn && typeof (maybeConn as { model?: unknown }).model === 'function') ? (connection as Connection) : mongoose;
	return conn.model(name as string, schema as Schema<unknown>, collection) as AnyModel<unknown>;
}
