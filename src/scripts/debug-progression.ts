import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkCourseProgression() {
  try {
    const mongoUri = process.env.DATABASE_URL || 'mongodb://localhost:27017/cursala';
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
        console.error('❌ Connection not established');
        return;
    }

    const coursesColl = db.collection('courses');
    const classesColl = db.collection('classes');
    const questionnairesColl = db.collection('questionnaires');
    const progressColl = db.collection('course-progress');

    // 1. Find the course
    const course = await coursesColl.findOne({ name: /redes y telecomunicaciones/i });
    if (!course) {
      console.log('❌ Course "Redes y Telecomunicaciones" not found');
      return;
    }

    console.log(`\n📚 COURSE: ${course.name} (${course._id})`);
    
    // 2. Get classes
    const classes = await classesColl.find({ courseId: course._id }).sort({ order: 1 }).toArray();
    console.log(`\n🏫 CLASSES (${classes.length}):`);
    classes.forEach(c => {
      console.log(`  - [Order ${c.order}] ${c.title} (${c._id})`);
    });

    // 3. Get questionnaires
    const questionnaires = await questionnairesColl.find({ courseId: course._id }).toArray();
    console.log(`\n📝 QUESTIONNAIRES (${questionnaires.length}):`);
    questionnaires.forEach(q => {
      console.log(`  - ${q.title} (${q._id})`);
      console.log(`    Position: ${q.position?.type}, AfterClassId: ${q.position?.afterClassId}`);
    });

    // 4. Check for progress records
    const allProgress = await progressColl.find({ courseId: course._id }).toArray();
    console.log(`\n👥 PROGRESS RECORDS: ${allProgress.length}`);
    
    if (allProgress.length > 0) {
        const sample = allProgress[0];
        console.log(`\nSample Progress for user ${sample.userId}:`);
        console.log(`Overall Progress: ${sample.overallProgress}%`);
        console.log(`Classes Completed: ${sample.classesProgress?.filter((cp: any) => cp.completed).length || 0}`);
        console.log(`Questionnaires Completed: ${sample.questionnairesProgress?.filter((qp: any) => qp.completed).length || 0}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCourseProgression();
