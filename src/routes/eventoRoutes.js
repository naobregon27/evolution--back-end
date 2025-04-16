import { Router } from 'express';
import { 
  getEventos, 
  getEventoById, 
  createEvento, 
  updateEvento, 
  deleteEvento, 
  addNota, 
  confirmarParticipacion,
  getEventosByCliente,
  getEventosLocal
} from '../controllers/eventoController.js';
import { descargarICalEvento } from '../services/calendarService.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @route GET /api/eventos
 * @desc Obtener todos los eventos
 * @access Privado
 */
router.get('/', verifyToken, getEventos);

/**
 * @route GET /api/eventos/local
 * @desc Obtener todos los eventos del local
 * @access Privado
 */
router.get('/local', verifyToken, getEventosLocal);

/**
 * @route GET /api/eventos/:id
 * @desc Obtener un evento por ID
 * @access Privado
 */
router.get('/:id', verifyToken, getEventoById);

/**
 * @route POST /api/eventos
 * @desc Crear un nuevo evento
 * @access Privado
 */
router.post('/', verifyToken, createEvento);

/**
 * @route PUT /api/eventos/:id
 * @desc Actualizar un evento existente
 * @access Privado
 */
router.put('/:id', verifyToken, updateEvento);

/**
 * @route DELETE /api/eventos/:id
 * @desc Eliminar un evento
 * @access Privado
 */
router.delete('/:id', verifyToken, deleteEvento);

/**
 * @route POST /api/eventos/:id/notas
 * @desc Agregar una nota a un evento
 * @access Privado
 */
router.post('/:id/notas', verifyToken, addNota);

/**
 * @route POST /api/eventos/:id/confirmar
 * @desc Confirmar participación en un evento
 * @access Privado
 */
router.post('/:id/confirmar', verifyToken, confirmarParticipacion);

/**
 * @route GET /api/eventos/cliente/:clienteId
 * @desc Obtener eventos por cliente
 * @access Privado
 */
router.get('/cliente/:clienteId', verifyToken, getEventosByCliente);

/**
 * @route GET /api/eventos/:id/ical
 * @desc Descargar archivo iCal de un evento
 * @access Privado
 */
router.get('/:id/ical', verifyToken, descargarICalEvento);

export default router; 