/**
 * Script para investigar el curso "Curso de prueba" y sus estudiantes
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';
import { UserSchema } from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkCursoPrueba() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    const User = mongoose.model('User', UserSchema, 'users');

    // Buscar el curso "Curso de prueba"
    const curso = await Course.findOne({ name: /curso de prueba/i }).lean();

    if (!curso) {
      console.log('❌ No se encontró el curso "Curso de prueba"');
      return;
    }

    console.log('📚 CURSO ENCONTRADO:');
    console.log(`   Nombre: ${(curso as any).name}`);
    console.log(`   ID: ${(curso as any)._id}`);
    console.log(`   Status: ${(curso as any).status}`);
    console.log('');

    // Verificar el array de students
    const students = (curso as any).students || [];
    console.log(`👥 Array students[] tiene ${students.length} elemento(s)\n`);

    if (students.length === 0) {
      console.log('⚠️  El array students[] está vacío');
      console.log('   Esto explica por qué no aparecen estudiantes en el frontend\n');
    } else {
      console.log('📋 ESTUDIANTES EN EL ARRAY students[]:\n');

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        console.log(`${i + 1}. Estructura del estudiante:`);
        console.log(JSON.stringify(student, null, 2));

        // Verificar el tipo de userId
        const userId = student.userId;
        console.log(`   Tipo de userId: ${typeof userId}`);
        console.log(`   Es ObjectId: ${mongoose.Types.ObjectId.isValid(userId)}`);

        // Intentar buscar el usuario
        try {
          const user = await User.findById(userId).lean();
          if (user) {
            console.log(`   ✅ Usuario encontrado: ${(user as any).firstName} ${(user as any).lastName} (${(user as any).email})`);
          } else {
            console.log(`   ❌ Usuario NO encontrado con ID: ${userId}`);
          }
        } catch (error) {
          console.log(`   ❌ Error buscando usuario: ${(error as Error).message}`);
        }
        console.log('');
      }
    }

    // Verificar si el curso tiene un formato antiguo con ObjectIds directos
    console.log('\n🔍 VERIFICACIÓN DE ESTRUCTURA COMPLETA DEL CURSO:\n');
    console.log('Campos del curso:');
    Object.keys(curso).forEach(key => {
      if (key === 'students') {
        console.log(`  - ${key}: [array con ${students.length} elementos]`);
      } else if (key === '_id' || key === '__v') {
        // Skip
      } else {
        console.log(`  - ${key}: ${typeof (curso as any)[key]}`);
      }
    });

    // Probar la consulta que usa el endpoint
    console.log('\n\n🧪 PROBANDO LA CONSULTA QUE USA EL ENDPOINT:\n');

    const courseId = (curso as any)._id;
    const testStudents = await User.aggregate([
      {
        $lookup: {
          from: 'courses',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', courseId] },
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
      {
        $project: {
          userId: '$_id',
          email: 1,
          firstName: 1,
          lastName: 1
        }
      }
    ]);

    console.log(`Resultado de la consulta: ${testStudents.length} estudiante(s) encontrado(s)`);
    if (testStudents.length > 0) {
      console.log('\nEstudiantes encontrados por la consulta:');
      testStudents.forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.firstName} ${s.lastName} (${s.email})`);
      });
    } else {
      console.log('\n⚠️  La consulta NO devolvió ningún estudiante');
      console.log('   Esto confirma que el problema está en la estructura de datos del array students[]');
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

console.log('🚀 Investigando el curso "Curso de prueba"...\n');

checkCursoPrueba()
  .then(() => {
    console.log('\n✅ Investigación completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
