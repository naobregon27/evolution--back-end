import User from '../models/User.js';
import Local from '../models/Local.js';
import logger from '../config/logger.js';

// Cantidad máxima de superAdmins permitidos
const MAX_SUPER_ADMINS = 4;

// Obtener todos los usuarios (para admin y superAdmin)
export const getAllUsers = async (req, res) => {
  try {
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Parámetros de filtrado
    const filters = {};
    
    if (req.query.role) filters.role = req.query.role;
    if (req.query.activo === 'true') filters.activo = true;
    if (req.query.activo === 'false') filters.activo = false;
    if (req.query.search) {
      filters.$or = [
        { nombre: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.local) filters.local = req.query.local;
    
    // Si el usuario es admin, restringir la vista a su local y no mostrar superAdmins
    if (req.userRole === 'admin') {
      if (req.user.local) {
        filters.local = req.user.local;
      }
      filters.role = { $ne: 'superAdmin' };
    }
    
    // Contar total de registros para la paginación primero
    const total = await User.countDocuments(filters);
    
    // Configurar query con includeInactive antes de find() para asegurar que funcione correctamente
    const findQuery = { ...filters };
    const options = { includeInactive: true }; // Asegurar incluir usuarios inactivos
    
    // Realizar búsqueda con todas las opciones
    const users = await User.find(findQuery, null, options)
      .select('-password')
      .populate('local', 'nombre direccion telefono email')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(); // Usar lean() para mejorar rendimiento y obtener objetos JS planos
    
    // Modificar la respuesta para mostrar todos los usuarios en formato plano
    const usersData = users.map(user => ({
      id: user._id.toString(),
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      telefono: user.telefono || '',
      direccion: user.direccion || '',
      organizacion: user.organizacion || '',
      permisos: user.permisos || {},
      esAdministradorLocal: user.esAdministradorLocal || false,
      local: user.local ? {
        id: user.local._id?.toString(),
        nombre: user.local.nombre,
        direccion: user.local.direccion,
        telefono: user.local.telefono,
        email: user.local.email
      } : null,
      imagenPerfil: user.imagenPerfil,
      verificado: user.verificado,
      activo: user.activo,
      enLinea: user.enLinea,
      fechaCreacion: user.createdAt,
      fechaActualizacion: user.updatedAt,
      ultimaConexion: user.ultimaConexion,
      creadoPor: user.creadoPor ? {
        id: user.creadoPor._id?.toString(),
        nombre: user.creadoPor.nombre,
        email: user.creadoPor.email
      } : null,
      ultimaModificacion: user.ultimaModificacion ? {
        usuario: user.ultimaModificacion.usuario ? {
          id: user.ultimaModificacion.usuario._id?.toString(),
          nombre: user.ultimaModificacion.usuario.nombre,
          email: user.ultimaModificacion.usuario.email
        } : null,
        fecha: user.ultimaModificacion.fecha
      } : null
    }));
    
    // Respuesta con los usuarios completos
    res.status(200).json({
      success: true,
      data: {
        users: usersData,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Error obteniendo usuarios: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener usuarios',
      error: error.message 
    });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('local', 'nombre direccion telefono email')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar permisos: un admin no puede ver detalles de un superAdmin
    if (req.userRole === 'admin') {
      // No puede ver superAdmins
      if (user.role === 'superAdmin') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para ver este usuario'
        });
      }
      
      // Solo puede ver usuarios de su local
      if (req.user.local && (!user.local || req.user.local.toString() !== user.local._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para ver este usuario'
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error obteniendo usuario: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener usuario',
      error: error.message 
    });
  }
};

// Crear un nuevo usuario (admin o superAdmin pueden hacer esto)
export const createUser = async (req, res) => {
  try {
    const { nombre, email, password, role, telefono, direccion, organizacion, local } = req.body;
    
    // Verificar límite de superAdmins si se está creando uno nuevo
    if (role === 'superAdmin') {
      const superAdminsCount = await User.countDocuments({ role: 'superAdmin' });
      if (superAdminsCount >= MAX_SUPER_ADMINS) {
        return res.status(400).json({
          success: false,
          message: `No se pueden crear más de ${MAX_SUPER_ADMINS} superAdmins en el sistema`
        });
      }
    }
    
    // Si el usuario es admin, solo puede crear usuarios regulares en su local
    if (req.userRole === 'admin') {
      // No puede crear administradores
      if (role && role !== 'usuario') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para crear usuarios con este rol'
        });
      }
      
      // Debe asignar usuarios a su propio local
      if (!local || local !== req.user.local.toString()) {
        // Forzar asignación al local del admin
        req.body.local = req.user.local;
      }
    } else if (req.userRole === 'superAdmin') {
      // Si es superAdmin y crea un admin, debe asignarle un local
      if (role === 'admin' && !local) {
        return res.status(400).json({
          success: false,
          message: 'Debe asignar un local al administrador'
        });
      }
      
      // Verificar que el local exista
      if (local) {
        const localExiste = await Local.findById(local);
        if (!localExiste) {
          return res.status(404).json({
            success: false,
            message: 'El local/marca especificado no existe'
          });
        }
      }
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'El email ya está registrado' 
      });
    }
    
    // Crear el usuario
    const newUser = await User.create({
      nombre,
      email,
      password,
      role: role || 'usuario',
      local: req.body.local || local,
      telefono,
      direccion,
      organizacion,
      verificado: true, // El usuario creado por admin ya está verificado
      creadoPor: req.userId, // Registrar quién creó el usuario
      enLinea: false, // Nuevo usuario no está en línea
      activo: true, // Nuevo usuario está activo
      ultimaModificacion: {
        usuario: req.userId,
        fecha: Date.now()
      }
    });
    
    // Si se creó un admin, marcarlo como administrador del local
    if (newUser.role === 'admin' && newUser.local) {
      newUser.esAdministradorLocal = true;
      await newUser.save();
    }
    
    // Omitir la contraseña en la respuesta
    const userResponse = {
      id: newUser._id,
      nombre: newUser.nombre,
      email: newUser.email,
      role: newUser.role,
      local: newUser.local,
      telefono: newUser.telefono,
      direccion: newUser.direccion,
      organizacion: newUser.organizacion,
      enLinea: newUser.enLinea,
      activo: newUser.activo
    };
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: userResponse
    });
  } catch (error) {
    logger.error(`Error creando usuario: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear usuario',
      error: error.message 
    });
  }
};

// Actualizar un usuario
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    // Verificar límite de superAdmins si se está cambiando el rol a superAdmin
    if (updateData.role === 'superAdmin') {
      const user = await User.findById(userId);
      if (user.role !== 'superAdmin') { // Solo si no era ya superAdmin
        const superAdminsCount = await User.countDocuments({ role: 'superAdmin' });
        if (superAdminsCount >= MAX_SUPER_ADMINS) {
          return res.status(400).json({
            success: false,
            message: `No se pueden tener más de ${MAX_SUPER_ADMINS} superAdmins en el sistema`
          });
        }
      }
    }
    
    // Buscar el usuario a actualizar
    const user = await User.findById(userId).populate('local', 'nombre');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Si es admin, solo puede actualizar usuarios de su local
    if (req.userRole === 'admin') {
      // No puede cambiar usuarios de otro local
      if (!user.local || req.user.local.toString() !== user.local._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No puede editar usuarios de otro local/marca'
        });
      }
      
      // No puede cambiar el rol ni el local
      delete updateData.role;
      delete updateData.local;
    } else if (req.userRole === 'superAdmin') {
      // Si es superAdmin y cambia a un usuario a admin, verificar que tenga local asignado
      if (updateData.role === 'admin' && !updateData.local && !user.local) {
        return res.status(400).json({
          success: false,
          message: 'Debe asignar un local al administrador'
        });
      }
      
      // Verificar que el local exista si se está cambiando
      if (updateData.local && updateData.local !== user.local?._id.toString()) {
        const localExiste = await Local.findById(updateData.local);
        if (!localExiste) {
          return res.status(404).json({
            success: false,
            message: 'El local/marca especificado no existe'
          });
        }
      }
    }
    
    // No permitir cambiar el rol a superAdmin a menos que sea superAdmin
    if (updateData.role === 'superAdmin' && req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para asignar el rol de superAdmin'
      });
    }
    
    // No permitir cambiar el rol de un superAdmin si no eres superAdmin
    if (user.role === 'superAdmin' && req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar un superAdmin'
      });
    }
    
    // Eliminar campos que no deben actualizarse directamente
    delete updateData.password;
    delete updateData.intentosFallidos;
    delete updateData.bloqueadoHasta;
    delete updateData.passwordResetToken;
    delete updateData.passwordResetExpires;
    
    // Registrar quién modificó el usuario
    updateData.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    // Si cambia a admin y tiene local, marcar como administrador del local
    if (updateData.role === 'admin' && (updateData.local || user.local)) {
      updateData.esAdministradorLocal = true;
    }
    
    // Actualizar el usuario
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password')
     .populate('local', 'nombre direccion');
    
    res.status(200).json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error actualizando usuario: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar usuario',
      error: error.message 
    });
  }
};

// Eliminar un usuario (solo superAdmin)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Solo permitir a superAdmin eliminar usuarios
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo superAdmin puede eliminar usuarios'
      });
    }
    
    // Buscar el usuario
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Prevenir eliminación de superAdmin si quedaría menos de uno activo
    if (user.role === 'superAdmin') {
      const superAdminsCount = await User.countDocuments({ role: 'superAdmin', activo: true });
      if (superAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el último superAdmin activo del sistema'
        });
      }
    }
    
    // Prevenir eliminación del último admin de un local
    if (user.role === 'admin' && user.local) {
      const adminsCount = await User.countDocuments({ 
        role: 'admin', 
        local: user.local, 
        activo: true 
      });
      
      if (adminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el único administrador de este local/marca'
        });
      }
    }
    
    // En lugar de eliminar, marcar como inactivo para mantener historial
    await User.findByIdAndUpdate(userId, { 
      activo: false,
      enLinea: false, // Si se desactiva, también está desconectado
      ultimaModificacion: {
        usuario: req.userId,
        fecha: Date.now()
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    logger.error(`Error eliminando usuario: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar usuario',
      error: error.message 
    });
  }
};

