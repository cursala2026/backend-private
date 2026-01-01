/**
 * Script de diagnóstico: Verificar estudiantes de un curso
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkCourseStudents(courseId: string) {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    const course = await Course.findById(courseId);

    if (!course) {
      console.log('❌ Curso no encontrado');
      return;
    }

    console.log(`📚 Curso: ${course.name}`);
    console.log(`   ID: ${course._id}`);
    console.log(`   Total de estudiantes: ${course.students?.length || 0}\n`);

    if (course.students && course.students.length > 0) {
      console.log('👥 Estudiantes inscritos:');
      course.students.forEach((student: any, index: number) => {
        console.log(`\n   ${index + 1}. Usuario ID: ${student.userId || student}`);
        console.log(`      Tipo de inscripción: ${student.enrollmentType || 'N/A'}`);
        console.log(`      Fecha de inscripción: ${student.enrolledAt || 'N/A'}`);
        console.log(`      Fecha inicio: ${student.startDate || 'N/A'}`);
        console.log(`      Fecha fin: ${student.endDate || 'N/A'}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

const courseId = process.argv[2] || '69488d829aa5626a2bde9779';
console.log(`🔍 Verificando estudiantes del curso: ${courseId}\n`);

checkCourseStudents(courseId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
