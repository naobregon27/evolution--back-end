import Message from '../../models/whatsapp/Message.js';
import Contact from '../../models/whatsapp/Contact.js';
import infobipService from './infobipService.js';
import logger from '../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Servicio para gestionar mensajes de WhatsApp
const messageService = {
  /**
   * Envía un mensaje de texto y lo guarda en la base de datos
   * @param {string} to - Número de teléfono del destinatario
   * @param {string} text - Texto del mensaje
   * @param {Object} options - Opciones adicionales (local, relatedUser, etc.)
   * @returns {Promise<Object>} - Resultado del envío y el mensaje guardado
   */
  async sendText(to, text, options = {}) {
    try {
      const messageId = options.messageId || uuidv4();
      const businessNumber = process.env.WHATSAPP_PHONE_NUMBER;
      
      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(to);
      
      // Enviar mensaje a través de Infobip
      const result = await infobipService.sendTextMessage(normalizedPhone, text, { 
        messageId,
        ...options 
      });
      
      if (!result.success) {
        logger.error(`Error al enviar mensaje de texto a ${normalizedPhone}: ${result.error}`);
        return result;
      }
      
      // Guardar mensaje en la base de datos
      const message = await Message.create({
        messageId,
        direction: 'outbound',
        type: 'text',
        content: { text },
        contactNumber: normalizedPhone,
        contactName: options.contactName,
        businessNumber,
        status: 'sent',
        relatedUser: options.relatedUser,
        local: options.local,
        sentAt: new Date(),
        rawResponse: result.response,
      });
      
      // Actualizar o crear contacto
      await this.updateContact(normalizedPhone, {
        messagesSent: 1,
        lastOutgoingMessage: new Date(),
        lastActivity: new Date(),
        relatedUser: options.relatedUser,
        local: options.local,
      });
      
      return {
        success: true,
        message,
        apiResponse: result.response,
      };
    } catch (error) {
      logger.error(`Error en servicio de mensajes (sendText): ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Envía un mensaje con plantilla y lo guarda en la base de datos
   * @param {string} to - Número de teléfono del destinatario
   * @param {string} templateName - Nombre de la plantilla
   * @param {string} language - Código de idioma (ej: 'es')
   * @param {Object} parameters - Parámetros para la plantilla
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Resultado del envío y el mensaje guardado
   */
  async sendTemplate(to, templateName, language = 'es', parameters = {}, options = {}) {
    try {
      const messageId = options.messageId || uuidv4();
      const businessNumber = process.env.WHATSAPP_PHONE_NUMBER;
      
      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(to);
      
      // Enviar mensaje a través de Infobip
      const result = await infobipService.sendTemplateMessage(
        normalizedPhone, 
        templateName, 
        language, 
        parameters, 
        { messageId, ...options }
      );
      
      if (!result.success) {
        logger.error(`Error al enviar plantilla a ${normalizedPhone}: ${result.error}`);
        return result;
      }
      
      // Guardar mensaje en la base de datos
      const message = await Message.create({
        messageId,
        direction: 'outbound',
        type: 'template',
        content: { 
          templateName,
          templateData: {
            language,
            parameters,
          }
        },
        contactNumber: normalizedPhone,
        contactName: options.contactName,
        businessNumber,
        status: 'sent',
        relatedUser: options.relatedUser,
        local: options.local,
        sentAt: new Date(),
        rawResponse: result.response,
      });
      
      // Actualizar o crear contacto
      await this.updateContact(normalizedPhone, {
        messagesSent: 1,
        lastOutgoingMessage: new Date(),
        lastActivity: new Date(),
        relatedUser: options.relatedUser,
        local: options.local,
      });
      
      return {
        success: true,
        message,
        apiResponse: result.response,
      };
    } catch (error) {
      logger.error(`Error en servicio de mensajes (sendTemplate): ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Envía una imagen y la guarda en la base de datos
   * @param {string} to - Número de teléfono del destinatario
   * @param {string} imageUrl - URL de la imagen
   * @param {string} caption - Texto opcional para la imagen
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} - Resultado del envío y el mensaje guardado
   */
  async sendImage(to, imageUrl, caption = '', options = {}) {
    try {
      const messageId = options.messageId || uuidv4();
      const businessNumber = process.env.WHATSAPP_PHONE_NUMBER;
      
      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(to);
      
      // Enviar imagen a través de Infobip
      const result = await infobipService.sendImageMessage(
        normalizedPhone, 
        imageUrl, 
        caption, 
        { messageId, ...options }
      );
      
      if (!result.success) {
        logger.error(`Error al enviar imagen a ${normalizedPhone}: ${result.error}`);
        return result;
      }
      
      // Guardar mensaje en la base de datos
      const message = await Message.create({
        messageId,
        direction: 'outbound',
        type: 'image',
        content: { 
          mediaUrl: imageUrl,
          caption,
        },
        contactNumber: normalizedPhone,
        contactName: options.contactName,
        businessNumber,
        status: 'sent',
        relatedUser: options.relatedUser,
        local: options.local,
        sentAt: new Date(),
        rawResponse: result.response,
      });
      
      // Actualizar o crear contacto
      await this.updateContact(normalizedPhone, {
        messagesSent: 1,
        lastOutgoingMessage: new Date(),
        lastActivity: new Date(),
        relatedUser: options.relatedUser,
        local: options.local,
      });
      
      return {
        success: true,
        message,
        apiResponse: result.response,
      };
    } catch (error) {
      logger.error(`Error en servicio de mensajes (sendImage): ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Procesa un mensaje entrante de WhatsApp
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} - Mensaje procesado
   */
  async processIncomingMessage(webhookData) {
    try {
      // Extraer información relevante del webhook
      const {
        messageId,
        from,
        to,
        message,
        contact,
        receivedAt,
      } = this.parseWebhookData(webhookData);
      
      if (!messageId || !from || !to || !message) {
        logger.warn('Datos insuficientes en webhook de WhatsApp', { webhookData });
        return { success: false, error: 'Datos insuficientes' };
      }
      
      // Verificar si el mensaje ya existe
      const existingMessage = await Message.findOne({ messageId });
      if (existingMessage) {
        logger.info(`Mensaje con ID ${messageId} ya procesado anteriormente`);
        return { success: true, message: existingMessage, alreadyProcessed: true };
      }
      
      // Preparar datos básicos del mensaje
      const messageData = {
        messageId,
        direction: 'inbound',
        type: message.type,
        contactNumber: from,
        contactName: contact?.name || '',
        businessNumber: to,
        status: 'received',
        sentAt: new Date(receivedAt),
        rawResponse: webhookData,
      };
      
      // Extraer contenido según el tipo de mensaje
      switch (message.type) {
        case 'text':
          messageData.content = { text: message.text.body };
          break;
        case 'image':
          messageData.content = { 
            mediaUrl: message.image.url,
            caption: message.image.caption || '',
            mimeType: message.image.mime_type,
          };
          break;
        case 'video':
          messageData.content = { 
            mediaUrl: message.video.url,
            caption: message.video.caption || '',
            mimeType: message.video.mime_type,
          };
          break;
        case 'document':
          messageData.content = { 
            mediaUrl: message.document.url,
            fileName: message.document.filename,
            mimeType: message.document.mime_type,
          };
          break;
        case 'location':
          messageData.content = { 
            latitude: message.location.latitude,
            longitude: message.location.longitude,
          };
          break;
        case 'interactive':
          messageData.content = { interactive: message.interactive };
          break;
        default:
          messageData.content = { text: 'Tipo de mensaje no soportado' };
          messageData.type = 'unsupported';
      }
      
      // Buscar contacto existente para obtener relaciones
      const existingContact = await Contact.findOne({ phoneNumber: from });
      if (existingContact) {
        messageData.relatedUser = existingContact.relatedUser;
        messageData.local = existingContact.local;
      }
      
      // Guardar mensaje en la base de datos
      const savedMessage = await Message.create(messageData);
      
      // Actualizar o crear contacto
      await this.updateContact(from, {
        messagesReceived: 1,
        lastIncomingMessage: new Date(),
        lastActivity: new Date(),
        name: contact?.name || existingContact?.name,
        waId: contact?.wa_id || existingContact?.waId,
        relatedUser: existingContact?.relatedUser,
        local: existingContact?.local,
      });
      
      logger.info(`Mensaje entrante procesado: ${messageId} de ${from}`);
      
      return {
        success: true,
        message: savedMessage,
      };
    } catch (error) {
      logger.error(`Error procesando mensaje entrante: ${error.message}`, { error });
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Actualiza el estado de un mensaje
   * @param {string} messageId - ID del mensaje
   * @param {string} status - Nuevo estado
   * @param {Object} additionalData - Datos adicionales
   * @returns {Promise<Object>} - Mensaje actualizado
   */
  async updateMessageStatus(messageId, status, additionalData = {}) {
    try {
      const updateData = { status, ...additionalData };
      
      // Agregar timestamps según el estado
      if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (status === 'read') {
        updateData.readAt = new Date();
      }
      
      const message = await Message.findOneAndUpdate(
        { messageId },
        { $set: updateData },
        { new: true }
      );
      
      if (!message) {
        logger.warn(`No se encontró mensaje con ID ${messageId} para actualizar estado`);
        return { success: false, error: 'Mensaje no encontrado' };
      }
      
      logger.info(`Estado de mensaje ${messageId} actualizado a: ${status}`);
      
      return {
        success: true,
        message,
      };
    } catch (error) {
      logger.error(`Error actualizando estado de mensaje: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Procesa una notificación de estado de mensaje
   * @param {Object} webhookData - Datos del webhook
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async processStatusNotification(webhookData) {
    try {
      // Extraer información relevante del webhook
      const status = webhookData.status?.status || '';
      const messageId = webhookData.messageId || '';
      
      if (!messageId || !status) {
        logger.warn('Datos insuficientes en notificación de estado', { webhookData });
        return { success: false, error: 'Datos insuficientes' };
      }
      
      // Mapear estados de Infobip a nuestros estados
      let mappedStatus;
      switch (status.toLowerCase()) {
        case 'delivered':
          mappedStatus = 'delivered';
          break;
        case 'seen':
        case 'read':
          mappedStatus = 'read';
          break;
        case 'failed':
        case 'rejected':
          mappedStatus = 'failed';
          break;
        default:
          mappedStatus = 'sent';
      }
      
      // Actualizar estado del mensaje
      const result = await this.updateMessageStatus(messageId, mappedStatus, {
        rawResponse: webhookData,
      });
      
      return result;
    } catch (error) {
      logger.error(`Error procesando notificación de estado: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Obtiene conversaciones agrupadas por contacto
   * @param {Object} filters - Filtros para la búsqueda
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Lista de conversaciones
   */
  async getConversations(filters = {}, options = {}) {
    try {
      const { local, relatedUser, search } = filters;
      const { page = 1, limit = 20 } = options;
      
      const matchQuery = {};
      
      if (local) {
        matchQuery.local = local;
      }
      
      if (relatedUser) {
        matchQuery.relatedUser = relatedUser;
      }
      
      if (search) {
        matchQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ];
      }
      
      const contacts = await Contact.find(matchQuery)
        .sort({ lastActivity: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('relatedUser', 'nombre email')
        .populate('local', 'nombre direccion');
      
      // Obtener el último mensaje de cada contacto
      const contactsWithLastMessage = await Promise.all(
        contacts.map(async (contact) => {
          const lastMessage = await Message.findOne({ 
            contactNumber: contact.phoneNumber 
          })
          .sort({ createdAt: -1 })
          .limit(1);
          
          return {
            ...contact.toJSON(),
            lastMessage: lastMessage || null,
          };
        })
      );
      
      // Contar total de contactos
      const total = await Contact.countDocuments(matchQuery);
      
      return {
        success: true,
        data: {
          contacts: contactsWithLastMessage,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error(`Error obteniendo conversaciones: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  /**
   * Obtiene los mensajes de una conversación con un contacto
   * @param {string} contactNumber - Número del contacto
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Object>} - Lista de mensajes
   */
  async getConversationMessages(contactNumber, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      
      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(contactNumber);
      
      // Buscar mensajes del contacto
      const messages = await Message.find({ contactNumber: normalizedPhone })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Contar total de mensajes
      const total = await Message.countDocuments({ contactNumber: normalizedPhone });
      
      // Buscar o crear contacto
      let contact = await Contact.findOne({ phoneNumber: normalizedPhone });
      
      if (!contact) {
        logger.warn(`Contacto para ${normalizedPhone} no encontrado en la base de datos`);
        
        contact = {
          phoneNumber: normalizedPhone,
          status: 'unknown',
        };
      }
      
      return {
        success: true,
        data: {
          contact,
          messages: messages.reverse(), // Ordenar cronológicamente
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error(`Error obteniendo mensajes de conversación: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  // Métodos de utilidad
  
  /**
   * Actualiza o crea un contacto en la base de datos
   * @param {string} phoneNumber - Número de teléfono
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} - Contacto actualizado
   */
  async updateContact(phoneNumber, data = {}) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      // Buscar contacto existente
      let contact = await Contact.findOne({ phoneNumber: normalizedPhone });
      
      if (contact) {
        // Actualizar contadores
        if (data.messagesSent) {
          data.messagesSent = contact.messagesSent + data.messagesSent;
        }
        
        if (data.messagesReceived) {
          data.messagesReceived = contact.messagesReceived + data.messagesReceived;
        }
        
        // Actualizar contacto
        contact = await Contact.findByIdAndUpdate(
          contact._id,
          { $set: data },
          { new: true }
        );
      } else {
        // Crear nuevo contacto
        contact = await Contact.create({
          phoneNumber: normalizedPhone,
          waId: data.waId,
          name: data.name,
          lastActivity: data.lastActivity || new Date(),
          lastIncomingMessage: data.lastIncomingMessage,
          lastOutgoingMessage: data.lastOutgoingMessage,
          messagesSent: data.messagesSent || 0,
          messagesReceived: data.messagesReceived || 0,
          relatedUser: data.relatedUser,
          local: data.local,
          status: 'active',
        });
      }
      
      return contact;
    } catch (error) {
      logger.error(`Error actualizando contacto ${phoneNumber}: ${error.message}`);
      throw error;
    }
  },
  
  /**
   * Normaliza un número de teléfono al formato E.164 sin el signo '+'
   * @param {string} phoneNumber - Número de teléfono
   * @returns {string} - Número normalizado
   */
  normalizePhoneNumber(phoneNumber) {
    // Eliminar espacios, guiones y paréntesis
    let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Primero asegurarse de que tiene el formato internacional con +
    if (!normalized.startsWith('+')) {
      // Si comienza con doble cero, reemplazar por +
      if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2);
      } 
      // Si comienza con cero, asumir que es Argentina (+54)
      else if (normalized.startsWith('0')) {
        normalized = '+54' + normalized.substring(1);
      }
      // Si no tiene prefijo internacional, asumir Argentina
      else if (!normalized.startsWith('54')) {
        normalized = '+54' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }
    
    // Para Infobip: ELIMINAR el signo + antes de retornar
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    
    return normalized;
  },
  
  /**
   * Analiza los datos del webhook para extraer información relevante
   * @param {Object} webhookData - Datos del webhook
   * @returns {Object} - Información extraída
   */
  parseWebhookData(webhookData) {
    try {
      // La estructura puede variar según el proveedor (Infobip en este caso)
      const result = {
        messageId: '',
        from: '',
        to: '',
        message: null,
        contact: null,
        receivedAt: new Date(),
      };
      
      // Extraer datos según la estructura de Infobip
      const messageData = webhookData.results?.[0] || webhookData;
      
      if (messageData) {
        result.messageId = messageData.messageId || '';
        result.from = messageData.from || '';
        result.to = messageData.to || '';
        result.receivedAt = messageData.receivedAt || new Date();
        result.message = messageData.message || null;
        result.contact = messageData.contact || null;
      }
      
      return result;
    } catch (error) {
      logger.error(`Error parseando datos de webhook: ${error.message}`);
      return {};
    }
  },
};

export default messageService; 