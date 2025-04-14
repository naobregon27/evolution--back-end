import axios from 'axios';
import logger from '../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Configuración de la API de Infobip
const INFOBIP_API_URL = `https://${process.env.WHATSAPP_API_URL || 'api.infobip.com'}`;
const INFOBIP_API_KEY = process.env.WHATSAPP_API_KEY || '';
// Eliminar el signo + del número de teléfono para Infobip y manejar caso undefined
const WHATSAPP_PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER 
  ? (process.env.WHATSAPP_PHONE_NUMBER.startsWith('+') 
      ? process.env.WHATSAPP_PHONE_NUMBER.substring(1) 
      : process.env.WHATSAPP_PHONE_NUMBER)
  : '';

// Advertir si faltan configuraciones importantes
if (!process.env.WHATSAPP_API_URL) {
  logger.warn('WHATSAPP_API_URL no está definida en las variables de entorno');
}
if (!process.env.WHATSAPP_API_KEY) {
  logger.warn('WHATSAPP_API_KEY no está definida en las variables de entorno');
}
if (!process.env.WHATSAPP_PHONE_NUMBER) {
  logger.warn('WHATSAPP_PHONE_NUMBER no está definida en las variables de entorno');
}

// Cliente HTTP para Infobip
const infobipClient = axios.create({
  baseURL: INFOBIP_API_URL,
  headers: {
    'Authorization': `App ${INFOBIP_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor para log de respuestas
infobipClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Log más detallado del error
    logger.error(`Error en Infobip API: ${error.message}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      payload: error.config?.data ? JSON.parse(error.config.data) : null,
      headers: error.config?.headers,
    });
    return Promise.reject(error);
  }
);

