import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../config/logger.js';

export const verifyToken = async (req, res, next) => {
  try {
    // Obtener el token del header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No hay token, autorización denegada' 
      });
    }
    
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar si el token ha expirado
    const ahora = Math.floor(Date.now() / 1000);
    if (decoded.exp < ahora) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado, inicie sesión nuevamente' 
      });
    }
    
    // Agregar el id del usuario al request
    req.userId = decoded.id;
    req.userRole = decoded.role;
    
    // Verificar si el usuario existe en la base de datos
    const user = await User.findById(decoded.id).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido - usuario no existe' 
      });
    }
    
    // Verificar la versión del token (para invalidación forzada de tokens)
    if (decoded.tokenVersion && user.tokenVersion > decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida - inicie sesión nuevamente'
      });
    }
    
    // Verificar si la cuenta está activa
    if (!user.activo) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario desactivado' 
      });
    }
    
    // Verificar si la cuenta está bloqueada
    if (user.estaBloqueada && user.estaBloqueada()) {
      const tiempoRestante = Math.ceil((user.bloqueadoHasta - Date.now()) / (60 * 1000));
      return res.status(401).json({ 
        success: false, 
        message: `Cuenta bloqueada. Intente nuevamente en ${tiempoRestante} minutos.` 
      });
    }
    
    // Verificar si el usuario cambió su contraseña después de emitir el token
    if (user.changedPasswordAfter && decoded.iat && user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({ 
        success: false, 
        message: 'La contraseña ha cambiado recientemente, inicie sesión nuevamente' 
      });
    }
    
    // Guardar usuario completo para acceder a sus permisos
    req.user = user;
    
    // Todo está correcto, pasamos al siguiente middleware o controlador
    next();
  } catch (error) {
    logger.error(`Error en autenticación: ${error.message}`);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado, inicie sesión nuevamente' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Error de autenticación',
      error: error.message 
    });
  }
};

// Middleware para verificar si el usuario es admin o superAdmin
export const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'superAdmin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado - requiere rol de administrador' 
    });
  }
  next();
};

// Middleware para verificar si el usuario es superAdmin
export const isSuperAdmin = (req, res, next) => {
  if (req.userRole !== 'superAdmin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado - requiere rol de superAdmin' 
    });
  }
  next();
};

// Middleware para verificar permisos específicos
export const tienePermiso = (permiso) => {
  return (req, res, next) => {
    if (!req.user || !req.user.tienePermiso(permiso)) {
      return res.status(403).json({ 
        success: false, 
        message: `Acceso denegado - se requiere el permiso: ${permiso}` 
      });
    }
    next();
  };
};

// Middleware para controlar la creación de usuarios según roles
export const puedeCrearUsuarioConRol = (req, res, next) => {
  const { role } = req.body;
  
  // Si no se especifica rol, asignar 'usuario' por defecto
  if (!role) {
    req.body.role = 'usuario';
    return next();
  }
  
  // Verificar permisos según el rol del usuario y el rol que intenta crear
  if (req.userRole === 'superAdmin') {
    // superAdmin puede crear cualquier tipo de usuario
    return next();
  } else if (req.userRole === 'admin') {
    // admin solo puede crear usuarios regulares
    if (role === 'usuario') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Los administradores solo pueden crear usuarios con rol "usuario"'
    });
  } else {
    // Usuarios regulares no pueden crear otros usuarios
    return res.status(403).json({
      success: false,
      message: 'No tiene permisos para crear usuarios'
    });
  }
};

// Middleware para validar token con comprobación más estricta
export const verifyStrictToken = async (req, res, next) => {
  try {
    await verifyToken(req, res, () => {
      // Verificamos la firma del token con una clave más larga/compleja
      const token = req.headers.authorization?.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS512'] });
      
      // Verificar IP si está disponible (opcional, requiere guardar IP al crear token)
      if (req.user.lastLoginIP && req.ip && req.user.lastLoginIP !== req.ip) {
        return res.status(401).json({
          success: false,
          message: 'Sesión inválida - IP diferente a la del inicio de sesión'
        });
      }
      
      next();
    });
  } catch (error) {
    logger.error(`Error en verificación estricta: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Error de verificación de seguridad',
      error: error.message
    });
  }
}; 