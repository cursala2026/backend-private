/**
 * Script para probar los endpoints de estudiantes para Admin y Profesor
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { CourseSchema } from '../models/mongo/course.model';
import { UserSchema } from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testStudentEndpoints() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    const User = mongoose.model('User', UserSchema, 'users');
    const Course = mongoose.model('Course', CourseSchema, 'courses');

    // ========== PRUEBA 1: Endpoint de ADMIN (getAllStudentsFromAllCourses) ==========
    console.log('🔴 PRUEBA 1: Endpoint de ADMIN - getAllStudentsFromAllCourses\n');

    // Obtener todos los cursos
    const allCourses = await Course.find({}).lean();
    const allCourseIds = allCourses.map((c: any) => c._id);

    console.log(`📚 Total de cursos en el sistema: ${allCourses.length}`);
    console.log(`Cursos: ${allCourses.map((c: any) => c.name).join(', ')}\n`);

    // Simular lo que hace getStudentsByTeacherCourses con todos los cursos
    const adminStudents = await User.aggregate([
      {
        $lookup: {
          from: 'courses',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$_id', allCourseIds] },
                    { $in: ['$$userId', { $ifNull: [{ $map: { input: '$students', as: 'student', in: '$$student.userId' } }, []] }] }
                  ]
                }
              }
            }
          ],
          as: 'enrolledCourses'
        }
      },
      {
        $match: {
          enrolledCourses: { $ne: [] }
        }
      },
      { $unwind: '$enrolledCourses' },
      {
        $project: {
          userId: '$_id',
          email: 1,
          firstName: 1,
          lastName: 1,
          courseId: '$enrolledCourses._id',
          courseName: '$enrolledCourses.name'
        }
      }
    ]);

    console.log(`👥 Total de estudiantes encontrados por ADMIN: ${adminStudents.length}`);
    if (adminStudents.length > 0) {
      console.log('Primeros 5 estudiantes:');
      adminStudents.slice(0, 5).forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.firstName} ${s.lastName} - ${s.courseName}`);
      });
    }

    // ========== PRUEBA 2: Endpoint de PROFESOR ==========
    console.log('\n\n🟡 PRUEBA 2: Endpoint de PROFESOR - getStudentsByTeacherCourses\n');

    // Buscar profesores que tengan cursos asignados
    const teachers = await User.find({ roles: { $in: ['PROFESOR'] } }).lean();
    console.log(`👨‍🏫 Total de profesores en el sistema: ${teachers.length}\n`);

    for (const teacher of teachers.slice(0, 3)) {  // Solo probar los primeros 3 profesores
      const teacherData = teacher as any;
      console.log(`\n📋 Profesor: ${teacherData.firstName} ${teacherData.lastName} (${teacherData.email})`);

      // Obtener cursos donde este profesor está en el array `teachers`
      const teacherCourses = await Course.find({
        teachers: teacherData._id
      }).lean();

      console.log(`   Cursos asignados: ${teacherCourses.length}`);

      if (teacherCourses.length === 0) {
        console.log('   ⚠️  Este profesor no tiene cursos asignados');
        continue;
      }

      teacherCourses.forEach((c: any) => {
        console.log(`   - ${c.name}`);
      });

      // Obtener estudiantes de los cursos del profesor
      const teacherCourseIds = teacherCourses.map((c: any) => c._id);

      const teacherStudents = await User.aggregate([
        {
          $lookup: {
            from: 'courses',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$_id', teacherCourseIds] },
                      { $in: ['$$userId', { $ifNull: [{ $map: { input: '$students', as: 'student', in: '$$student.userId' } }, []] }] }
                    ]
                  }
                }
              }
            ],
            as: 'enrolledCourses'
          }
        },
        {
          $match: {
            enrolledCourses: { $ne: [] }
          }
        },
        { $unwind: '$enrolledCourses' },
        {
          $project: {
            userId: '$_id',
            email: 1,
            firstName: 1,
            lastName: 1,
            courseId: '$enrolledCourses._id',
            courseName: '$enrolledCourses.name'
          }
        }
      ]);

      console.log(`   👥 Estudiantes encontrados: ${teacherStudents.length}`);
      teacherStudents.forEach((s: any, i: number) => {
        console.log(`      ${i + 1}. ${s.firstName} ${s.lastName} - ${s.courseName}`);
      });
    }

    // ========== VERIFICACIÓN FINAL ==========
    console.log('\n\n✅ VERIFICACIÓN FINAL\n');

    // Verificar que no haya estudiantes duplicados en la respuesta de admin
    const uniqueAdminStudents = new Set(adminStudents.map((s: any) => `${s.userId}-${s.courseId}`));
    console.log(`Total de relaciones estudiante-curso únicas para ADMIN: ${uniqueAdminStudents.size}`);
    console.log(`Total de filas devueltas para ADMIN: ${adminStudents.length}`);

    if (uniqueAdminStudents.size === adminStudents.length) {
      console.log('✅ No hay duplicados en la respuesta de ADMIN');
    } else {
      console.log('⚠️  HAY DUPLICADOS en la respuesta de ADMIN');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

console.log('🚀 Iniciando prueba de endpoints de estudiantes...\n');

testStudentEndpoints()
  .then(() => {
    console.log('\n✅ Prueba completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
