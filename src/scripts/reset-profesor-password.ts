import { connect, connection } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '@/config';

async function resetProfesorPassword() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    const usersCollection = db.collection('users');
    
    // Nueva contraseña
    const newPassword = 'profesor123';
    
    console.log(`🔑 Estableciendo nueva contraseña: "${newPassword}"\n`);
    
    // Hashear la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Actualizar el usuario profesor
    const result = await usersCollection.updateOne(
      { username: 'profesor' },
      { $set: { password: hashedPassword } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Contraseña actualizada exitosamente');
      console.log('\n📝 Credenciales de acceso:');
      console.log(`   - Usuario: profesor`);
      console.log(`   - Contraseña: ${newPassword}`);
      
      // Verificar que la contraseña se hasheó correctamente
      const updatedUser = await usersCollection.findOne({ username: 'profesor' });
      if (updatedUser) {
        const isValid = await bcrypt.compare(newPassword, updatedUser.password);
        console.log(`\n🔐 Verificación: ${isValid ? '✅ La contraseña es correcta' : '❌ Error en la verificación'}`);
      }
    } else {
      console.log('❌ No se pudo actualizar la contraseña (usuario no encontrado)');
    }

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetProfesorPassword();
