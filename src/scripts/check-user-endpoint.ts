import { connect, connection } from 'mongoose';
import config from '@/config';
import UserRepository from '@/repositories/user.repository';

/**
 * Script para verificar qué devuelve el repositorio de usuarios
 */

const USER_ID = '68908afb1df054c4cae3b1ad';

async function checkUserEndpoint() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    console.log('📖 Consultando repositorio de usuarios...\n');

    const userRepo = new UserRepository();

    // Obtener usuario por ID
    const user = await userRepo.getUserById(USER_ID);

    console.log('📋 Usuario devuelto por getUserById:');
    console.log('ID:', user?._id?.toString());
    console.log('Email:', user?.email);
    console.log('Roles:', JSON.stringify(user?.roles));
    console.log('Tipo de roles:', Array.isArray(user?.roles) ? 'Array' : typeof user?.roles);

    if (Array.isArray(user?.roles)) {
      console.log('Elementos del array:');
      user.roles.forEach((role: any, index: number) => {
        console.log(`  [${index}]:`, typeof role, JSON.stringify(role));
      });
    }

    // Obtener todos los usuarios
    console.log('\n📖 Consultando todos los usuarios...');
    const allUsers = await userRepo.getUsers({
      page: 1,
      page_size: 100
    });

    const targetUser = allUsers?.data?.find((u: any) => u.email === 'rubilar85@hotmail.com');
    console.log('\n📋 Usuario encontrado en getUsers:');
    console.log('Email:', targetUser?.email);
    console.log('Roles:', JSON.stringify(targetUser?.roles));

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserEndpoint();
