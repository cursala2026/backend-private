import { connect, connection } from 'mongoose';
import config from '@/config';

async function setAdminRoles() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');
    
    const adminEmails = [
      'luchovarelator@gmail.com',
      'sebastianechazu@gmail.com'
    ];

    for (const email of adminEmails) {
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: { roles: ['ADMIN'] } }
      );

      if (result.matchedCount > 0) {
        console.log(`✅ ${email} → ADMIN`);
      } else {
        console.log(`❌ ${email} → No encontrado`);
      }
    }

    console.log('\n✨ Roles de ADMIN asignados correctamente');
    
    await connection.close();
    console.log('🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setAdminRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