/**
 * Envía un mensaje de texto a través de WhatsApp
 * @param {string} to - Número de teléfono del destinatario (con formato internacional)
 * @param {string} text - Texto del mensaje
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const sendTextMessage = async (to, text, options = {}) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY || !WHATSAPP_PHONE_NUMBER) {
      logger.error('Falta configuración de WhatsApp. No se puede enviar mensaje de texto');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { 
          missingApiKey: !INFOBIP_API_KEY, 
          missingPhoneNumber: !WHATSAPP_PHONE_NUMBER 
        }
      };
    }
    
    const messageId = options.messageId || uuidv4();
    
    // Limpiar el número de teléfono (asegurar que no tenga +, espacios o caracteres especiales)
    const cleanTo = to.replace(/[^\d]/g, '');
    
    const payload = {
      messages: [
        {
          from: WHATSAPP_PHONE_NUMBER,
          to: cleanTo,
          messageId,
          content: {
            text
          }
        }
      ]
    };

    // Log detallado del payload antes de enviarlo
    logger.info('Enviando mensaje a Infobip:', {
      endpoint: '/whatsapp/1/message/text',
      payload: JSON.stringify(payload),
      to: cleanTo,
      originalTo: to
    });

    const response = await infobipClient.post('/whatsapp/1/message/text', payload);
    
    logger.info(`Mensaje de texto enviado a ${cleanTo}`, {
      messageId,
      status: response.data?.messages?.[0]?.status?.name,
      response: response.data
    });
    
    return {
      success: true,
      messageId,
      response: response.data,
    };
  } catch (error) {
    logger.error(`Error al enviar mensaje de texto a ${to}: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Envía un mensaje con plantilla a través de WhatsApp
 * @param {string} to - Número de teléfono del destinatario (con formato internacional)
 * @param {string} templateName - Nombre de la plantilla
 * @param {string} language - Código de idioma (ej: 'es')
 * @param {Object} parameters - Parámetros para la plantilla
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const sendTemplateMessage = async (to, templateName, language, parameters = {}, options = {}) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY || !WHATSAPP_PHONE_NUMBER) {
      logger.error('Falta configuración de WhatsApp. No se puede enviar mensaje con plantilla');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { 
          missingApiKey: !INFOBIP_API_KEY, 
          missingPhoneNumber: !WHATSAPP_PHONE_NUMBER 
        }
      };
    }
    
    const messageId = options.messageId || uuidv4();
    
    // Limpiar el número de teléfono
    const cleanTo = to.replace(/[^\d]/g, '');
    
    // Preparar payload según la nueva estructura de Infobip
    const payload = {
      messages: [
        {
          from: WHATSAPP_PHONE_NUMBER,
          to: cleanTo,
          messageId,
          content: {
            templateName,
            language,
            templateData: {}
          }
        }
      ]
    };

    // Agregar parámetros a los componentes según la nueva estructura
    if (parameters.body) {
      // Convertir del formato anterior al nuevo formato
      // Si es un array de objetos { type, text }, extraer solo los valores de texto para placeholders
      if (Array.isArray(parameters.body)) {
        payload.messages[0].content.templateData.body = {
          placeholders: parameters.body.map(item => item.text || item)
        };
      } else {
        payload.messages[0].content.templateData.body = parameters.body;
      }
    }
    
    if (parameters.header) {
      if (Array.isArray(parameters.header)) {
        payload.messages[0].content.templateData.header = {
          placeholders: parameters.header.map(item => item.text || item)
        };
      } else {
        payload.messages[0].content.templateData.header = parameters.header;
      }
    }
    
    if (parameters.buttons) {
      if (Array.isArray(parameters.buttons)) {
        payload.messages[0].content.templateData.buttons = {
          placeholders: parameters.buttons.map(item => item.text || item)
        };
      } else {
        payload.messages[0].content.templateData.buttons = parameters.buttons;
      }
    }

    // Log detallado del payload antes de enviarlo
    logger.info('Enviando plantilla a Infobip:', {
      endpoint: '/whatsapp/1/message/template',
      payload: JSON.stringify(payload),
      to: cleanTo,
      originalTo: to,
      templateName
    });

    const response = await infobipClient.post('/whatsapp/1/message/template', payload);
    
    logger.info(`Mensaje de plantilla "${templateName}" enviado a ${cleanTo}`, {
      messageId,
      status: response.data?.messages?.[0]?.status?.name,
      response: response.data
    });
    
    return {
      success: true,
      messageId,
      response: response.data,
    };
  } catch (error) {
    logger.error(`Error al enviar plantilla "${templateName}" a ${to}: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Envía una imagen a través de WhatsApp
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} imageUrl - URL de la imagen
 * @param {string} caption - Texto opcional para la imagen
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const sendImageMessage = async (to, imageUrl, caption = '', options = {}) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY || !WHATSAPP_PHONE_NUMBER) {
      logger.error('Falta configuración de WhatsApp. No se puede enviar mensaje con imagen');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { 
          missingApiKey: !INFOBIP_API_KEY, 
          missingPhoneNumber: !WHATSAPP_PHONE_NUMBER 
        }
      };
    }
    
    const messageId = options.messageId || uuidv4();
    
    // Limpiar el número de teléfono
    const cleanTo = to.replace(/[^\d]/g, '');
    
    const payload = {
      messages: [
        {
          from: WHATSAPP_PHONE_NUMBER,
          to: cleanTo,
          messageId,
          content: {
            mediaUrl: imageUrl,
            caption
          }
        }
      ]
    };

    // Log detallado del payload antes de enviarlo
    logger.info('Enviando imagen a Infobip:', {
      endpoint: '/whatsapp/1/message/image',
      payload: JSON.stringify(payload),
      to: cleanTo,
      originalTo: to
    });

    const response = await infobipClient.post('/whatsapp/1/message/image', payload);
    
    logger.info(`Mensaje de imagen enviado a ${cleanTo}`, {
      messageId,
      status: response.data?.messages?.[0]?.status?.name,
      response: response.data
    });
    
    return {
      success: true,
      messageId,
      response: response.data,
    };
  } catch (error) {
    logger.error(`Error al enviar imagen a ${to}: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Envía un documento a través de WhatsApp
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} documentUrl - URL del documento
 * @param {string} fileName - Nombre del archivo
 * @param {string} caption - Texto opcional para el documento
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const sendDocumentMessage = async (to, documentUrl, fileName, caption = '', options = {}) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY || !WHATSAPP_PHONE_NUMBER) {
      logger.error('Falta configuración de WhatsApp. No se puede enviar mensaje con documento');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { 
          missingApiKey: !INFOBIP_API_KEY, 
          missingPhoneNumber: !WHATSAPP_PHONE_NUMBER 
        }
      };
    }
    
    const messageId = options.messageId || uuidv4();
    
    // Limpiar el número de teléfono
    const cleanTo = to.replace(/[^\d]/g, '');
    
    const payload = {
      messages: [
        {
          from: WHATSAPP_PHONE_NUMBER,
          to: cleanTo,
          messageId,
          content: {
            mediaUrl: documentUrl,
            fileName,
            caption
          }
        }
      ]
    };

    // Log detallado del payload antes de enviarlo
    logger.info('Enviando documento a Infobip:', {
      endpoint: '/whatsapp/1/message/document',
      payload: JSON.stringify(payload),
      to: cleanTo,
      originalTo: to
    });

    const response = await infobipClient.post('/whatsapp/1/message/document', payload);
    
    logger.info(`Mensaje de documento enviado a ${cleanTo}`, {
      messageId,
      fileName,
      status: response.data?.messages?.[0]?.status?.name,
      response: response.data
    });
    
    return {
      success: true,
      messageId,
      response: response.data,
    };
  } catch (error) {
    logger.error(`Error al enviar documento a ${to}: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Obtiene las plantillas disponibles
 * @returns {Promise<Object>} - Respuesta de la API con las plantillas
 */
