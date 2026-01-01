/**
 * Script de migración: Formato viejo de students → Formato nuevo
 *
 * Este script convierte todos los estudiantes que están en formato viejo (solo ObjectId)
 * al formato nuevo (objeto con userId, enrolledAt, enrollmentType, etc.)
 *
 * IMPORTANTE: Ejecutar después de migrate-assigned-courses-to-students.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface MigrationStats {
  totalCourses: number;
  coursesWithOldFormat: number;
  totalStudentsMigrated: number;
  coursesUpdated: number;
  errors: Array<{ courseId: string; error: string }>;
}

async function migrateOldStudentsFormat() {
  const stats: MigrationStats = {
    totalCourses: 0,
    coursesWithOldFormat: 0,
    totalStudentsMigrated: 0,
    coursesUpdated: 0,
    errors: [],
  };

  try {
    // Conectar a MongoDB
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los cursos
    console.log('📊 Buscando cursos con estudiantes...');
    const courses = await Course.find({ students: { $exists: true, $ne: [] } });

    stats.totalCourses = courses.length;
    console.log(`✅ Encontrados ${stats.totalCourses} cursos con estudiantes\n`);

    if (stats.totalCourses === 0) {
      console.log('ℹ️  No hay cursos con estudiantes para migrar.');
      return stats;
    }

    // Procesar cada curso
    for (const course of courses) {
      if (!course.students || course.students.length === 0) {
        continue;
      }

      console.log(`\n📚 Procesando curso: ${course.name} (${course._id})`);
      console.log(`   Total de estudiantes: ${course.students.length}`);

      // Verificar si tiene estudiantes en formato viejo
      let hasOldFormat = false;
      const newStudentsArray: any[] = [];

      for (const student of course.students) {
        // Si student es un ObjectId simple (formato viejo)
        if (typeof student === 'string' || mongoose.Types.ObjectId.isValid(student)) {
          // Verificar si NO tiene la propiedad userId (formato viejo)
          const studentObj = student as any;
          if (!studentObj.userId && !studentObj.enrolledAt) {
            hasOldFormat = true;
            stats.totalStudentsMigrated++;

            console.log(`   ⚙️  Migrando estudiante en formato viejo: ${student}`);

            // Convertir al formato nuevo
            newStudentsArray.push({
              userId: new mongoose.Types.ObjectId(student.toString()),
              enrolledAt: new Date(),
              enrollmentType: 'SELF', // Asumimos que fue auto-inscripción
            });
          } else {
            // Ya está en formato nuevo
            newStudentsArray.push(student);
          }
        } else {
          // Ya es un objeto (formato nuevo)
          newStudentsArray.push(student);
        }
      }

      if (hasOldFormat) {
        stats.coursesWithOldFormat++;

        try {
          // Actualizar el curso con el nuevo formato
          await Course.updateOne(
            { _id: course._id },
            { $set: { students: newStudentsArray } }
          );

          console.log(`   ✅ Curso actualizado exitosamente`);
          stats.coursesUpdated++;
        } catch (error: any) {
          console.log(`   ❌ Error actualizando curso: ${error.message}`);
          stats.errors.push({
            courseId: course._id.toString(),
            error: error.message,
          });
        }
      } else {
        console.log(`   ✓ Curso ya tiene formato correcto`);
      }
    }

    console.log('\n📊 Resumen de la migración:');
    console.log(`   Total de cursos procesados: ${stats.totalCourses}`);
    console.log(`   Cursos con formato viejo: ${stats.coursesWithOldFormat}`);
    console.log(`   Total de estudiantes migrados: ${stats.totalStudentsMigrated}`);
    console.log(`   Cursos actualizados: ${stats.coursesUpdated}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      stats.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Curso: ${err.courseId}`);
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
  console.log('🚀 Iniciando migración de students formato viejo → nuevo...\n');

  migrateOldStudentsFormat()
    .then((stats) => {
      console.log('\n✅ Migración completada exitosamente!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ La migración falló:', error);
      process.exit(1);
    });
}

export { migrateOldStudentsFormat };
