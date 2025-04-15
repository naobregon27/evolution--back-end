import { Router } from 'express';
import { 
  createLocal, 
  getAllLocales, 
  getLocalById, 
  updateLocal, 
  toggleLocalStatus, 
  getLocalUsers, 
  assignLocalAdmin,
  unassignUserFromLocal,
  getLocalUserStats,
  assignUserToLocal,
  deleteLocal
} from '../controllers/localController.js';
import { 
  verifyToken, 
  isAdmin, 
  isSuperAdmin, 
  tienePermiso,
  hasRole
} from '../middlewares/authMiddleware.js';
import { 
  validateCreateLocal, 
  validateUpdateLocal, 
  validateToggleStatus, 
  validateAssignAdmin,
  validateAssignUserToLocal
} from '../middlewares/validationMiddleware.js';

const router = Router();

/**
 * @route POST /api/locales
 * @desc Crear un nuevo local/marca
 * @access Privado (solo superAdmin)
 */
router.post('/', verifyToken, isSuperAdmin, validateCreateLocal, createLocal);

/**
 * @route GET /api/locales
 * @desc Obtener todos los locales/marcas
 * @access Privado (admin y superAdmin)
 */
router.get('/', verifyToken, hasRole(['admin', 'superAdmin']), getAllLocales);

/**
 * @route GET /api/locales/:localId
 * @desc Obtener un local/marca por ID
 * @access Privado (admin del local y superAdmin)
 */
router.get('/:localId', verifyToken, hasRole(['admin', 'superAdmin']), getLocalById);

/**
 * @route PUT /api/locales/:localId
 * @desc Actualizar un local/marca
 * @access Privado (admin del local y superAdmin)
 */
router.put('/:localId', verifyToken, hasRole(['admin', 'superAdmin']), validateUpdateLocal, updateLocal);

/**
 * @route PATCH /api/locales/:localId/status
 * @desc Activar/Desactivar un local/marca
 * @access Privado (solo superAdmin)
 */
router.patch('/:localId/status', verifyToken, isSuperAdmin, validateToggleStatus, toggleLocalStatus);

/**
 * @route GET /api/locales/:localId/usuarios
 * @desc Obtener usuarios de un local/marca
 * @access Privado (admin del local y superAdmin)
 */
router.get('/:localId/usuarios', verifyToken, hasRole(['admin', 'superAdmin']), getLocalUsers);

/**
 * @route POST /api/locales/:localId/admin
 * @desc Asignar un usuario a un local/marca (superAdmin puede convertir en admin con changeRole=true)
 * @access Privado (superAdmin y admin del local)
 */
router.post('/:localId/admin', verifyToken, hasRole(['admin', 'superAdmin']), validateAssignAdmin, assignLocalAdmin);

/**
 * @route DELETE /api/locales/:localId/usuarios/:userId
 * @desc Desasignar un usuario de un local/marca
 * @access Privado (admin del local y superAdmin)
 */
router.delete('/:localId/usuarios/:userId', verifyToken, hasRole(['admin', 'superAdmin']), unassignUserFromLocal);

/**
 * @route GET /api/locales/estadisticas
 * @desc Obtener estadísticas de usuarios por local
 * @access Privado (admin y superAdmin)
 */
router.get('/estadisticas', verifyToken, hasRole(['admin', 'superAdmin']), getLocalUserStats);

/**
 * @route GET /api/locales/:localId/estadisticas
 * @desc Obtener estadísticas de usuarios de un local específico
 * @access Privado (admin del local y superAdmin)
 */
router.get('/:localId/estadisticas', verifyToken, hasRole(['admin', 'superAdmin']), getLocalUserStats);

/**
 * @route DELETE /api/locales/:localId
 * @desc Eliminar un local/marca y todas sus dependencias
 * @access Privado (solo superAdmin)
 */
router.delete('/:localId', verifyToken, isSuperAdmin, deleteLocal);

export default router; 