import { Router } from 'express';
import { 
  register, 
  login, 
  logout,
  getProfile, 
  changePassword, 
  forgotPassword 
} from '../controllers/userController.js';
import { verifyToken, isUser, hasRole } from '../middlewares/authMiddleware.js';
import { 
  validateRegister, 
  validateLogin,
  validateChangePassword,
  validateForgotPassword
} from '../middlewares/validationMiddleware.js';

const router = Router();

/**
 * @route POST /api/users/register
 * @desc Registro de usuario
 * @access Público
 */
router.post('/register', validateRegister, register);

/**
 * @route POST /api/users/login
 * @desc Login de usuario
 * @access Público
 */
router.post('/login', validateLogin, login);

/**
 * @route POST /api/users/logout
 * @desc Cerrar sesión del usuario
 * @access Privado
 */
router.post('/logout', verifyToken, logout);

/**
 * @route GET /api/users/profile
 * @desc Obtener perfil de usuario
 * @access Privado (todos los roles: superAdmin, admin, usuario)
 */
router.get('/profile', verifyToken, getProfile);

/**
 * @route PUT /api/users/change-password
 * @desc Cambiar contraseña de usuario
 * @access Privado (todos los roles: superAdmin, admin, usuario)
 */
router.put('/change-password', verifyToken, validateChangePassword, changePassword);

/**
 * @route POST /api/users/forgot-password
 * @desc Solicitar reseteo de contraseña
 * @access Público
 */
router.post('/forgot-password', validateForgotPassword, forgotPassword);

export default router; 