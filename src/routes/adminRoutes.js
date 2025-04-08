import { Router } from 'express';
import { 
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
  initSuperAdmin
} from '../controllers/adminController.js';
import { verifyToken, isAdmin, isSuperAdmin, puedeCrearUsuarioConRol, verifyStrictToken } from '../middlewares/authMiddleware.js';
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
 * @access Privado (admin, superAdmin)
 */
router.get('/users', verifyToken, isAdmin, getAllUsers);

/**
 * @route GET /api/admin/users/:userId
 * @desc Obtener un usuario por ID
 * @access Privado (admin, superAdmin)
 */
router.get('/users/:userId', verifyToken, isAdmin, getUserById);

/**
 * @route POST /api/admin/users
 * @desc Crear un nuevo usuario
 * @access Privado (admin puede crear usuarios, superAdmin puede crear usuarios y admins)
 */
router.post('/users', verifyToken, isAdmin, puedeCrearUsuarioConRol, validateCreateUser, createUser);

/**
 * @route PUT /api/admin/users/:userId
 * @desc Actualizar un usuario
 * @access Privado (admin para usuarios, superAdmin para todos)
 */
router.put('/users/:userId', verifyToken, isAdmin, validateUpdateUser, updateUser);

/**
 * @route DELETE /api/admin/users/:userId
 * @desc Eliminar un usuario (marcar como inactivo)
 * @access Privado (solo superAdmin)
 */
router.delete('/users/:userId', verifyStrictToken, isSuperAdmin, deleteUser);

/**
 * @route PUT /api/admin/users/:userId/password
 * @desc Restablecer contraseña de un usuario
 * @access Privado (admin para usuarios, superAdmin para todos)
 */
router.put('/users/:userId/password', verifyToken, isAdmin, validateUserPassword, resetUserPassword);

/**
 * @route PATCH /api/admin/users/:userId/status
 * @desc Activar/Desactivar un usuario
 * @access Privado (admin para usuarios, superAdmin para todos)
 */
router.patch('/users/:userId/status', verifyToken, isAdmin, validateToggleStatus, toggleUserStatus);

export default router; 