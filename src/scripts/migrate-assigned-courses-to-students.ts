/**
 * Script de migración: assignedCourses → students
 *
 * Este script migra todos los datos de assignedCourses (en el modelo de Usuario)
 * al array students extendido (en el modelo de Curso).
 *
 * IMPORTANTE: Ejecutar este script solo UNA VEZ y en un entorno de prueba primero.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/user.model';
import { Course } from '../models/mongo/course.model';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface MigrationStats {
  totalUsers: number;
  totalAssignedCourses: number;
  successfulMigrations: number;
  failedMigrations: number;
  errors: Array<{ userId: string; courseId: string; error: string }>;
}

async function migrateAssignedCoursesToStudents() {
  const stats: MigrationStats = {
    totalUsers: 0,
    totalAssignedCourses: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    errors: [],
  };

  try {
    // Conectar a MongoDB
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los usuarios con assignedCourses
    console.log('📊 Buscando usuarios con assignedCourses...');
    const usersWithAssignedCourses = await User.find({
      assignedCourses: { $exists: true, $ne: [] },
    });

    stats.totalUsers = usersWithAssignedCourses.length;
    console.log(`✅ Encontrados ${stats.totalUsers} usuarios con cursos asignados\n`);

    if (stats.totalUsers === 0) {
      console.log('ℹ️  No hay usuarios con assignedCourses para migrar.');
      return stats;
    }

    // Procesar cada usuario
    for (const user of usersWithAssignedCourses) {
      if (!user.assignedCourses || user.assignedCourses.length === 0) {
        continue;
      }

      console.log(`\n👤 Procesando usuario: ${user.email} (${user._id})`);
      console.log(`   Cursos asignados: ${user.assignedCourses.length}`);

      // Procesar cada curso asignado
      for (const assignedCourse of user.assignedCourses) {
        stats.totalAssignedCourses++;

        try {
          const courseId = assignedCourse.courseId.toString();
          const userId = user._id.toString();

          console.log(`   📚 Migrando curso: ${courseId}`);

          // Buscar el curso
          const course = await Course.findById(courseId);
          if (!course) {
            console.log(`   ⚠️  Curso no encontrado: ${courseId}`);
            stats.errors.push({
              userId: userId,
              courseId: courseId,
              error: 'Course not found',
            });
            stats.failedMigrations++;
            continue;
          }

          // Verificar si el estudiante ya está en el array students
          const existingStudent = course.students?.find(
            (s: any) => s.userId?.toString() === userId || s.toString() === userId
          );

          if (existingStudent) {
            console.log(`   ℹ️  El estudiante ya está en el curso, actualizando...`);

            // Actualizar el estudiante existente si es necesario
            await Course.updateOne(
              { _id: courseId, 'students.userId': userId },
              {
                $set: {
                  'students.$.enrollmentType': 'MANUAL',
                  'students.$.startDate': assignedCourse.startDate,
                  'students.$.endDate': assignedCourse.endDate,
                },
              }
            );
          } else {
            console.log(`   ➕ Agregando estudiante al curso...`);

            // Agregar el estudiante al array students con el nuevo formato
            await Course.updateOne(
              { _id: courseId },
              {
                $push: {
                  students: {
                    userId: new mongoose.Types.ObjectId(userId),
                    enrolledAt: new Date(),
                    enrollmentType: 'MANUAL',
                    startDate: assignedCourse.startDate,
                    endDate: assignedCourse.endDate,
                  },
                },
              }
            );
          }

          console.log(`   ✅ Migración exitosa`);
          stats.successfulMigrations++;
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message}`);
          stats.errors.push({
            userId: user._id.toString(),
            courseId: assignedCourse.courseId.toString(),
            error: error.message,
          });
          stats.failedMigrations++;
        }
      }
    }

    console.log('\n📊 Resumen de la migración:');
    console.log(`   Total de usuarios procesados: ${stats.totalUsers}`);
    console.log(`   Total de cursos asignados: ${stats.totalAssignedCourses}`);
    console.log(`   Migraciones exitosas: ${stats.successfulMigrations}`);
    console.log(`   Migraciones fallidas: ${stats.failedMigrations}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      stats.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Usuario: ${err.userId}, Curso: ${err.courseId}`);
        console.log(`      Error: ${err.error}`);
      });
    }

    return stats;
  } catch (error: any) {
    console.error('\n❌ Error fatal durante la migración:', error.message);
    throw error;
  } finally {
    // Cerrar conexión
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar el script
if (require.main === module) {
  console.log('🚀 Iniciando migración de assignedCourses a students...\n');

  migrateAssignedCoursesToStudents()
    .then((stats) => {
      console.log('\n✅ Migración completada exitosamente!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ La migración falló:', error);
      process.exit(1);
    });
}

export { migrateAssignedCoursesToStudents };
