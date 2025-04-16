import logger from '../config/logger.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configurar transporte de correo
let transporter;

// Configuración para desarrollo
if (process.env.NODE_ENV === 'development') {
  // En desarrollo, usar ethereal.email para pruebas
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
      pass: process.env.EMAIL_PASS || 'ethereal_password'
    }
  });
} else {
  // En producción, usar la configuración real
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

/**
 * Envía un correo electrónico
 * @param {Object} options - Opciones del correo
 * @param {String} options.to - Destinatario
 * @param {String} options.subject - Asunto
 * @param {String} options.html - Contenido HTML
 * @param {String} options.text - Contenido texto plano (opcional)
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendEmail = async (options) => {
  try {
    if (!options.to || !options.subject) {
      logger.error('Faltan parámetros para enviar email');
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Evolution <noreply@evolution-app.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    };

    // En desarrollo, mostrar URL de previsualización
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV] Simulating email to: ${options.to}`);
      const info = await transporter.sendMail(mailOptions);
      logger.info(`[DEV] Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return true;
    }

    // Enviar email real en producción
    await transporter.sendMail(mailOptions);
    logger.info(`Email enviado exitosamente a: ${options.to}`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar email: ${error.message}`);
    return false;
  }
};

/**
 * Envía una notificación al administrador
 * @param {String} subject - Asunto del correo
 * @param {String} message - Mensaje
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendAdminNotification = async (subject, message) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@evolution-app.com';
    
    return await sendEmail({
      to: adminEmail,
      subject: `[Evolution] ${subject}`,
      html: `<p>${message}</p>`
    });
  } catch (error) {
    logger.error(`Error al enviar notificación admin: ${error.message}`);
    return false;
  }
}; 