import { Router } from 'express';
import {
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  sendEvolutionTemplateMessage,
  sendTestWhatsAppTemplate,
  sendBulkTextMessage,
  sendBulkTemplateMessage,
  checkWhitelistStatus,
  webhookReceiver,
  getConversations,
  getConversationMessages
} from '../../controllers/whatsapp/messageController.js';
import { verifyToken, isAdmin } from '../../middlewares/authMiddleware.js';
import {
  validateTextMessage,
  validateTemplateMessage,
  validateImageMessage
} from '../../middlewares/whatsapp/validationMiddleware.js';

const router = Router();

/**
 * @route POST /api/whatsapp/messages/text
 * @desc Enviar un mensaje de texto por WhatsApp
 * @access Privado (admin o superAdmin)
 */
router.post('/text', verifyToken, isAdmin, validateTextMessage, sendTextMessage);

/**
 * @route POST /api/whatsapp/messages/bulk
 * @desc Enviar mensajes de texto a múltiples destinatarios
 * @access Privado (admin o superAdmin)
 */
router.post('/bulk', verifyToken, isAdmin, sendBulkTextMessage);

/**
 * @route POST /api/whatsapp/messages/template
 * @desc Enviar un mensaje con plantilla por WhatsApp
 * @access Privado (admin o superAdmin)
 */
router.post('/template', verifyToken, isAdmin, validateTemplateMessage, sendTemplateMessage);

/**
 * @route POST /api/whatsapp/messages/bulk-template
 * @desc Enviar mensajes con plantilla a múltiples destinatarios
 * @access Privado (admin o superAdmin)
 */
router.post('/bulk-template', verifyToken, isAdmin, sendBulkTemplateMessage);

/**
 * @route POST /api/whatsapp/messages/check-whitelist
 * @desc Verificar si un número está en la whitelist
 * @access Privado (admin o superAdmin)
 */
router.post('/check-whitelist', verifyToken, isAdmin, checkWhitelistStatus);

/**
 * @route POST /api/whatsapp/messages/evolution-template
 * @desc Enviar un mensaje con la plantilla personalizada de Evolution
 * @access Privado (admin o superAdmin)
 */
router.post('/evolution-template', verifyToken, isAdmin, sendEvolutionTemplateMessage);

/**
 * @route POST /api/whatsapp/messages/test-template
 * @desc Enviar un mensaje con la plantilla de prueba en inglés
 * @access Privado (admin o superAdmin)
 */
router.post('/test-template', verifyToken, isAdmin, sendTestWhatsAppTemplate);

/**
 * @route POST /api/whatsapp/messages/image
 * @desc Enviar un mensaje con imagen por WhatsApp
 * @access Privado (admin o superAdmin)
 */
router.post('/image', verifyToken, isAdmin, validateImageMessage, sendImageMessage);

/**
 * @route GET /api/whatsapp/messages/conversations
 * @desc Obtener todas las conversaciones
 * @access Privado (admin o superAdmin)
 */
router.get('/conversations', verifyToken, isAdmin, getConversations);

/**
 * @route GET /api/whatsapp/messages/conversations/:contactNumber
 * @desc Obtener los mensajes de una conversación
 * @access Privado (admin o superAdmin)
 */
router.get('/conversations/:contactNumber', verifyToken, isAdmin, getConversationMessages);

/**
 * @route POST /api/whatsapp/messages/webhook
 * @desc Recibir webhooks de WhatsApp
 * @access Público (usado por WhatsApp API)
 */
router.post('/webhook', webhookReceiver);

/**
 * @route GET /api/whatsapp/messages/webhook
 * @desc Verificar webhook de WhatsApp
 * @access Público (usado por WhatsApp API para verificación)
 */
router.get('/webhook', webhookReceiver);

export default router; 