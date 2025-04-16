import logger from '../config/logger.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuración para WhatsApp Business API (Meta)
const whatsappConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v13.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  businessId: process.env.WHATSAPP_BUSINESS_ID
};

/**
 * Envía un mensaje de WhatsApp
 * @param {Object} options - Opciones del mensaje
 * @param {String} options.to - Número de teléfono destinatario
 * @param {String} options.message - Contenido del mensaje (texto)
 * @param {String} options.templateName - Nombre de plantilla (opcional)
 * @param {Object} options.templateData - Datos para la plantilla (opcional)
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendWhatsAppMessage = async (options) => {
  try {
    if (!options.to) {
      logger.error('Falta el número de teléfono para enviar mensaje de WhatsApp');
      return false;
    }

    // Normalizar el número de teléfono
    let phoneNumber = options.to.replace(/\s+|-|\(|\)/g, '');
    
    // Asegurar que tiene formato internacional
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // En desarrollo, simular el envío
    if (process.env.NODE_ENV === 'development' || !whatsappConfig.accessToken) {
      logger.info(`[DEV] Simulando envío de WhatsApp a: ${phoneNumber}`);
      
      if (options.templateName) {
        logger.info(`[DEV] Usando plantilla: ${options.templateName}`);
        logger.info(`[DEV] Datos de plantilla:`, options.templateData);
      } else {
        logger.info(`[DEV] Mensaje: ${options.message}`);
      }
      
      return true;
    }

    // Construir payload para la API de WhatsApp
    let payload;
    
    if (options.templateName) {
      // Envío usando plantilla
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'template',
        template: {
          name: options.templateName,
          language: {
            code: 'es'
          },
          components: []
        }
      };
      
      // Agregar componentes de la plantilla si hay datos
      if (options.templateData) {
        const parameters = Object.entries(options.templateData).map(([_, value]) => {
          return {
            type: 'text',
            text: String(value)
          };
        });
        
        if (parameters.length > 0) {
          payload.template.components.push({
            type: 'body',
            parameters
          });
        }
      }
    } else {
      // Envío de mensaje de texto simple
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
          body: options.message
        }
      };
    }

    // Enviar mensaje a la API de WhatsApp
    const url = `${whatsappConfig.apiUrl}/${whatsappConfig.phoneNumberId}/messages`;
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${whatsappConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`WhatsApp enviado exitosamente a: ${phoneNumber}, ID: ${response.data.messages[0].id}`);
      return true;
    } else {
      logger.warn(`Respuesta inesperada de WhatsApp API:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error(`Error al enviar mensaje de WhatsApp: ${error.message}`);
    if (error.response) {
      logger.error(`Detalles del error: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
};

/**
 * Envía un mensaje de WhatsApp usando una plantilla específica
 * @param {String} to - Número de teléfono destinatario
 * @param {String} templateName - Nombre de la plantilla
 * @param {Object} templateData - Datos para la plantilla
 * @returns {Promise<Boolean>} - True si se envió correctamente
 */
export const sendWhatsAppTemplate = async (to, templateName, templateData) => {
  return await sendWhatsAppMessage({
    to,
    templateName,
    templateData
  });
}; 