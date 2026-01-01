/**
 * Script para corregir los datos de students que se guardaron incorrectamente
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function fixStudentsData() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    console.log('🔍 Buscando cursos con datos incorrectos...\n');

    const courses = await Course.find({ students: { $exists: true, $ne: [] } });

    let fixed = 0;

    for (const course of courses) {
      if (!course.students || course.students.length === 0) continue;

      console.log(`📚 Procesando: ${course.name}`);

      const fixedStudents: any[] = [];
      let needsFix = false;

      for (const student of course.students) {
        const studentObj = student as any;

        // Si userId es un objeto (incorrecto), extraer el ObjectId correcto
        if (studentObj.userId && typeof studentObj.userId === 'object' && studentObj.userId.buffer) {
          needsFix = true;

          // El buffer contiene el ObjectId real
          const correctUserId = new mongoose.Types.ObjectId(studentObj.userId.buffer);

          console.log(`   ✓ Corrigiendo estudiante: ${correctUserId}`);

          fixedStudents.push({
            userId: correctUserId,
            enrolledAt: studentObj.enrolledAt || new Date(),
            enrollmentType: studentObj.enrollmentType || 'SELF',
            ...(studentObj.startDate && { startDate: studentObj.startDate }),
            ...(studentObj.endDate && { endDate: studentObj.endDate }),
          });
        } else if (studentObj.userId) {
          // Formato correcto
          fixedStudents.push(studentObj);
        } else if (mongoose.Types.ObjectId.isValid(studentObj)) {
          // Formato viejo (solo ObjectId)
          fixedStudents.push({
            userId: new mongoose.Types.ObjectId(studentObj.toString()),
            enrolledAt: new Date(),
            enrollmentType: 'SELF',
          });
        }
      }

      if (needsFix) {
        await Course.updateOne(
          { _id: course._id },
          { $set: { students: fixedStudents } }
        );
        console.log(`   ✅ Curso actualizado\n`);
        fixed++;
      } else {
        console.log(`   ℹ️  Ya está correcto\n`);
      }
    }

    console.log(`\n📊 Total de cursos corregidos: ${fixed}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

console.log('🚀 Iniciando corrección de datos de students...\n');

fixStudentsData()
  .then(() => {
    console.log('\n✅ Corrección completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
