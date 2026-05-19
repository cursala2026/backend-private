import mongoose from 'mongoose';
import config from './src/config';
import QuestionnaireRepository from './src/repositories/questionnaire.repository';
import QuestionnaireService from './src/services/questionnaire.service';

const run = async () => {
  await mongoose.connect(config.DATABASE_URL);
  console.log('Connected to DB');

  const qRepo = new QuestionnaireRepository(mongoose.connection);
  const subRepo = { hasSubmissions: async () => false } as any; // mock
  const svc = new QuestionnaireService(qRepo, subRepo);

  // find any questionnaire
  const qModel = mongoose.connection.model('Questionnaire');
  const doc: any = await qModel.findOne({});
  if (!doc) {
    console.log('No questionnaire found');
    process.exit(0);
  }

  console.log('Found questionnaire', doc._id.toString());
  
  const updateData = doc.toObject();
  
  // Add a new question
  updateData.questions.push({
    type: 'MULTIPLE_CHOICE',
    questionText: 'Test new question',
    order: updateData.questions.length,
    points: 10,
    required: true,
    options: [
      { text: 'Option A', order: 0 },
      { text: 'Option B', order: 1 }
    ],
    correctOptionId: "1" // Use index 1
  });

  try {
    await svc.update(doc._id.toString(), updateData);
    console.log('Update success');
  } catch (err) {
    console.error('Update failed:', err);
  }

  process.exit(0);
};

run();
