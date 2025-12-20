import { connect, connection } from 'mongoose';
import config from '@/config';

async function checkProfesor() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');
    
    // Buscar usuario profesor por diferentes criterios
    const users = await usersCollection.find({
      $or: [
        { username: /profesor/i },
        { email: /profesor/i },
        { roles: { $in: ['PROFESOR', 'profesor'] } }
      ]
    }).toArray();

    if (users.length > 0) {
      console.log(`✅ Se encontraron ${users.length} usuario(s) relacionado(s) con PROFESOR:\n`);
      
      users.forEach((user: any) => {
        console.log('─────────────────────────────────────');
        console.log(`   - ID: ${user._id}`);
        console.log(`   - Username: ${user.username}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Nombre: ${user.firstName} ${user.lastName}`);
        console.log(`   - Roles: ${JSON.stringify(user.roles)}`);
        console.log(`   - Status: ${user.status}`);
        console.log(`   - Password hash: ${user.password.substring(0, 30)}...`);
        console.log(`   - Password es hash bcrypt: ${/^\$2[aby]\$\d+\$/.test(user.password) ? '✅ SÍ' : '❌ NO'}`);
        console.log('');
      });
    } else {
      console.log('❌ No se encontraron usuarios con rol PROFESOR o username/email "profesor"');
      
      console.log('\n📋 Listando los primeros 10 usuarios:');
      const allUsers = await usersCollection.find({}, { 
        projection: { username: 1, email: 1, firstName: 1, lastName: 1, roles: 1 } 
      }).limit(10).toArray();
      
      allUsers.forEach((u: any) => {
        console.log(`   - ${u.username} (${u.email}) - Roles: ${JSON.stringify(u.roles)}`);
      });
    }

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProfesor();