export const getTemplates = async () => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY) {
      logger.error('Falta configuración de WhatsApp. No se pueden obtener plantillas');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { missingApiKey: !INFOBIP_API_KEY }
      };
    }
    
    const response = await infobipClient.get('/whatsapp/1/template');
    
    logger.info(`Se obtuvieron ${response.data.templates?.length || 0} plantillas`);
    
    return {
      success: true,
      templates: response.data.templates || [],
    };
  } catch (error) {
    logger.error(`Error al obtener plantillas: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Verifica si un número de teléfono está registrado en WhatsApp
 * @param {string} phoneNumber - Número de teléfono a verificar
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const checkPhoneNumber = async (phoneNumber) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY) {
      logger.error('Falta configuración de WhatsApp. No se puede verificar el número');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { missingApiKey: !INFOBIP_API_KEY }
      };
    }
    
    // Limpiar el número de teléfono
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    
    const payload = {
      to: cleanPhone
    };

    const response = await infobipClient.post('/whatsapp/1/phone', payload);
    
    return {
      success: true,
      isValid: response.data?.verified || false,
      response: response.data,
    };
  } catch (error) {
    logger.error(`Error al verificar número ${phoneNumber}: ${error.message}`, {
      details: error.response?.data?.requestError?.serviceException || error.response?.data
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};

/**
 * Añade un número a la whitelist de la cuenta de Infobip (solo cuentas demo)
 * @param {string} phoneNumber - Número de teléfono a registrar
 * @returns {Promise<Object>} - Respuesta de la operación
 */
export const addToWhitelist = async (phoneNumber) => {
  try {
    // Comprobar si tenemos la configuración necesaria
    if (!INFOBIP_API_KEY) {
      logger.error('Falta configuración de WhatsApp. No se puede añadir número a whitelist');
      return {
        success: false,
        error: 'WhatsApp no está configurado correctamente',
        details: { missingApiKey: !INFOBIP_API_KEY }
      };
    }
    
    // Limpiar el número de teléfono
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    
    // Verificar si el número ya está en la whitelist usando checkPhoneNumber
    const checkResult = await checkPhoneNumber(cleanPhone);
    
    if (checkResult.success && checkResult.isValid) {
      return {
        success: true,
        message: 'El número ya está registrado en la whitelist',
        phoneNumber: cleanPhone
      };
    }
    
    // Si estás en una cuenta de demo, esta es una API ficticia ya que Infobip no proporciona
    // una API pública para modificar la whitelist. Deberás contactar con soporte para esto.
    logger.info(`Intentando registrar ${cleanPhone} en la whitelist de Infobip`);
    logger.warn('Esta operación requiere contactar al soporte de Infobip para cuentas demo');
    
    return {
      success: false,
      message: 'Para agregar números a la whitelist en una cuenta demo, contacta al soporte de Infobip',
      info: 'En cuentas de producción esta restricción no existe',
      phoneNumber: cleanPhone
    };
  } catch (error) {
    logger.error(`Error al agregar número ${phoneNumber} a la whitelist: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  sendDocumentMessage,
  getTemplates,
  checkPhoneNumber,
  addToWhitelist,
}; 