// Restablecer contraseña de un usuario (admin o superAdmin)
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    // Buscar el usuario
    const user = await User.findById(userId).populate('local', 'nombre');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar permisos: admin solo puede restablecer contraseñas de usuarios de su local
    if (req.userRole === 'admin') {
      if (user.role === 'superAdmin' || user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar la contraseña de este usuario'
        });
      }
      
      if (!user.local || req.user.local.toString() !== user.local._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar la contraseña de usuarios de otro local/marca'
        });
      }
    }
    
    // Actualizar la contraseña
    user.password = newPassword;
    user.intentosFallidos = 0;
    user.bloqueadoHasta = undefined;
    user.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });
  } catch (error) {
    logger.error(`Error restableciendo contraseña: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al restablecer la contraseña',
      error: error.message 
    });
  }
};

// Activar/Desactivar un usuario
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { activo } = req.body;
    
    // Buscar el usuario
    const user = await User.findById(userId).populate('local', 'nombre');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar permisos: admin solo puede cambiar estado de usuarios de su local
    if (req.userRole === 'admin') {
      if (user.role === 'superAdmin' || user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar el estado de este usuario'
        });
      }
      
      if (!user.local || req.user.local.toString() !== user.local._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar el estado de usuarios de otro local/marca'
        });
      }
    }
    
    // Prevenir desactivación del último superAdmin activo
    if (user.role === 'superAdmin' && !activo) {
      const superAdminsCount = await User.countDocuments({ role: 'superAdmin', activo: true });
      if (superAdminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede desactivar el último superAdmin activo del sistema'
        });
      }
    }
    
    // Prevenir desactivación del último admin de un local
    if (user.role === 'admin' && user.local && !activo) {
      const adminsCount = await User.countDocuments({ 
        role: 'admin', 
        local: user.local._id, 
        activo: true 
      });
      
      if (adminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede desactivar el único administrador de este local/marca'
        });
      }
    }
    
    // Actualizar el estado
    user.activo = activo;
    
    // Si se desactiva, también poner offline
    if (!activo) {
      user.enLinea = false;
    }
    
    user.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    logger.error(`Error cambiando estado de usuario: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al cambiar el estado del usuario',
      error: error.message 
    });
  }
};

// Inicializar superAdmin si no existe ninguno
export const initSuperAdmin = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    
    // Verificar si estamos dentro del límite de superAdmins
    const superAdminCount = await User.countDocuments({ role: 'superAdmin' });
    
    if (superAdminCount >= MAX_SUPER_ADMINS) {
      return res.status(400).json({
        success: false,
        message: `No se pueden crear más de ${MAX_SUPER_ADMINS} superAdmins en el sistema`
      });
    }
    
    // Si es el primer superAdmin, usar el método especial, sino crear normalmente
    if (superAdminCount === 0) {
      // Crear el superAdmin inicial
      await User.crearSuperAdminInicial({
        nombre,
        email,
        password
      });
    } else {
      // Crear superAdmin adicional
      await User.create({
        nombre,
        email,
        password,
        role: 'superAdmin',
        verificado: true,
        activo: true
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'SuperAdmin creado exitosamente'
    });
  } catch (error) {
    logger.error(`Error inicializando superAdmin: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error al inicializar superAdmin',
      error: error.message 
    });
  }
}; 