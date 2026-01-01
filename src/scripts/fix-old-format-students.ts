/**
 * Script para corregir estudiantes en formato antiguo (solo ObjectId)
 * y convertirlos al nuevo formato con metadata
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function fixOldFormatStudents() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    console.log('🔍 Buscando cursos con estudiantes en formato antiguo...\n');

    // Obtener todos los cursos con estudiantes
    const courses = await Course.find({ students: { $exists: true, $ne: [] } }).lean();

    let fixedCourses = 0;
    let totalStudentsFixed = 0;

    for (const course of courses) {
      const courseData = course as any;
      const students = courseData.students || [];

      if (students.length === 0) continue;

      console.log(`📚 Procesando: ${courseData.name}`);

      let needsFix = false;
      const fixedStudents: any[] = [];

      for (const student of students) {
        // Verificar si es un ObjectId directo (formato antiguo)
        if (typeof student === 'string' || mongoose.Types.ObjectId.isValid(student)) {
          // Si student es un string o un ObjectId directo, es formato antiguo
          if (!student.userId) {
            needsFix = true;
            const userId = new mongoose.Types.ObjectId(student);

            console.log(`   ✓ Convirtiendo estudiante ${userId} a nuevo formato`);

            fixedStudents.push({
              userId: userId,
              enrolledAt: new Date(),
              enrollmentType: 'MANUAL', // Asumimos MANUAL porque no sabemos el origen
            });
            totalStudentsFixed++;
          } else {
            // Ya está en formato correcto
            fixedStudents.push(student);
          }
        } else if (student.userId) {
          // Ya está en formato correcto (tiene userId)
          fixedStudents.push(student);
        } else {
          console.log(`   ⚠️  Formato desconocido:`, student);
          // Intentar extraer el ID de todas formas
          fixedStudents.push(student);
        }
      }

      if (needsFix) {
        await Course.updateOne(
          { _id: courseData._id },
          { $set: { students: fixedStudents } }
        );
        console.log(`   ✅ Curso actualizado con ${fixedStudents.length} estudiantes\n`);
        fixedCourses++;
      } else {
        console.log(`   ℹ️  Ya está en formato correcto\n`);
      }
    }

    console.log(`\n📊 RESUMEN:`);
    console.log(`   Cursos corregidos: ${fixedCourses}`);
    console.log(`   Estudiantes convertidos: ${totalStudentsFixed}`);

    // Verificar el curso de prueba específicamente
    console.log('\n\n🔍 VERIFICACIÓN FINAL - Curso de prueba:\n');
    const cursoPrueba = await Course.findOne({ name: /curso de prueba/i }).lean();

    if (cursoPrueba) {
      const students = (cursoPrueba as any).students || [];
      console.log(`Estudiantes en el curso: ${students.length}`);
      students.forEach((s: any, i: number) => {
        console.log(`${i + 1}.`, JSON.stringify(s, null, 2));
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

console.log('🚀 Iniciando corrección de estudiantes en formato antiguo...\n');

fixOldFormatStudents()
  .then(() => {
    console.log('\n✅ Corrección completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
