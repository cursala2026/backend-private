import bcrypt from 'bcryptjs';
import { connect, connection } from 'mongoose';
import config from '@/config';

/**
 * Script para hashear contraseñas de usuarios que fueron creadas en texto plano.
 * Detecta si una contraseña NO está hasheada y la hashea.
 */
async function fixUserPasswords() {
  try {
    console.log('🔧 Iniciando script de corrección de contraseñas...');
    
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');
    
    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');
    
    const usersCollection = db.collection('users');
    
    // Obtener todos los usuarios
    const users = await usersCollection.find({}).toArray();
    console.log(`📊 Total de usuarios encontrados: ${users.length}`);
    
    let fixed = 0;
    let alreadyHashed = 0;
    
    for (const user of users) {
      if (!user.password) {
        console.log(`⚠️  Usuario ${user.email} no tiene contraseña`);
        continue;
      }
      
      // Los hashes de bcrypt siempre empiezan con $2a$, $2b$ o $2y$
      const isBcryptHash = /^\$2[aby]\$\d+\$/.test(user.password);
      
      if (!isBcryptHash) {
        // La contraseña no está hasheada, hashearla
        console.log(`🔒 Hasheando contraseña para usuario: ${user.email}`);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(user.password, saltRounds);
        
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword } }
        );
        
        fixed++;
        console.log(`✅ Contraseña actualizada para: ${user.email}`);
      } else {
        alreadyHashed++;
      }
    }
    
    console.log('\n📈 Resumen:');
    console.log(`   - Contraseñas ya hasheadas: ${alreadyHashed}`);
    console.log(`   - Contraseñas corregidas: ${fixed}`);
    console.log('\n✅ Script completado exitosamente');
    
    await connection.close();
    console.log('🔌 Conexión cerrada');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando el script:', error);
    process.exit(1);
  }
}

// Ejecutar el script
fixUserPasswords();
