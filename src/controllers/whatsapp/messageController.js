import messageService from '../../services/whatsapp/messageService.js';
import logger from '../../config/logger.js';
import infobipService from '../../services/whatsapp/infobipService.js';

// Enviar un mensaje de texto
export const sendTextMessage = async (req, res) => {
  try {
    const { to, text } = req.body;
    
    // Validar datos requeridos
    if (!to || !text) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono y el texto del mensaje son obligatorios'
      });
    }
    
    // Validar formato básico del teléfono (debe tener al menos 10 dígitos)
    const phoneDigits = to.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe contener al menos 10 dígitos'
      });
    }
    
    // Log de depuración
    logger.debug(`Intentando enviar mensaje a ${to}`, { 
      phoneDigits,
      text: text.substring(0, 30) + (text.length > 30 ? '...' : '')
    });
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Enviar mensaje
    const result = await messageService.sendText(to, text, options);
    
    if (!result.success) {
      logger.warn(`Error al enviar mensaje a ${to}`, { 
        error: result.error,
        details: result.details || {}
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje',
        error: result.error,
        details: result.details || {}
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: result.message
    });
  } catch (error) {
    logger.error(`Error al enviar mensaje de texto: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje',
      error: error.message
    });
  }
};

// Enviar un mensaje con plantilla
export const sendTemplateMessage = async (req, res) => {
  try {
    const { to, templateName, language, parameters } = req.body;
    
    // Validar datos requeridos
    if (!to || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono y el nombre de la plantilla son obligatorios'
      });
    }
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Enviar mensaje con plantilla
    const result = await messageService.sendTemplate(
      to, 
      templateName, 
      language || 'es', 
      parameters || {}, 
      options
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje con plantilla',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mensaje con plantilla enviado exitosamente',
      data: result.message
    });
  } catch (error) {
    logger.error(`Error al enviar mensaje con plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje con plantilla',
      error: error.message
    });
  }
};

// Enviar un mensaje con imagen
export const sendImageMessage = async (req, res) => {
  try {
    const { to, imageUrl, caption } = req.body;
    
    // Validar datos requeridos
    if (!to || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono y la URL de la imagen son obligatorios'
      });
    }
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Enviar mensaje con imagen
    const result = await messageService.sendImage(to, imageUrl, caption || '', options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje con imagen',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mensaje con imagen enviado exitosamente',
      data: result.message
    });
  } catch (error) {
    logger.error(`Error al enviar mensaje con imagen: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje con imagen',
      error: error.message
    });
  }
};

// Webhook para recibir mensajes
export const webhookReceiver = async (req, res) => {
  try {
    // Verificación de la URL del webhook (cuando se configura)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      // Verificar token configurado en el servidor
      const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'evolution_webhook_token';
      
      if (mode === 'subscribe' && token === verifyToken) {
        logger.info('Webhook verificado correctamente');
        return res.status(200).send(challenge);
      } else {
        logger.warn('Verificación de webhook fallida', { mode, token });
        return res.sendStatus(403);
      }
    }
    
    // Procesamiento de webhook (POST)
    logger.info('Webhook de WhatsApp recibido', { 
      body: typeof req.body === 'object' ? 'Object' : typeof req.body,
      size: JSON.stringify(req.body).length
    });
    
    const data = req.body;
    
    // Diferentes estructuras según el tipo de notificación
    if (data.statuses) {
      // Notificaciones de estado de mensajes
      for (const status of data.statuses) {
        await messageService.processStatusNotification(status);
      }
    } else if (data.messages) {
      // Mensajes entrantes
      for (const message of data.messages) {
        await messageService.processIncomingMessage(message);
      }
    } else if (data.results) {
      // Formato de Infobip
      for (const result of data.results) {
        if (result.message) {
          await messageService.processIncomingMessage(result);
        } else if (result.status) {
          await messageService.processStatusNotification(result);
        }
      }
    }
    
    // Siempre responder 200 OK para confirmar recepción
    return res.status(200).json({ status: 'received' });
  } catch (error) {
    logger.error(`Error procesando webhook de WhatsApp: ${error.message}`, { error });
    // Aún con error, enviar 200 para evitar reenvíos
    return res.status(200).json({ status: 'error', message: error.message });
  }
};

// Obtener conversaciones
export const getConversations = async (req, res) => {
  try {
    // Filtros desde query params
    const filters = {
      local: req.query.local,
      relatedUser: req.query.userId,
      search: req.query.search,
    };
    
    // Si el usuario es admin, solo puede ver conversaciones de su local
    if (req.userRole === 'admin' && req.user.local) {
      filters.local = req.user.local;
    }
    
    // Opciones de paginación
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    
    const result = await messageService.getConversations(filters, options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener conversaciones',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error(`Error al obtener conversaciones: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener conversaciones',
      error: error.message
    });
  }
};

