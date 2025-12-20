import { connect, connection, Types } from 'mongoose';
import config from '@/config';

/**
 * Script de debug para verificar y actualizar roles de un usuario específico
 */

const USER_ID_STRING = '68908afb1df054c4cae3b1ad'; // rubilar85@hotmail.com
const USER_ID = new Types.ObjectId(USER_ID_STRING);

async function debugUserRole() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');

    // Buscar por email para asegurarnos de tener el usuario correcto
    console.log('📖 Buscando usuario por email...');
    const userByEmail = await usersCollection.findOne({ email: 'rubilar85@hotmail.com' });
    console.log('Usuario encontrado por email:', userByEmail?._id?.toString());
    console.log('Roles del usuario por email:', userByEmail?.roles);

    // 1. Leer el usuario actual
    console.log('\n📖 Leyendo usuario por ID específico...');
    const userBefore = await usersCollection.findOne({ _id: USER_ID } as any);

    console.log('\n📋 Estado ANTES de actualizar:');
    console.log('Email:', userBefore?.email);
    console.log('Roles:', JSON.stringify(userBefore?.roles));
    console.log('Tipo de roles:', Array.isArray(userBefore?.roles) ? 'Array' : typeof userBefore?.roles);
    if (Array.isArray(userBefore?.roles)) {
      console.log('Elementos del array:');
      userBefore?.roles.forEach((role: any, index: number) => {
        console.log(`  [${index}]:`, typeof role, JSON.stringify(role));
      });
    }

    // 2. Intentar actualizar a PROFESOR
    console.log('\n🔄 Intentando actualizar a PROFESOR...');
    const updateResult = await usersCollection.updateOne(
      { _id: USER_ID } as any,
      { $set: { roles: ['PROFESOR'] } }
    );

    console.log('Resultado de actualización:', updateResult);
    console.log('Matched:', updateResult.matchedCount);
    console.log('Modified:', updateResult.modifiedCount);

    // 3. Leer el usuario después de actualizar
    console.log('\n📖 Leyendo usuario después de actualizar...');
    const userAfter = await usersCollection.findOne({ _id: USER_ID } as any);

    console.log('\n📋 Estado DESPUÉS de actualizar:');
    console.log('Email:', userAfter?.email);
    console.log('Roles:', JSON.stringify(userAfter?.roles));
    console.log('Tipo de roles:', Array.isArray(userAfter?.roles) ? 'Array' : typeof userAfter?.roles);
    if (Array.isArray(userAfter?.roles)) {
      console.log('Elementos del array:');
      userAfter?.roles.forEach((role: any, index: number) => {
        console.log(`  [${index}]:`, typeof role, JSON.stringify(role));
      });
    }

    // 4. Verificar si cambió
    const rolesChanged = JSON.stringify(userBefore?.roles) !== JSON.stringify(userAfter?.roles);
    console.log('\n' + '='.repeat(60));
    if (rolesChanged) {
      console.log('✅ LOS ROLES CAMBIARON EXITOSAMENTE');
    } else {
      console.log('❌ LOS ROLES NO CAMBIARON - PROBLEMA DETECTADO');
      console.log('Esto indica que hay un problema con la persistencia en MongoDB');
    }
    console.log('='.repeat(60));

    await connection.close();
    console.log('\n🔌 Conexión cerrada');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

debugUserRole()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
