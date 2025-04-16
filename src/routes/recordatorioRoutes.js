import { Router } from 'express';
import { 
  getRecordatorios, 
  getRecordatorioById, 
  createRecordatorio, 
  updateRecordatorio, 
  deleteRecordatorio, 
  marcarEnviado,
  getRecordatoriosPendientes
} from '../controllers/recordatorioController.js';
import { verifyToken, hasRole } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @route GET /api/recordatorios
 * @desc Obtener todos los recordatorios
 * @access Privado
 */
router.get('/', verifyToken, getRecordatorios);

/**
 * @route GET /api/recordatorios/:id
 * @desc Obtener un recordatorio por ID
 * @access Privado
 */
router.get('/:id', verifyToken, getRecordatorioById);

/**
 * @route POST /api/recordatorios
 * @desc Crear un nuevo recordatorio
 * @access Privado
 */
router.post('/', verifyToken, createRecordatorio);

/**
 * @route PUT /api/recordatorios/:id
 * @desc Actualizar un recordatorio existente
 * @access Privado
 */
router.put('/:id', verifyToken, updateRecordatorio);

/**
 * @route DELETE /api/recordatorios/:id
 * @desc Eliminar un recordatorio
 * @access Privado
 */
router.delete('/:id', verifyToken, deleteRecordatorio);

/**
 * @route POST /api/recordatorios/:id/marcar-enviado
 * @desc Marcar un recordatorio como enviado
 * @access Privado
 */
router.post('/:id/marcar-enviado', verifyToken, marcarEnviado);

/**
 * @route GET /api/recordatorios/sistema/pendientes
 * @desc Obtener recordatorios pendientes para procesamiento
 * @access Privado (admin y superAdmin)
 */
router.get('/sistema/pendientes', verifyToken, hasRole(['admin', 'superAdmin']), getRecordatoriosPendientes);

export default router; 