import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';
import { Questionnaire } from '../models/mongo/questionnaire.model';
import { QuestionnaireSubmission } from '../models/mongo/questionnaireSubmission.model';
import { UserSchema } from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function diagnose() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    const User = mongoose.model('User', UserSchema, 'users');

    // 1. Find course
    console.log('🔍 Buscando cursos relacionados con "redes" o "telecomunicación"...');
    const courses: any[] = await Course.find({ name: /redes|telecom/i }).lean();
    console.log(`Encontrados ${courses.length} curso(s):`);
    for (const c of courses) {
      console.log(`- [${c._id}] ${c.name} (${c.status})`);
    }
    
    if (courses.length === 0) {
      console.log('❌ No se encontró ningún curso con "redes" o "telecomunicación"');
      return;
    }

    const courseIds = courses.map((c: any) => c._id);

    // 2. Find questionnaires
    console.log('\n🔍 Buscando cuestionarios para estos cursos...');
    const questionnaires: any[] = await Questionnaire.find({ courseId: { $in: courseIds } }).lean();
    console.log(`Encontrados ${questionnaires.length} cuestionario(s):`);
    for (const q of questionnaires) {
      console.log(`- [${q._id}] Título: ${q.title} | Posición: ${q.position?.type} | Aprobación: ${q.passingScore}% | Preguntas: ${q.questions?.length}`);
    }

    if (questionnaires.length === 0) {
      console.log('❌ No se encontraron cuestionarios para estos cursos.');
      return;
    }

    // 3. Find submissions
    console.log('\n🔍 Buscando envíos para estos cuestionarios...');
    const qIds = questionnaires.map((q: any) => q._id);
    const submissions: any[] = await QuestionnaireSubmission.find({ questionnaireId: { $in: qIds } }).lean();
    console.log(`Encontrados ${submissions.length} envío(s) en total:`);
    for (const s of submissions) {
      const q = questionnaires.find((q: any) => String(q._id) === String(s.questionnaireId));
      console.log(`- [${s._id}] Cuestionario: "${q?.title}" | Estudiante: ${s.studentName} (${s.studentEmail}) | Intento: ${s.attemptNumber} | Score: ${s.finalScore ?? s.autoGradedScore}% | Status: ${s.status}`);
    }

    if (submissions.length === 0) {
      console.log('❌ No se encontraron envíos.');
      return;
    }

    // Let's do a deep dive into the submissions that have ~55% score or are graded
    console.log('\n🔍 --- DETALLE DE CADA ENVÍO Y SUS PREGUNTAS ---');
    for (const s of submissions) {
      const q = questionnaires.find((q: any) => String(q._id) === String(s.questionnaireId));
      if (!q) continue;

      console.log(`\n==================================================`);
      console.log(`ENVÍO: [${s._id}]`);
      console.log(`Estudiante: ${s.studentName} | Cuestionario: "${q.title}"`);
      console.log(`Puntaje obtenido: ${s.finalScore ?? s.autoGradedScore}% (Auto-graded: ${s.autoGradedScore}%)`);
      console.log(`Estado: ${s.status}`);
      console.log(`--------------------------------------------------`);

      console.log('Preguntas y Respuestas:');
      for (let i = 0; i < q.questions.length; i++) {
        const question = q.questions[i];
        const answer = s.answers.find((a: any) => String(a.questionId) === String(question._id));

        console.log(`\nPregunta ${i + 1}: ${question.questionText} (${question.type}) [Puntos: ${question.points}]`);
        console.log(`  correctOptionId (DB): ${question.correctOptionId}`);
        console.log(`  correctOptionIds (DB): ${JSON.stringify(question.correctOptionIds)}`);
        
        console.log('  Opciones disponibles en DB:');
        if (question.options) {
          question.options.forEach((opt: any, idx: number) => {
            console.log(`    [${opt._id}] (índice ${idx}) ${opt.text}`);
          });
        }

        if (answer) {
          console.log(`  Respuesta del Alumno:`);
          console.log(`    selectedOptionId: ${answer.selectedOptionId}`);
          console.log(`    selectedOptionIds: ${JSON.stringify((answer as any).selectedOptionIds)}`);
          console.log(`    isCorrect: ${answer.isCorrect} | Puntos obtenidos: ${answer.pointsAwarded}`);
        } else {
          console.log(`  ⚠️ Sin respuesta encontrada para esta pregunta en el envío!`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Error en diagnóstico:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

diagnose();
