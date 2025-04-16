import { Router } from 'express';
import { 
  getClientes, 
  getClienteById, 
  createCliente, 
  updateCliente, 
  deleteCliente, 
  addNota, 
  addInteraccion,
  getEstadisticas
} from '../controllers/clienteController.js';
import { verifyToken, hasRole } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @route GET /api/clientes
 * @desc Obtener todos los clientes
 * @access Privado
 */
router.get('/', verifyToken, getClientes);

/**
 * @route GET /api/clientes/estadisticas
 * @desc Obtener estadísticas de clientes
 * @access Privado (admin y superAdmin)
 */
router.get('/estadisticas', verifyToken, hasRole(['admin', 'superAdmin']), getEstadisticas);

/**
 * @route GET /api/clientes/:id
 * @desc Obtener un cliente por ID
 * @access Privado
 */
router.get('/:id', verifyToken, getClienteById);

/**
 * @route POST /api/clientes
 * @desc Crear un nuevo cliente
 * @access Privado
 */
router.post('/', verifyToken, createCliente);

/**
 * @route PUT /api/clientes/:id
 * @desc Actualizar un cliente existente
 * @access Privado
 */
router.put('/:id', verifyToken, updateCliente);

/**
 * @route DELETE /api/clientes/:id
 * @desc Eliminar un cliente
 * @access Privado (admin y superAdmin)
 */
router.delete('/:id', verifyToken, hasRole(['admin', 'superAdmin']), deleteCliente);

/**
 * @route POST /api/clientes/:id/notas
 * @desc Agregar una nota a un cliente
 * @access Privado
 */
router.post('/:id/notas', verifyToken, addNota);

/**
 * @route POST /api/clientes/:id/interacciones
 * @desc Registrar una interacción con un cliente
 * @access Privado
 */
router.post('/:id/interacciones', verifyToken, addInteraccion);

export default router; 