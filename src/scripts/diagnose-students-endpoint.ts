/**
 * Script de diagnóstico para el endpoint getAllStudentsFromAllCourses
 * Verifica qué estudiantes se encuentran y por qué algunos podrían no aparecer
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';
import { UserSchema } from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function diagnoseStudentsEndpoint() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    // Crear el modelo de User
    const User = mongoose.model('User', UserSchema, 'users');

    // 1. Verificar cuántos cursos existen
    const totalCourses = await Course.countDocuments();
    console.log(`📚 Total de cursos en el sistema: ${totalCourses}`);

    // 2. Verificar cuántos cursos tienen estudiantes
    const coursesWithStudents = await Course.countDocuments({
      students: { $exists: true, $ne: [] }
    });
    console.log(`📚 Cursos con estudiantes: ${coursesWithStudents}`);

    // 3. Obtener todos los estudiantes únicos desde el array students de todos los cursos
    const studentsFromCourses = await Course.aggregate([
      { $match: { students: { $exists: true, $ne: [] } } },
      { $unwind: '$students' },
      {
        $group: {
          _id: '$students.userId',
          courses: { $push: { courseId: '$_id', courseName: '$name' } },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          userId: '$_id',
          email: '$userInfo.email',
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          coursesCount: '$count',
          courses: 1
        }
      }
    ]);

    console.log(`\n👥 Total de estudiantes únicos encontrados en courses.students[]: ${studentsFromCourses.length}\n`);

    if (studentsFromCourses.length > 0) {
      console.log('📋 Lista de estudiantes:\n');
      studentsFromCourses.forEach((student: any, index: number) => {
        console.log(`${index + 1}. ${student.firstName} ${student.lastName} (${student.email})`);
        console.log(`   - ID: ${student.userId}`);
        console.log(`   - Inscrito en ${student.coursesCount} curso(s):`);
        student.courses.forEach((course: any) => {
          console.log(`     • ${course.courseName}`);
        });
        console.log('');
      });
    }

    // 4. Verificar si hay usuarios con rol ALUMNO que NO están en ningún curso
    const allStudentUsers = await User.find({ roles: { $in: ['ALUMNO'] } }).lean();
    const enrolledUserIds = new Set(studentsFromCourses.map((s: any) => s.userId.toString()));
    const unenrolledStudents = allStudentUsers.filter(
      (user: any) => !enrolledUserIds.has(user._id.toString())
    );

    console.log(`\n⚠️  Estudiantes (rol ALUMNO) que NO están inscritos en ningún curso: ${unenrolledStudents.length}`);
    if (unenrolledStudents.length > 0) {
      console.log('\nEstudiantes no inscritos:');
      unenrolledStudents.forEach((student: any, index: number) => {
        console.log(`${index + 1}. ${student.firstName} ${student.lastName} (${student.email})`);
      });
    }

    // 5. Verificar estructura de datos en students[]
    console.log('\n🔍 Verificando estructura de students[] en los cursos:\n');
    const sampleCourse = await Course.findOne({ students: { $exists: true, $ne: [] } }).lean();
    if (sampleCourse && sampleCourse.students && sampleCourse.students.length > 0) {
      console.log(`Curso de ejemplo: ${(sampleCourse as any).name}`);
      console.log('Estructura del primer estudiante:');
      console.log(JSON.stringify((sampleCourse as any).students[0], null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

console.log('🚀 Iniciando diagnóstico del endpoint getAllStudentsFromAllCourses...\n');

diagnoseStudentsEndpoint()
  .then(() => {
    console.log('\n✅ Diagnóstico completado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
