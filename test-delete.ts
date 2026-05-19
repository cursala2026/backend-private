import './src/dns-fix';
import 'tsconfig-paths/register';
import { connectDB, disconnectDB } from '@/config/databases/mongo';
import { questionnaireService } from '@/services';
import { Questionnaire } from '@/models/mongo/questionnaire.model';
import mongoose from 'mongoose';

async function testDelete() {
  await connectDB();
  try {
    // 1. Create a mock questionnaire to delete
    const qId = new mongoose.Types.ObjectId();
    const courseId = new mongoose.Types.ObjectId();
    const createdBy = new mongoose.Types.ObjectId();

    await Questionnaire.create({
      _id: qId,
      courseId,
      title: 'Test Delete Questionnaire',
      status: 'ACTIVE',
      position: { type: 'FINAL_EXAM' },
      questions: [
        {
          type: 'TEXT',
          questionText: 'Test?',
          order: 0,
          points: 100,
          required: true
        }
      ],
      allowRetries: true,
      showCorrectAnswers: true,
      isSurvey: false,
      createdBy
    });

    console.log('Created test questionnaire:', qId);

    // 2. Call delete method
    await questionnaireService.delete(qId.toString());

    console.log('Successfully deleted the questionnaire!');

    // 3. Verify it was deleted
    const found = await Questionnaire.findById(qId);
    if (!found) {
      console.log('Confirmed: Questionnaire no longer exists in DB.');
    } else {
      console.error('Failed: Questionnaire still exists in DB!');
    }

  } catch (error: any) {
    console.error('Error during deletion:', error.message);
    console.error(error.stack);
  } finally {
    await disconnectDB();
  }
}

testDelete();
