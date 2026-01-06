import nodemailer from 'nodemailer';
import config from '../config';
import { logger } from '@/utils';

/**
 * Type definition for email attachments
 */
export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

export const sendEmail = async ({
  email,
  subject,
  html,
  attachments,
}: {
  email: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) => {
  let transporter: nodemailer.Transporter;
  let usingEthereal = false;

  // Determine behavior:
  // - useEthereal: enabled explicitly and NOT in production
  // - shouldSend: send email when in production OR when using Ethereal locally
  const useEthereal = String(process.env.EMAIL_USE_ETHEREAL).toLowerCase() === 'true' && process.env.NODE_ENV !== 'production';
  const shouldSend = process.env.NODE_ENV === 'production' || useEthereal;

  if (!shouldSend) {
    logger.info('sendEmail skipped: not in production and Ethereal not enabled');
    return null;
  }

  if (useEthereal) {
    // Create a test account and transporter
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    usingEthereal = true;
  } else {
    transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST || 'mail.cursala.com.ar',
      port: config.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: config.EMAIL_FROM,
        pass: config.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  const mailOptions = {
    from: config.EMAIL_FROM,
    to: email,
    subject,
    html,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };

  logger.info('Enviando email', { to: email, subject, usingEthereal });
  const info = await transporter.sendMail(mailOptions);

  if (usingEthereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    logger.info(`Ethereal preview URL: ${preview}`);
  }
  return info;
};
