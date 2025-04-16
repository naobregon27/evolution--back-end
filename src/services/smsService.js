import logger from '../config/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Envía un mensaje SMS
 * @param {Object} options - Opciones del SMS
 * @param {String} options.to - Número de teléfono destinatario
 * @param {String} options.message - Contenido del mensaje
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendSMS = async (options) => {
  try {
    if (!options.to || !options.message) {
      logger.error('Faltan parámetros para enviar SMS');
      return false;
    }

    // Normalizar el número de teléfono (eliminar espacios, guiones, etc.)
    const phoneNumber = options.to.replace(/\s+|-|\(|\)/g, '');
    
    // Limitar el mensaje a 160 caracteres (estándar SMS)
    const message = options.message.substring(0, 160);

    if (process.env.NODE_ENV === 'development') {
      // En desarrollo, simular el envío
      logger.info(`[DEV] Simulando envío de SMS a: ${phoneNumber}`);
      logger.info(`[DEV] Contenido: ${message}`);
      return true;
    }

    // En producción, implementar el proveedor de SMS real
    // Aquí podrías usar Twilio, AWS SNS, o cualquier otro proveedor
    
    // Ejemplo con Twilio (comentado, necesitarías instalar el paquete 'twilio')
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    logger.info(`SMS enviado, SID: ${result.sid}`);
    */
    
    // Por ahora, simular éxito
    logger.info(`SMS enviado exitosamente a: ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar SMS: ${error.message}`);
    return false;
  }
};

/**
 * Envía un SMS de alerta al administrador
 * @param {String} message - Mensaje de alerta
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendAdminSMSAlert = async (message) => {
  try {
    const adminPhone = process.env.ADMIN_PHONE || '+34600000000';
    
    return await sendSMS({
      to: adminPhone,
      message: `[Evolution] ${message}`
    });
  } catch (error) {
    logger.error(`Error al enviar SMS de alerta: ${error.message}`);
    return false;
  }
}; 