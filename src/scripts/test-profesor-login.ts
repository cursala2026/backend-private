import { connect, connection } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '@/config';

async function testLogin() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');
    
    // Buscar usuario profesor
    const user = await usersCollection.findOne({
      $or: [
        { username: 'profesor' },
        { email: 'profesor' }
      ]
    });

    if (!user) {
      console.log('❌ Usuario "profesor" no encontrado');
      process.exit(1);
    }

    console.log('✅ Usuario encontrado:');
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Roles: ${JSON.stringify(user.roles)}`);
    console.log(`   - Password hash: ${user.password.substring(0, 40)}...\n`);

    // Probar diferentes contraseñas
    const passwordsToTest = ['profesor', 'Profesor', 'profesor123', '123456', 'password'];
    
    console.log('🔑 Probando contraseñas...\n');
    
    for (const pwd of passwordsToTest) {
      const isMatch = await bcrypt.compare(pwd, user.password);
      const status = isMatch ? '✅ CORRECTA' : '❌ Incorrecta';
      console.log(`   "${pwd}" - ${status}`);
      
      if (isMatch) {
        console.log(`\n🎉 ¡Contraseña encontrada! La contraseña correcta es: "${pwd}"`);
        break;
      }
    }

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testLogin();
