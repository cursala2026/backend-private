import { connect, connection } from 'mongoose';
import config from '@/config';

/**
 * Script para forzar la conversión de TODOS los roles ObjectId (strings hex) a códigos
 */

const ROLE_MAPPINGS: { [key: string]: string } = {
  '768b59e49b3298289bdbd0fd': 'ADMIN',
  '684c301330606ffb87ba8cbc': 'ALUMNO',
  '68557b2e2ae1c8fe8d398054': 'PROFESOR',
};

async function fixAllRoles() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    // Obtener colección de roles para mapeo dinámico
    const rolesCollection = db.collection('roles');
    const rolesFromDB = await rolesCollection.find({}).toArray();
    
    console.log('📋 Mapeo de roles:');
    rolesFromDB.forEach((role: any) => {
      const id = role._id.toString();
      ROLE_MAPPINGS[id] = role.code;
      console.log(`  ${id} → ${role.code}`);
    });
    console.log('');

    const usersCollection = db.collection('users');
    
    // Buscar TODOS los usuarios sin filtro
    const allUsers = await usersCollection.find({}).toArray();
    
    console.log(`👥 Total usuarios en BD: ${allUsers.length}\n`);
    
    let fixed = 0;
    let alreadyOk = 0;
    let errors = 0;

    for (const user of allUsers) {
      try {
        let needsFix = false;
        let newRoles: string[] = [];

        // Verificar si tiene roles
        if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
          // Sin roles, asignar ALUMNO por defecto
          newRoles = ['ALUMNO'];
          needsFix = true;
          console.log(`➕ ${user.email}: Sin roles → ALUMNO`);
        } else {
          const firstRole = user.roles[0];
          
          // Caso 1: ObjectId formato objeto { $oid: "..." }
          if (typeof firstRole === 'object' && firstRole.$oid) {
            const roleId = firstRole.$oid;
            newRoles = [ROLE_MAPPINGS[roleId] || 'ALUMNO'];
            needsFix = true;
            console.log(`🔄 ${user.email}: ObjectId objeto ${roleId} → ${newRoles[0]}`);
          }
          // Caso 2: String de 24 caracteres hex (ObjectId como string)
          else if (typeof firstRole === 'string' && /^[0-9a-fA-F]{24}$/.test(firstRole)) {
            newRoles = [ROLE_MAPPINGS[firstRole] || 'ALUMNO'];
            needsFix = true;
            console.log(`🔄 ${user.email}: ObjectId string ${firstRole} → ${newRoles[0]}`);
          }
          // Caso 3: Ya es un código válido
          else if (typeof firstRole === 'string') {
            const validRoles = ['ADMIN', 'PROFESOR', 'ALUMNO'];
            const upperRole = firstRole.toUpperCase();
            
            if (validRoles.includes(upperRole)) {
              newRoles = [upperRole];
              if (firstRole !== upperRole) {
                needsFix = true;
                console.log(`✨ ${user.email}: ${firstRole} → ${upperRole} (normalizado)`);
              } else {
                alreadyOk++;
                console.log(`✅ ${user.email}: Ya correcto (${firstRole})`);
              }
            } else {
              // Rol inválido, asignar ALUMNO
              newRoles = ['ALUMNO'];
              needsFix = true;
              console.log(`⚠️  ${user.email}: Rol inválido "${firstRole}" → ALUMNO`);
            }
          } else {
            // Tipo desconocido, asignar ALUMNO
            newRoles = ['ALUMNO'];
            needsFix = true;
            console.log(`⚠️  ${user.email}: Tipo desconocido → ALUMNO`);
          }
        }

        // Aplicar corrección si es necesario
        if (needsFix) {
          const updateDoc: any = {
            $set: { roles: newRoles }
          };

          // Eliminar campos obsoletos si existen
          const unsetFields: any = {};
          if ('isAdmin' in user) unsetFields.isAdmin = '';
          if ('isSuperAdmin' in user) unsetFields.isSuperAdmin = '';
          if ('features' in user) unsetFields.features = '';

          if (Object.keys(unsetFields).length > 0) {
            updateDoc.$unset = unsetFields;
          }

          await usersCollection.updateOne(
            { _id: user._id },
            updateDoc
          );

          fixed++;
        }

      } catch (err) {
        console.error(`❌ Error procesando ${user.email}:`, err);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL:');
    console.log(`  ✅ Usuarios corregidos: ${fixed}`);
    console.log(`  ✓  Ya estaban correctos: ${alreadyOk}`);
    console.log(`  ❌ Errores: ${errors}`);
    console.log(`  📝 Total procesados: ${allUsers.length}`);
    console.log('='.repeat(60));

    await connection.close();
    console.log('\n🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

fixAllRoles()
  .then(() => {
    console.log('\n✨ ¡Corrección completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
