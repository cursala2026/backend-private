import { userRepository } from '../repositories'; 
import { Request, Response } from 'express';
import { getConfig, updateConfig } from '../repositories/config.repository';
import { sendEmail } from '../utils/emailer';
import { buildNoEnrollmentEmail, buildCourseStartEmail } from '../utils/notifications.utils';
import { logger } from '@/utils';
import path from 'path';

// Conexión a la base de datos

export async function getNonEnrolledConfig(_req: Request, res: Response) {
  try {
    const config = await getConfig('non-enrolled');
    res.json(config);
  } catch (err) {
    logger.error('Error al obtener configuración', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
}

export async function updateNonEnrolledConfig(req: Request, res: Response) {
  try {
    const updated = await updateConfig('non-enrolled', req.body);
    res.json(updated);
  } catch (err) {
    logger.error('Error al actualizar configuración', err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
}

export async function getCourseStartConfig(_req: Request, res: Response) {
  try {
    const config = await getConfig('course-start');
    res.json(config);
  } catch (err) {
    logger.error('Error al obtener configuración', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
}

export async function updateCourseStartConfig(req: Request, res: Response) {
  try {
    const updated = await updateConfig('course-start', req.body);
    res.json(updated);
  } catch (err) {
    logger.error('Error al actualizar configuración', err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
}

export async function getNoEnrollmentUsers(_req: Request, res: Response) {
  try {
    const users = await userRepository.findUsersWithNoEnrollments();
    res.json(users);
  } catch (err) {
    logger.error('Error al obtener usuarios sin cursos', err);
    res.status(500).json({ error: 'Error al obtener usuarios sin cursos' });
  }
}

export async function getRecommendedCourses(req: Request, res: Response) {
  try {
    const courses = await userRepository.findRecommendedCourses();
    res.json(courses);
  } catch (err) {
    logger.error('Error al obtener cursos recomendados', err);
    res.status(500).json({ error: 'Error al obtener cursos recomendados' });
  }
}

export async function getCourseStart(req: Request, res: Response) {
  try {
    const courses = await userRepository.findCoursesStart();
    res.json(courses);
  } catch (err) {
    logger.error('Error al obtener cursos que empiezan', err);
    res.status(500).json({ error: 'Error al obtener cursos que empiezan' });
  }
}

export async function sendTestNoEnrollmentEmail(req: Request, res: Response) {
  try {
    const { users, senderEmail, ctaUrl, interestLink, unsubscribeLink } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'No se enviaron usuarios para la prueba' });
    }

    const recommendedCourses = await userRepository.findRecommendedCourses();
    const config = { ctaUrl, interestLink, unsubscribeLink };
    for (const user of users) {
      const html = buildNoEnrollmentEmail(user, recommendedCourses, config);

      await sendEmail({
        email: user.email,
        subject: 'Prueba de notificación de cursos',
        html,
        from: senderEmail,
        attachments: [
          {
            filename: 'cursala.png',
            path: path.join(__dirname, '../static/images/cursala.png'),
            cid: 'logo'
          },
          {
            filename: 'estrella.png',
            path: path.join(__dirname, '../static/images/estrella.png'),
            cid: 'estrella'
          },
          {
            filename: 'instagram.png',
            path: path.join(__dirname, '../static/images/instagram_notification.png'),
            cid: 'instagram'
          },
          {
            filename: 'linkedin.png',
            path: path.join(__dirname, '../static/images/linkedin_notification.png'),
            cid: 'linkedin'
          },
          {
            filename: 'youtube.png',
            path: path.join(__dirname, '../static/images/youtube_notification.png'),
            cid: 'youtube'
          },
          {
            filename: 'facebook.png',
            path: path.join(__dirname, '../static/images/facebook_notification.png'),
            cid: 'facebook'
          }
        ]
      });
    }

    res.json({ success: true, message: `${users.length} emails enviados` });
  } catch (err) {
    logger.error('Error al enviar email de prueba', err);
    res.status(500).json({ success: false, error: err });
  }
}

export async function sendTestCourseStartEmail(req: Request, res: Response) {
  try {
    const { users, senderEmail, template } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'No se enviaron usuarios para la prueba' });
    }

    for (const user of users) {
      const html = buildCourseStartEmail(user, template);

      await sendEmail({
        email: user.email,
        subject: template === 'welcome' 
        ? 'Bienvenido a tu curso'
        : 'Recordatorio de inicio de curso',
        html,
        from: senderEmail,
        attachments: [
          {
            filename: 'cursala.png',
            path: path.join(__dirname, '../static/images/cursala.png'),
            cid: 'logo'
          },
          {
            filename: 'laptop_gorro.png',
            path: path.join(__dirname, '../static/images/laptop_gorro.png'),
            cid: 'laptop'
          },
          {
            filename: 'instagram.png',
            path: path.join(__dirname, '../static/images/instagram_notification.png'),
            cid: 'instagram'
          },
          {
            filename: 'linkedin.png',
            path: path.join(__dirname, '../static/images/linkedin_notification.png'),
            cid: 'linkedin'
          },
          {
            filename: 'youtube.png',
            path: path.join(__dirname, '../static/images/youtube_notification.png'),
            cid: 'youtube'
          },
          {
            filename: 'facebook.png',
            path: path.join(__dirname, '../static/images/facebook_notification.png'),
            cid: 'facebook'
          }
        ]
      });
    }

    res.json({ success: true, message: `${users.length} emails enviados` });
  } catch (err) {
    logger.error('Error al enviar email de prueba', err);
    res.status(500).json({ success: false, error: err });
  }
}
