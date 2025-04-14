import { Router } from 'express';
import { 
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
  initSuperAdmin,
  getAdminStats,
  getAdminDetailStats,
  assignLocalToAdmin,
  removeLocalFromAdmin,
  setAdminPrimaryLocal
} from '../controllers/adminController.js';
import { verifyToken, isAdmin, isSuperAdmin, puedeCrearUsuarioConRol, verifyStrictToken, hasRole } from '../middlewares/authMiddleware.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserPassword,
  validateToggleStatus,
  validateInitSuperAdmin
} from '../middlewares/validationMiddleware.js';
import User from '../models/User.js';

const router = Router();

/**
 * @route POST /api/admin/super-admin
 * @desc Crear un superAdmin (hasta 4 permitidos)
 * @access Público (primera vez) o Privado (superAdmin)
 */
router.post('/super-admin', validateInitSuperAdmin, async (req, res, next) => {
  try {
    // Verificar si ya existe algún superAdmin
    const existsSuperAdmin = await User.findOne({ role: 'superAdmin' });
    
    if (existsSuperAdmin) {
      // Si ya existe un superAdmin, requerir token y permisos de superAdmin
      return verifyStrictToken(req, res, () => {
        isSuperAdmin(req, res, () => {
          initSuperAdmin(req, res);
        });
      });
    }
    
    // Si no hay superAdmins, permitir la creación sin token
    return initSuperAdmin(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/admin/users
 * @desc Obtener todos los usuarios
 * @access Admin, SuperAdmin
 */
router.get('/users', verifyToken, hasRole(['admin', 'superAdmin']), getAllUsers);

/**
 * @route GET /api/admin/users/:id
 * @desc Obtener un usuario por ID
 * @access Admin, SuperAdmin
 */
router.get('/users/:id', verifyToken, hasRole(['admin', 'superAdmin']), getUserById);

/**
 * @route POST /api/admin/users
 * @desc Crear un nuevo usuario
 * @access Admin, SuperAdmin
 */
router.post('/users', verifyToken, hasRole(['admin', 'superAdmin']), validateCreateUser, createUser);

/**
 * @route PUT /api/admin/users/:id
 * @desc Actualizar un usuario
 * @access Admin, SuperAdmin
 */
router.put('/users/:id', verifyToken, hasRole(['admin', 'superAdmin']), validateUpdateUser, updateUser);

/**
 * @route DELETE /api/admin/users/:id
 * @desc Eliminar un usuario
 * @access Admin, SuperAdmin
 */
router.delete('/users/:id', verifyToken, hasRole(['admin', 'superAdmin']), deleteUser);

/**
 * @route PUT /api/admin/users/:id/password
 * @desc Restablecer contraseña de un usuario
 * @access Privado (admin para usuarios, superAdmin para todos)
 */
router.put('/users/:id/password', verifyToken, isAdmin, validateUserPassword, resetUserPassword);

/**
 * @route PATCH /api/admin/users/:id/toggle-status
 * @desc Activar/Desactivar un usuario
 * @access Admin, SuperAdmin
 */
router.patch('/users/:id/toggle-status', verifyToken, hasRole(['admin', 'superAdmin']), validateToggleStatus, toggleUserStatus);

/**
 * @route GET /api/admin/admins/stats
 * @desc Obtener estadísticas de todos los administradores (locales y usuarios)
 * @access SuperAdmin
 */
router.get('/admins/stats', verifyToken, isSuperAdmin, getAdminStats);

/**
 * @route GET /api/admin/admins/:adminId/stats
 * @desc Obtener estadísticas detalladas de un administrador específico
 * @access SuperAdmin, o el propio Admin
 */
router.get('/admins/:adminId/stats', verifyToken, hasRole(['admin', 'superAdmin']), getAdminDetailStats);

/**
 * @route POST /api/admin/admins/:adminId/locales
 * @desc Asignar un local adicional a un administrador
 * @access SuperAdmin
 */
router.post('/admins/:adminId/locales', verifyToken, isSuperAdmin, assignLocalToAdmin);

/**
 * @route DELETE /api/admin/admins/:adminId/locales/:localId
 * @desc Eliminar un local asignado a un administrador
 * @access SuperAdmin
 */
router.delete('/admins/:adminId/locales/:localId', verifyToken, isSuperAdmin, removeLocalFromAdmin);

/**
 * @route PUT /api/admin/admins/:adminId/locales/primary/:localId
 * @desc Establecer un local como principal para un administrador
 * @access SuperAdmin
 */
router.put('/admins/:adminId/locales/primary/:localId', verifyToken, isSuperAdmin, setAdminPrimaryLocal);

export default router; 