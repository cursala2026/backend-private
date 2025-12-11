import mongoose from 'mongoose';
import { logger } from '../../../utils';

class SecurityConnection {
  private readonly connection: mongoose.Connection;

  constructor(uri: string, options?: mongoose.ConnectOptions) {
    this.connection = mongoose.createConnection(uri, options);
    this.addListeners();
  }

  getConnection(): mongoose.Connection {
    return this.connection;
  }

  async closeConnection(): Promise<void> {
    try {
      await this.connection.close();
      logger.info('Database connection closed successfully.');
    } catch (err) {
      logger.error(`Error closing the database connection: ${err}`);
      throw err;
    }
  }

  private addListeners() {
    this.connection.on('error', (error: string) => {
      logger.error(`⚠️  Database connection error: ${error}`);
      throw error;
    });

    this.connection.on('disconnected', () => {
      logger.info('⚠️  Database disconnected');
    });

    this.connection.on('connected', () => {
      logger.info(`⚡ Database connected successfully`);
    });
  }
}

export default SecurityConnection;
