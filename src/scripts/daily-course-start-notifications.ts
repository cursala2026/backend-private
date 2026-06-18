import cron from 'node-cron';
import UserRepository from '../repositories/user.repository';
import mongoose from 'mongoose';
import { sendEmail } from '../utils/emailer';
import { getConfig } from '../repositories/config.repository';

mongoose.connect(process.env.DATABASE_URL!);

const connection = mongoose.connection;
const userRepository = new UserRepository(connection);

export async function runCourseStartOnce() {
  const config = await getConfig('course-start');
  if (!config.enabled) {
    console.log('Notificaciones de inicio de curso deshabilitadas');
    return;
  }

  const users = await userRepository.findCoursesStart();
  if (!Array.isArray(users)) {
    console.error('findCoursesStart no devolvió un array');
    return;
  }

  for (const user of users) {
    try {
      const html = `
        <p>Hola ${user.userName},</p>
        <p>Tu curso <strong>${user.courseName}</strong> comienza el ${user.startDate}.</p>
      `;

      await sendEmail({
        email: user.email,
        subject: `Tu curso "${user.courseName}" está por comenzar`,
        html,
        from: config.senderEmail
      });

      await userRepository.markUserNotifiedCourseStart(user.id);
    } catch (err) {
      console.error(`Error enviando a ${user.email}`, err);
    }
  }
}

cron.schedule('0 9 * * *', runCourseStartOnce);
