import { Router } from 'express';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplates
} from '../../controllers/whatsapp/templateController.js';
import { verifyToken, isAdmin, isSuperAdmin } from '../../middlewares/authMiddleware.js';
import {
  validateCreateTemplate,
  validateUpdateTemplate
} from '../../middlewares/whatsapp/validationMiddleware.js';

const router = Router();

/**
 * @route GET /api/whatsapp/templates
 * @desc Obtener todas las plantillas
 * @access Privado (admin o superAdmin)
 */
router.get('/', verifyToken, isAdmin, getAllTemplates);

/**
 * @route GET /api/whatsapp/templates/:templateId
 * @desc Obtener una plantilla por ID
 * @access Privado (admin o superAdmin)
 */
router.get('/:templateId', verifyToken, isAdmin, getTemplateById);

/**
 * @route POST /api/whatsapp/templates
 * @desc Crear una nueva plantilla
 * @access Privado (admin o superAdmin)
 */
router.post('/', verifyToken, isAdmin, validateCreateTemplate, createTemplate);

/**
 * @route PUT /api/whatsapp/templates/:templateId
 * @desc Actualizar una plantilla existente
 * @access Privado (admin o superAdmin)
 */
router.put('/:templateId', verifyToken, isAdmin, validateUpdateTemplate, updateTemplate);

/**
 * @route DELETE /api/whatsapp/templates/:templateId
 * @desc Eliminar una plantilla
 * @access Privado (admin o superAdmin)
 */
router.delete('/:templateId', verifyToken, isAdmin, deleteTemplate);

/**
 * @route POST /api/whatsapp/templates/sync
 * @desc Sincronizar plantillas con el proveedor
 * @access Privado (solo superAdmin)
 */
router.post('/sync', verifyToken, isSuperAdmin, syncTemplates);

export default router; 