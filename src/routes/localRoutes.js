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
  getLocalUserStats
} from '../controllers/localController.js';
import { 
  verifyToken, 
  isAdmin, 
  isSuperAdmin, 
  tienePermiso 
} from '../middlewares/authMiddleware.js';
import { 
  validateCreateLocal, 
  validateUpdateLocal, 
  validateToggleStatus, 
  validateAssignAdmin 
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
router.get('/', verifyToken, isAdmin, getAllLocales);

/**
 * @route GET /api/locales/:localId
 * @desc Obtener un local/marca por ID
 * @access Privado (admin del local y superAdmin)
 */
router.get('/:localId', verifyToken, isAdmin, getLocalById);

/**
 * @route PUT /api/locales/:localId
 * @desc Actualizar un local/marca
 * @access Privado (admin del local y superAdmin)
 */
router.put('/:localId', verifyToken, isAdmin, validateUpdateLocal, updateLocal);

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
router.get('/:localId/usuarios', verifyToken, isAdmin, getLocalUsers);

/**
 * @route POST /api/locales/:localId/admin
 * @desc Asignar un administrador a un local/marca
 * @access Privado (solo superAdmin)
 */
router.post('/:localId/admin', verifyToken, isSuperAdmin, validateAssignAdmin, assignLocalAdmin);

/**
 * @route DELETE /api/locales/:localId/usuarios/:userId
 * @desc Desasignar un usuario de un local/marca
 * @access Privado (admin del local y superAdmin)
 */
router.delete('/:localId/usuarios/:userId', verifyToken, isAdmin, unassignUserFromLocal);

/**
 * @route GET /api/locales/estadisticas
 * @desc Obtener estadísticas de usuarios por local
 * @access Privado (admin y superAdmin)
 */
router.get('/estadisticas', verifyToken, isAdmin, getLocalUserStats);

/**
 * @route GET /api/locales/:localId/estadisticas
 * @desc Obtener estadísticas de usuarios de un local específico
 * @access Privado (admin del local y superAdmin)
 */
router.get('/:localId/estadisticas', verifyToken, isAdmin, getLocalUserStats);

export default router; 