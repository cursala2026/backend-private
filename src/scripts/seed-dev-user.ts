/**
 * Script para crear un usuario administrador local en entorno de desarrollo.
 * Uso: npm run seed:dev-user
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { UserRoles, UserStatus } from '../models/enums/user.enum';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_USERS = [
  {
    firstName: 'Admin',
    lastName: 'Dev',
    username: 'admin.dev',
    email: 'admin@dev.local',
    password: 'Admin1234!',
    roles: [UserRoles.ADMIN],
    status: UserStatus.ACTIVE,
  },
  {
    firstName: 'Profesor',
    lastName: 'Dev',
    username: 'profesor.dev',
    email: 'profesor@dev.local',
    password: 'Profesor1234!',
    roles: [UserRoles.PROFESOR],
    status: UserStatus.ACTIVE,
  },
  {
    firstName: 'Alumno',
    lastName: 'Dev',
    username: 'alumno.dev',
    email: 'alumno@dev.local',
    password: 'Alumno1234!',
    roles: [UserRoles.ALUMNO],
    status: UserStatus.ACTIVE,
  },
];

async function seedDevUsers() {
  const mongoUri = process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error('DATABASE_URL no está definida en el archivo .env');
  }

  console.log('⏳ Conectando a MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Conectado a', mongoUri, '\n');

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`⏭️  Ya existe: ${userData.email}`);
      continue;
    }

    const hashed = await bcrypt.hash(userData.password, 10);
    await User.create({ ...userData, password: hashed });
    console.log(`✅ Creado: ${userData.email}  |  password: ${userData.password}  |  rol: ${userData.roles.join(', ')}`);
  }

  console.log('\n🎉 Listo. Podés iniciar sesión con los usuarios de arriba.');
  await mongoose.disconnect();
}

seedDevUsers().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
