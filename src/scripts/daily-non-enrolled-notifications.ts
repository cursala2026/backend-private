import cron from 'node-cron';
import UserRepository from '../repositories/user.repository';
import mongoose from 'mongoose';
import { sendEmail } from '../utils/emailer';
import { getConfig } from '../repositories/config.repository';
import { buildNoEnrollmentEmail } from '@/utils/notifications.utils';

mongoose.connect(process.env.DATABASE_URL!);

const connection = mongoose.connection;
const userRepository = new UserRepository(connection);

export async function runOnce() {
  const config = await getConfig('non-enrolled');
  if (!config.enabled) {
    console.log('Notificaciones para usuarios sin cursos deshabilitadas');
    return;
  }

  const users = await userRepository.findUsersWithNoEnrollments();
  const recommendedCourses = await userRepository.findRecommendedCourses();

  if (!Array.isArray(users) || users.length === 0) {
    console.error('findUsersWithNoEnrollments no devolvió un array');
    return;
  }

  for (const user of users) {
    console.log(`Enviando notificación a ${user.email}`);
    try {
      const html= buildNoEnrollmentEmail(user, recommendedCourses, config);
      
      await sendEmail({
        email: user.email,
        subject: '¡Explora nuestros cursos disponibles!',
        html,
        from: config.senderEmail
      });
      await userRepository.markUserNotifiedNoCourse(user.id);
    } catch (err) {
      console.error(`Error enviando a ${user.email}`, err);
    }
  }
}

cron.schedule('0 9 * * *', runOnce);
