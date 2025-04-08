import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

// Crear un nuevo usuario
export const register = async (req, res) => {
  try {
    const { nombre, email, password, local } = req.body;
    
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'El email ya está registrado' 
      });
    }
    
    // Crear el nuevo usuario
    const user = new User({
      nombre,
      email,
      password,
      local, // Si se proporciona un local, se asigna
      enLinea: false, // Por defecto está offline
      activo: true // Por defecto está activo (cuenta habilitada)
    });
    
    await user.save();
    
    // Responder sin devolver la contraseña
    const userResponse = {
      id: user._id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      local: user.local
    };
    
    res.status(201).json({ 
      success: true, 
      message: 'Usuario creado exitosamente',
      data: userResponse
    });
  } catch (error) {
    logger.error(`Error en registro: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear usuario',
      error: error.message 
    });
  }
};

// Login de usuario
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario por email - usamos select('+password') porque ahora está oculto por defecto
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }
    
    // Verificar si la cuenta está bloqueada
    if (user.estaBloqueada()) {
      const tiempoRestante = Math.ceil((user.bloqueadoHasta - Date.now()) / (60 * 1000));
      return res.status(401).json({ 
        success: false, 
        message: `Cuenta bloqueada por intentos fallidos. Intente nuevamente en ${tiempoRestante} minutos.` 
      });
    }
    
    // Verificar si la contraseña es correcta
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Registrar intento fallido
      await user.registrarIntentoFallido();
      
      // Si ya está bloqueada, informar el tiempo restante
      if (user.estaBloqueada()) {
        const tiempoRestante = Math.ceil((user.bloqueadoHasta - Date.now()) / (60 * 1000));
        return res.status(401).json({ 
          success: false, 
          message: `Demasiados intentos fallidos. Cuenta bloqueada por ${tiempoRestante} minutos.` 
        });
      }
      
      // Informar intentos restantes
      const intentosRestantes = 5 - user.intentosFallidos;
      return res.status(401).json({ 
        success: false, 
        message: `Credenciales inválidas. Intentos restantes: ${intentosRestantes}` 
      });
    }
    
    // Registrar información del dispositivo
    const infoDispositivo = {
      dispositivo: req.headers['user-agent'] || 'desconocido',
      ip: req.ip,
      ubicacion: req.headers['accept-language'] || 'desconocido'
    };
    
    // Registrar login exitoso e IP (esto también actualiza enLinea a true)
    await user.registrarLoginExitoso(infoDispositivo);
    user.lastLoginIP = req.ip;
    await user.save();
    
    // Generar JWT con más datos y algoritmo más seguro
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        email: user.email,
        iat: Math.floor(Date.now() / 1000), // Issued at time
        // Datos de seguridad adicionales
        userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
        tokenVersion: user.tokenVersion
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '8h',
        algorithm: 'HS512'
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        local: user.local,
        enLinea: user.enLinea
      }
    });
  } catch (error) {
    logger.error(`Error en login: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al iniciar sesión',
      error: error.message 
    });
  }
};

// Logout de usuario
export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    // Actualizar estado a offline
    await user.registrarLogout();
    
    res.status(200).json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    logger.error(`Error en logout: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cerrar sesión',
      error: error.message 
    });
  }
};

// Obtener perfil de usuario
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('local', 'nombre direccion telefono email');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    // Verificar si el usuario está en línea
    if (!user.enLinea) {
      // Si no está en línea, actualizar su estado
      user.enLinea = true;
      await user.save({ validateBeforeSave: false });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error obteniendo perfil: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener perfil de usuario',
      error: error.message 
    });
  }
};

// Cambiar contraseña
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Obtener usuario con contraseña
    const user = await User.findById(req.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'La contraseña actual es incorrecta' 
      });
    }
    
    // Actualizar contraseña e incrementar versión del token para invalidar sesiones
    user.password = newPassword;
    user.incrementTokenVersion();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    logger.error(`Error cambiando contraseña: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cambiar la contraseña',
      error: error.message 
    });
  }
};

// Solicitar reseteo de contraseña
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No existe un usuario con ese email' 
      });
    }
    
    // Generar token de reseteo
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Aquí normalmente enviarías un email con el token
    // Por simplicidad, solo retornamos un mensaje de éxito
    
    logger.info(`Token de reseteo generado para ${email}: ${resetToken}`);
    
    res.status(200).json({
      success: true,
      message: 'Token de reseteo generado. Revise su email para instrucciones.'
    });
  } catch (error) {
    logger.error(`Error en forgot password: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar la solicitud',
      error: error.message 
    });
  }
}; 