import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const rootEnv = path.resolve(process.cwd(), '.env');
const distEnv = path.resolve(__dirname, '../../.env');

let envPath: string | undefined;
if (fs.existsSync(rootEnv)) {
  envPath = rootEnv;
} else if (fs.existsSync(distEnv)) {
  envPath = distEnv;
}

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

if (process.env.NODE_ENV === 'production' && fs.existsSync(rootEnv)) {
  // eslint-disable-next-line no-console
  console.warn('SECURITY WARNING: Detected a `.env` file in production environment. This may leak secrets. Remove .env and use environment/secret manager.');
}

// Set the NODE_ENV environment variable to 'development' if not already defined
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';

export default {
  NODE_ENV: process.env.NODE_ENV,
  PORT: Number(process.env.PORT ?? 8082),
  BASE_URL: '/api/v1',
  DIR_ERRORS: path.resolve(__dirname, '../../src/config/errors/error.yml'),
  DATABASE_URL: String(process.env.DATABASE_URL),
  JWT_SECRET: String(process.env.JWT_SECRET),

  // SMTP para envío de correos
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: Number(process.env.EMAIL_PORT),

  // Notificaciones y correos de contacto
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
  NO_REPLY_EMAIL: process.env.NO_REPLY_EMAIL,
  INFO_EMAIL: process.env.INFO_EMAIL,
  ADMINISTRATION_EMAIL: process.env.ADMINISTRATION_EMAIL,

  // Email
  FRONTEND_DOMAIN: process.env.FRONTEND_DOMAIN,
  RESET_PASSWORD_FRONTEND_PATH: process.env.RESET_PASSWORD_FRONTEND_PATH,
  EXPIRE_TIME_TOKEN_RESET_PASSWORD: process.env.EXPIRE_TIME_TOKEN_RESET_PASSWORD,
  EXPIRE_TIME_TOKEN_USER_LOGGED: process.env.EXPIRE_TIME_TOKEN_USER_LOGGED,

  // Security configuration
  ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || '768b59e49b3298289bdbd0fd',

  // Bunny CDN configuration
  BUNNY_STORAGE_API_KEY: process.env.BUNNY_STORAGE_API_KEY,
  BUNNY_STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
  BUNNY_STORAGE_REGION: process.env.BUNNY_STORAGE_REGION,
  BUNNY_STORAGE_CDN_HOSTNAME: process.env.BUNNY_STORAGE_CDN_HOSTNAME,
  
  // Bunny Stream configuration
  BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
  BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
};