// Obtener mensajes de una conversación
export const getConversationMessages = async (req, res) => {
  try {
    const { contactNumber } = req.params;
    
    // Opciones de paginación
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    };
    
    const result = await messageService.getConversationMessages(contactNumber, options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener mensajes',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error(`Error al obtener mensajes de conversación: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  }
};

// Enviar un mensaje con la plantilla personalizada de Evolution
export const sendEvolutionTemplateMessage = async (req, res) => {
  try {
    const { to, nombre, mensaje } = req.body;
    
    // Validar datos requeridos
    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono es obligatorio'
      });
    }
    
    // Validar formato básico del teléfono (debe tener al menos 10 dígitos)
    const phoneDigits = to.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe contener al menos 10 dígitos'
      });
    }
    
    // Log de depuración
    logger.debug(`Intentando enviar plantilla personalizada a ${to}`, { 
      phoneDigits,
      nombre: nombre || 'Cliente',
      mensaje: mensaje ? (mensaje.substring(0, 30) + (mensaje.length > 30 ? '...' : '')) : 'No especificado'
    });
    
    // Preparar parámetros para la plantilla
    const parameters = {
      body: [
        { type: "text", text: nombre || "Cliente" }, // Para la variable {{1}} - nombre del cliente
      ]
    };
    
    // Si hay mensaje personalizado, agregarlo como segundo parámetro
    if (mensaje) {
      parameters.body.push({ type: "text", text: mensaje });
    }
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName || nombre,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // ID de la plantilla personalizada
    const templateName = "889156436513322";
    
    // Enviar mensaje con plantilla
    const result = await messageService.sendTemplate(
      to, 
      templateName, 
      "es", 
      parameters, 
      options
    );
    
    if (!result.success) {
      logger.warn(`Error al enviar plantilla personalizada a ${to}`, { 
        error: result.error,
        details: result.details || {}
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje con plantilla personalizada',
        error: result.error,
        details: result.details || {}
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mensaje con plantilla personalizada enviado exitosamente',
      data: result.message
    });
  } catch (error) {
    logger.error(`Error al enviar plantilla personalizada: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje con plantilla personalizada',
      error: error.message
    });
  }
};

// Enviar un mensaje con la plantilla de prueba de WhatsApp en inglés
export const sendTestWhatsAppTemplate = async (req, res) => {
  try {
    const { to, name } = req.body;
    
    // Validar datos requeridos
    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono es obligatorio'
      });
    }
    
    // Validar formato básico del teléfono (debe tener al menos 10 dígitos)
    const phoneDigits = to.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe contener al menos 10 dígitos'
      });
    }
    
    // Log de depuración
    logger.debug(`Intentando enviar plantilla de prueba en inglés a ${to}`, { 
      phoneDigits,
      name: name || 'Nahuel'
    });
    
    // Preparar parámetros para la plantilla según el nuevo formato
    const parameters = {
      body: {
        placeholders: [name || "Nahuel"]
      }
    };
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName || name,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Enviar mensaje con plantilla
    const result = await messageService.sendTemplate(
      to, 
      "test_whatsapp_template_en", 
      "en", 
      parameters, 
      options
    );
    
    if (!result.success) {
      logger.warn(`Error al enviar plantilla de prueba en inglés a ${to}`, { 
        error: result.error,
        details: result.details || {}
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje con plantilla de prueba',
        error: result.error,
        details: result.details || {}
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Mensaje con plantilla de prueba enviado exitosamente',
      data: result.message
    });
  } catch (error) {
    logger.error(`Error al enviar plantilla de prueba: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje con plantilla de prueba',
      error: error.message
    });
  }
};

