import { connect, connection } from 'mongoose';
import config from '@/config';

/**
 * Script de migración para convertir roles de ObjectId a strings
 * y asignar roles por defecto a usuarios sin rol
 */

interface OldRole {
  _id: string;
  code: string;
}

const ROLE_MAPPINGS: { [key: string]: string } = {
  '768b59e49b3298289bdbd0fd': 'ADMIN',
};

async function migrateUserRoles() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await connect(config.DATABASE_URL);
    console.log('✅ Conectado a MongoDB\n');

    const db = connection.db;
    if (!db) throw new Error('No se pudo obtener la base de datos');

    // 1. Obtener mapeo de roles desde la colección roles (si existe)
    const rolesCollection = db.collection('roles');
    const rolesFromDB = await rolesCollection.find({}).toArray();
    
    console.log('📋 Roles encontrados en la base de datos:');
    rolesFromDB.forEach((role: any) => {
      console.log(`  - ${role._id.toString()} → ${role.code}`);
      ROLE_MAPPINGS[role._id.toString()] = role.code;
    });
    console.log('');

    // 2. Obtener todos los usuarios
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();
    
    console.log(`👥 Total de usuarios a procesar: ${users.length}\n`);

    let updated = 0;
    let skipped = 0;
    let assigned = 0;

    for (const user of users) {
      const updates: any = {};
      let needsUpdate = false;
      let newRoles: string[] = [];

      // Convertir roles de ObjectId a strings
      if (Array.isArray(user.roles) && user.roles.length > 0) {
        const firstRole = user.roles[0];
        
        // Si es ObjectId, convertir
        if (typeof firstRole === 'object' && firstRole.$oid) {
          const roleId = firstRole.$oid;
          const roleCode = ROLE_MAPPINGS[roleId];
          
          if (roleCode) {
            newRoles = [roleCode];
            console.log(`🔄 ${user.email}: ${roleId} → ${roleCode}`);
          } else {
            // Si no encontramos el mapeo, usar isAdmin/isSuperAdmin
            if (user.isAdmin || user.isSuperAdmin) {
              newRoles = ['ADMIN'];
              console.log(`🔄 ${user.email}: ObjectId desconocido → ADMIN (por isAdmin)`);
            } else {
              newRoles = ['ALUMNO'];
              console.log(`⚠️  ${user.email}: ObjectId desconocido → ALUMNO (por defecto)`);
            }
          }
          
          updates.roles = newRoles;
          needsUpdate = true;
        } else if (typeof firstRole === 'string' && firstRole.match(/^[0-9a-fA-F]{24}$/)) {
          // Es un string pero parece ObjectId
          const roleCode = ROLE_MAPPINGS[firstRole];
          
          if (roleCode) {
            newRoles = [roleCode];
            console.log(`🔄 ${user.email}: ${firstRole} → ${roleCode}`);
          } else if (user.isAdmin || user.isSuperAdmin) {
            newRoles = ['ADMIN'];
            console.log(`🔄 ${user.email}: ObjectId string → ADMIN (por isAdmin)`);
          } else {
            newRoles = ['ALUMNO'];
            console.log(`⚠️  ${user.email}: ObjectId string → ALUMNO (por defecto)`);
          }
          
          updates.roles = newRoles;
          needsUpdate = true;
        } else if (typeof firstRole === 'string') {
          // Ya es un string, verificar que sea válido
          const validRoles = ['ADMIN', 'PROFESOR', 'ALUMNO'];
          const upperRole = firstRole.toUpperCase();
          
          if (validRoles.includes(upperRole)) {
            newRoles = [upperRole];
            if (firstRole !== upperRole) {
              updates.roles = newRoles;
              needsUpdate = true;
              console.log(`✨ ${user.email}: ${firstRole} → ${upperRole} (normalizado)`);
            } else {
              console.log(`✅ ${user.email}: Ya tiene rol válido (${firstRole})`);
            }
          } else {
            newRoles = ['ALUMNO'];
            updates.roles = newRoles;
            needsUpdate = true;
            console.log(`⚠️  ${user.email}: Rol inválido "${firstRole}" → ALUMNO`);
          }
        }
      } else {
        // No tiene roles, asignar según isAdmin o por defecto ALUMNO
        if (user.isAdmin || user.isSuperAdmin) {
          newRoles = ['ADMIN'];
          console.log(`➕ ${user.email}: Sin rol → ADMIN (por isAdmin)`);
        } else {
          newRoles = ['ALUMNO'];
          console.log(`➕ ${user.email}: Sin rol → ALUMNO (por defecto)`);
        }
        
        updates.roles = newRoles;
        needsUpdate = true;
        assigned++;
      }

      // Eliminar campos obsoletos
      const fieldsToUnset: any = {};
      if ('isAdmin' in user) {
        fieldsToUnset.isAdmin = '';
        needsUpdate = true;
      }
      if ('isSuperAdmin' in user) {
        fieldsToUnset.isSuperAdmin = '';
        needsUpdate = true;
      }
      if ('features' in user) {
        fieldsToUnset.features = '';
        needsUpdate = true;
      }

      // Aplicar actualizaciones
      if (needsUpdate) {
        const updateQuery: any = {};
        
        if (Object.keys(updates).length > 0) {
          updateQuery.$set = updates;
        }
        
        if (Object.keys(fieldsToUnset).length > 0) {
          updateQuery.$unset = fieldsToUnset;
        }

        await usersCollection.updateOne(
          { _id: user._id },
          updateQuery
        );
        
        updated++;
      } else {
        skipped++;
      }
    }

    console.log('\n📊 Resumen de migración:');
    console.log(`  ✅ Usuarios actualizados: ${updated}`);
    console.log(`  ➕ Roles asignados automáticamente: ${assigned}`);
    console.log(`  ⏭️  Usuarios sin cambios: ${skipped}`);
    console.log(`  📝 Total procesados: ${users.length}`);

    console.log('\n✨ Migración completada exitosamente');
    
    await connection.close();
    console.log('🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateUserRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
