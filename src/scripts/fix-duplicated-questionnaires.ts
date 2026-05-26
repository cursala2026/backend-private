import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/mongo/course.model';
import { Questionnaire } from '../models/mongo/questionnaire.model';
import { QuestionnaireSubmissionModel } from '../models/mongo/questionnaireSubmission.model';
import { UserSchema } from '../models/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const User = mongoose.model('User', UserSchema, 'users');

async function repair() {
  try {
    console.log('🚀 Iniciando script de reparación de base de datos...');
    await mongoose.connect(process.env.DATABASE_URL || '');
    console.log('✅ Conectado a MongoDB\n');

    // 1. Obtener todos los cuestionarios
    const questionnaires = await Questionnaire.find({});
    console.log(`🔍 Analizando ${questionnaires.length} cuestionarios...`);

    let repairedQuestionnairesCount = 0;
    let repairedSubmissionsCount = 0;

    // Guardaremos todas las opciones de todos los cuestionarios de la base de datos
    // para poder buscar la opción "original" rota rápidamente.
    const allOptionsMap: { [idStr: string]: { text: string; order: number } } = {};
    for (const q of questionnaires) {
      for (const question of q.questions) {
        if (question.options) {
          for (const opt of question.options) {
            if (opt._id) {
              allOptionsMap[opt._id.toString()] = {
                text: opt.text,
                order: opt.order,
              };
            }
          }
        }
      }
    }

    for (const q of questionnaires) {
      let questionnaireModified = false;

      for (const question of q.questions) {
        if (question.type !== 'MULTIPLE_CHOICE' && question.type !== 'MULTIPLE_SELECT') {
          continue;
        }

        const currentOptionIds = (question.options || []).map((opt) => opt._id?.toString());
        const currentOptionIdsSet = new Set(currentOptionIds);

        // A. Verificar correctOptionId (para MULTIPLE_CHOICE)
        if (question.correctOptionId) {
          const correctIdStr = question.correctOptionId.toString();
          if (!currentOptionIdsSet.has(correctIdStr)) {
            console.log(`⚠️ Referencia rota detectada en Cuestionario: "${q.title}" [${q._id}], Pregunta: "${question.questionText}"`);
            console.log(`   correctOptionId actual [${correctIdStr}] no pertenece a las opciones de esta pregunta.`);

            // Buscar la opción original
            const originalOption = allOptionsMap[correctIdStr];
            if (originalOption) {
              console.log(`   Coincidencia encontrada para la opción rota: "${originalOption.text}" (orden ${originalOption.order})`);
              // Buscar opción homóloga por texto en la pregunta actual
              const matchedOption = question.options?.find(
                (opt) => opt.text.trim().toLowerCase() === originalOption.text.trim().toLowerCase()
              );

              if (matchedOption && matchedOption._id) {
                console.log(`   ✅ Opción correspondiente identificada en la nueva pregunta: [${matchedOption._id.toString()}]`);
                question.correctOptionId = matchedOption._id;
                questionnaireModified = true;
              } else {
                console.log(`   ❌ No se encontró ninguna opción coincidente por texto para "${originalOption.text}" en la nueva pregunta.`);
              }
            } else {
              console.log(`   ❌ No se encontró la opción original en toda la base de datos.`);
            }
          }
        }

        // B. Verificar correctOptionIds (para MULTIPLE_SELECT o MULTIPLE_CHOICE heredado)
        if (question.correctOptionIds && Array.isArray(question.correctOptionIds)) {
          const newCorrectOptionIds: mongoose.Types.ObjectId[] = [];
          let correctOptionIdsModified = false;

          for (const cid of question.correctOptionIds) {
            const cidStr = cid.toString();
            if (!currentOptionIdsSet.has(cidStr)) {
              console.log(`⚠️ Referencia rota detectada en Cuestionario: "${q.title}" [${q._id}], Pregunta: "${question.questionText}" (en array correctOptionIds)`);
              console.log(`   ID correcto [${cidStr}] no pertenece a las opciones de esta pregunta.`);

              const originalOption = allOptionsMap[cidStr];
              if (originalOption) {
                console.log(`   Coincidencia encontrada para la opción rota: "${originalOption.text}" (orden ${originalOption.order})`);
                const matchedOption = question.options?.find(
                  (opt) => opt.text.trim().toLowerCase() === originalOption.text.trim().toLowerCase()
                );

                if (matchedOption && matchedOption._id) {
                  console.log(`   ✅ Opción correspondiente identificada: [${matchedOption._id.toString()}]`);
                  newCorrectOptionIds.push(matchedOption._id);
                  correctOptionIdsModified = true;
                  questionnaireModified = true;
                } else {
                  console.log(`   ❌ No se encontró opción homóloga para "${originalOption.text}". Manteniendo ID original.`);
                  newCorrectOptionIds.push(cid);
                }
              } else {
                console.log(`   ❌ No se encontró la opción original en toda la base de datos. Manteniendo ID original.`);
                newCorrectOptionIds.push(cid);
              }
            } else {
              newCorrectOptionIds.push(cid);
            }
          }

          if (correctOptionIdsModified) {
            question.correctOptionIds = newCorrectOptionIds;
          }
        }
      }

      if (questionnaireModified) {
        // Guardar cambios en el cuestionario
        await Questionnaire.updateOne(
          { _id: q._id },
          { $set: { questions: q.questions } }
        );
        console.log(`💾 Cuestionario "${q.title}" [${q._id}] reparado y guardado.\n`);
        repairedQuestionnairesCount++;

        // 2. Corregir y re-calificar envíos existentes para este cuestionario
        const submissions = await QuestionnaireSubmissionModel.find({ questionnaireId: q._id });
        if (submissions.length > 0) {
          console.log(`🔄 Re-evaluando ${submissions.length} envíos para el cuestionario "${q.title}"...`);
          
          for (const s of submissions) {
            let submissionModified = false;
            let totalPoints = q.questions.reduce((sum, question) => sum + question.points, 0);
            let earnedPoints = 0;

            const updatedAnswers = s.answers.map((answer) => {
              const question = q.questions.find((question) => question._id?.toString() === answer.questionId.toString());
              if (!question) {
                earnedPoints += answer.pointsAwarded || 0;
                return answer;
              }

              if (question.type === 'MULTIPLE_CHOICE' || question.type === 'MULTIPLE_SELECT') {
                const correctIds: string[] = [];
                if (question.correctOptionIds && Array.isArray(question.correctOptionIds)) {
                  correctIds.push(...question.correctOptionIds.map((id) => id.toString()));
                } else if (question.correctOptionId) {
                  correctIds.push(question.correctOptionId.toString());
                }

                if (correctIds.length === 0) {
                  return answer;
                }

                const selectedIds: string[] = [];
                if ((answer as any).selectedOptionIds && Array.isArray((answer as any).selectedOptionIds)) {
                  selectedIds.push(...(answer as any).selectedOptionIds.map((id: any) => id.toString()));
                } else if (answer.selectedOptionId) {
                  selectedIds.push(answer.selectedOptionId.toString());
                }

                const correctSet = new Set(correctIds);
                const selectedSet = new Set(selectedIds);
                const intersectionCount = [...correctSet].filter((v) => selectedSet.has(v)).length;
                const wrongSelections = [...selectedSet].filter((v) => !correctSet.has(v)).length;
                const correctCount = correctSet.size || 0;
                
                let isCorrect = false;
                let pointsAwarded = 0;

                if (correctCount > 0) {
                  if (correctSet.size === selectedSet.size && [...correctSet].every((v) => selectedSet.has(v))) {
                    isCorrect = true;
                  }

                  const penaltyFactor = 0.5;
                  const raw = (intersectionCount - penaltyFactor * wrongSelections) / correctCount;
                  const ratio = Math.max(0, raw);
                  pointsAwarded = Math.round(question.points * ratio);
                }

                if (answer.pointsAwarded !== pointsAwarded || answer.isCorrect !== isCorrect) {
                  submissionModified = true;
                }

                earnedPoints += pointsAwarded;

                return {
                  ...answer,
                  isCorrect,
                  pointsAwarded,
                };
              } else {
                // TEXT questions: conservar calificación manual existente
                earnedPoints += Number(answer.pointsAwarded || 0);
                return answer;
              }
            });

            if (submissionModified || s.status === 'SUBMITTED') {
              const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
              
              // Si el estado original era SUBMITTED y no hay preguntas de texto, o ya tiene calificación
              // Mantener estado según corresponda. Si ya tenía finalScore o no tiene preguntas de texto:
              const hasTextQuestions = q.questions.some((question) => question.type === 'TEXT');
              const newStatus = hasTextQuestions && s.status === 'SUBMITTED' ? 'SUBMITTED' : 'GRADED';

              await QuestionnaireSubmissionModel.updateOne(
                { _id: s._id },
                {
                  $set: {
                    answers: updatedAnswers,
                    finalScore: newStatus === 'GRADED' ? finalScore : undefined,
                    autoGradedScore: s.isSurvey ? 100 : finalScore,
                    status: newStatus,
                  },
                }
              );

              // Actualizar el progreso del curso
              if (newStatus === 'GRADED') {
                const CourseProgress = mongoose.connection.model('CourseProgress');
                if (CourseProgress) {
                  await CourseProgress.updateOne(
                    { studentId: s.studentId, courseId: s.courseId },
                    {
                      $set: {
                        [`questionnaireProgress.${q._id.toString()}`]: {
                          score: finalScore,
                          passed: finalScore >= (q.passingScore || 0),
                          completedAt: new Date(),
                        },
                      },
                    }
                  );
                }
              }

              console.log(`   ✅ Envío [${s._id}] re-calificado para ${s.studentName} (${s.studentEmail}). Nota anterior: ${s.finalScore ?? s.autoGradedScore}%, Nueva nota: ${finalScore}%`);
              repairedSubmissionsCount++;
            }
          }
        }
      }
    }

    console.log('\n==================================================');
    console.log('📊 RESUMEN DE LA MIGRACIÓN:');
    console.log(`- Cuestionarios duplicados con referencias rotas reparados: ${repairedQuestionnairesCount}`);
    console.log(`- Envíos de alumnos corregidos y re-calificados automáticamente: ${repairedSubmissionsCount}`);
    console.log('==================================================');

  } catch (err: any) {
    console.error('❌ Error en script de reparación:', err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

repair();