// Enviar mensaje de texto a múltiples destinatarios
export const sendBulkTextMessage = async (req, res) => {
  try {
    const { numbers, text } = req.body;
    
    // Validar datos requeridos
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0 || !text) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de números de teléfono y el texto del mensaje'
      });
    }
    
    // Limitar el número de destinatarios por solicitud (opcional, ajustar según necesidades)
    if (numbers.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El máximo número de destinatarios por solicitud es 100'
      });
    }
    
    logger.info(`Iniciando envío masivo a ${numbers.length} destinatarios`);
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Array para almacenar resultados
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Enviar mensajes de forma secuencial
    for (const to of numbers) {
      try {
        // Log de depuración
        logger.debug(`Enviando mensaje a ${to}`, { 
          phoneDigits: to.replace(/\D/g, ''),
          text: text.substring(0, 30) + (text.length > 30 ? '...' : '')
        });
        
        // Enviar mensaje
        const result = await messageService.sendText(to, text, options);
        
        if (result.success) {
          results.push({
            to,
            success: true,
            messageId: result.message.messageId
          });
          successCount++;
        } else {
          results.push({
            to,
            success: false,
            error: result.error,
            details: result.details || {}
          });
          failCount++;
          
          logger.warn(`Error al enviar mensaje a ${to}`, { 
            error: result.error,
            details: result.details || {}
          });
        }
      } catch (error) {
        results.push({
          to,
          success: false,
          error: error.message
        });
        failCount++;
        
        logger.error(`Error al procesar número ${to}: ${error.message}`);
      }
      
      // Pequeña pausa entre mensajes para no sobrecargar la API (opcional)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`Envío masivo completado. Éxitos: ${successCount}, Fallos: ${failCount}`);
    
    res.status(200).json({
      success: true,
      message: `Proceso de envío masivo completado. ${successCount} mensajes enviados, ${failCount} fallos.`,
      results
    });
  } catch (error) {
    logger.error(`Error en envío masivo: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al procesar envío masivo',
      error: error.message
    });
  }
};

// Enviar plantilla a múltiples destinatarios
export const sendBulkTemplateMessage = async (req, res) => {
  try {
    const { numbers, templateName, language, parameters } = req.body;
    
    // Validar datos requeridos
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0 || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de números de teléfono y el nombre de la plantilla'
      });
    }
    
    // Limitar el número de destinatarios por solicitud
    if (numbers.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El máximo número de destinatarios por solicitud es 100'
      });
    }
    
    logger.info(`Iniciando envío masivo de plantilla "${templateName}" a ${numbers.length} destinatarios`);
    
    // Preparar opciones adicionales
    const options = {
      contactName: req.body.contactName,
      relatedUser: req.userId,
      local: req.body.local || (req.user?.local ? req.user.local : null),
    };
    
    // Array para almacenar resultados
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Enviar mensajes de forma secuencial
    for (const to of numbers) {
      try {
        // Log de depuración
        logger.debug(`Enviando plantilla "${templateName}" a ${to}`);
        
        // Enviar mensaje con plantilla
        const result = await messageService.sendTemplate(
          to, 
          templateName, 
          language || 'es', 
          parameters || {}, 
          options
        );
        
        if (result.success) {
          results.push({
            to,
            success: true,
            messageId: result.message.messageId
          });
          successCount++;
        } else {
          results.push({
            to,
            success: false,
            error: result.error,
            details: result.details || {}
          });
          failCount++;
          
          logger.warn(`Error al enviar plantilla a ${to}`, { 
            error: result.error,
            details: result.details || {}
          });
        }
      } catch (error) {
        results.push({
          to,
          success: false,
          error: error.message
        });
        failCount++;
        
        logger.error(`Error al procesar número ${to}: ${error.message}`);
      }
      
      // Pequeña pausa entre mensajes para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`Envío masivo de plantilla completado. Éxitos: ${successCount}, Fallos: ${failCount}`);
    
    res.status(200).json({
      success: true,
      message: `Proceso de envío masivo de plantilla completado. ${successCount} mensajes enviados, ${failCount} fallos.`,
      results
    });
  } catch (error) {
    logger.error(`Error en envío masivo de plantilla: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al procesar envío masivo de plantilla',
      error: error.message
    });
  }
};

// Verificar si un número está en la whitelist
export const checkWhitelistStatus = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono es obligatorio'
      });
    }
    
    // Validar formato básico del teléfono
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe contener al menos 10 dígitos'
      });
    }
    
    logger.info(`Verificando estado en whitelist para ${phoneNumber}`);
    
    // Verificar si el número está en la whitelist
    const checkResult = await infobipService.checkPhoneNumber(phoneNumber);
    
    if (checkResult.success && checkResult.isValid) {
      return res.status(200).json({
        success: true,
        message: 'El número está registrado en WhatsApp y habilitado para recibir mensajes',
        phoneNumber,
        inWhitelist: true,
        details: checkResult.response
      });
    } else {
      // Intentar agregar a la whitelist (esto es informativo, ya que requiere contactar a soporte)
      const whitelistResult = await infobipService.addToWhitelist(phoneNumber);
      
      return res.status(200).json({
        success: false,
        message: 'El número no está habilitado para recibir mensajes en la cuenta demo',
        phoneNumber,
        inWhitelist: false,
        whitelistInfo: whitelistResult,
        details: checkResult.response || checkResult.error
      });
    }
  } catch (error) {
    logger.error(`Error al verificar whitelist: ${error.message}`, { 
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado en whitelist',
      error: error.message
    });
  }
}; 