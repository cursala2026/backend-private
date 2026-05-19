import mongoose from 'mongoose';
import config from './src/config';
import { Questionnaire } from './src/models/mongo/questionnaire.model';
import QuestionnaireRepository from './src/repositories/questionnaire.repository';
import QuestionnaireSubmissionRepository from './src/repositories/questionnaireSubmission.repository';
import QuestionnaireService from './src/services/questionnaire.service';
import { User } from './src/models/mongo/user.model';
import { QuestionnaireSubmission } from './src/models/mongo/questionnaireSubmission.model';

async function test() {
  await mongoose.connect(config.DB_URI);
  console.log('Connected to DB');

  const questionnaireRepo = new QuestionnaireRepository(Questionnaire);
  const submissionRepo = new QuestionnaireSubmissionRepository(QuestionnaireSubmission);
  const service = new QuestionnaireService(questionnaireRepo, submissionRepo);

  const testQ = await Questionnaire.findOne();
  if (!testQ) {
    console.log('No questionnaire found');
    return;
  }
  const testUser = await User.findOne({ roles: 'ALUMNO' });
  if (!testUser) {
    console.log('No ALUMNO found');
    return;
  }

  try {
    const result = await service.findById(testQ._id.toString(), testUser._id.toString(), testUser.roles);
    console.log('Success:', !!result);
  } catch (err) {
    console.error('Error in findById:', err);
  }

  mongoose.disconnect();
}
test().catch(console.error);
