import { connect, connection } from 'mongoose';
import config from '@/config';

async function checkUser() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');
    
    // Buscar usuario por username o email
    const username = 'sebas';
    const user = await usersCollection.findOne({
      $or: [
        { username: username },
        { email: username }
      ]
    });

    if (user) {
      console.log('✅ Usuario encontrado:');
      console.log(`   - ID: ${user._id}`);
      console.log(`   - Username: ${user.username}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Nombre: ${user.firstName} ${user.lastName}`);
      console.log(`   - Roles: ${JSON.stringify(user.roles)}`);
      console.log(`   - Status: ${user.status}`);
      console.log(`   - Password hash: ${user.password.substring(0, 20)}...`);
    } else {
      console.log('❌ Usuario no encontrado');
      console.log('\n📋 Usuarios disponibles:');
      const allUsers = await usersCollection.find({}, { 
        projection: { username: 1, email: 1, firstName: 1, lastName: 1 } 
      }).limit(10).toArray();
      
      allUsers.forEach((u: any) => {
        console.log(`   - ${u.username} (${u.email}) - ${u.firstName} ${u.lastName}`);
      });
    }

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
