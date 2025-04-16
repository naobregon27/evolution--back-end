import User from '../models/User.js';
import Local from '../models/Local.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

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
    if (req.query.local) {
      // Buscar usuarios que pertenezcan a este local
      filters.locales = req.query.local;
    }
    
    // Si el usuario es admin, restringir la vista a sus locales y no mostrar superAdmins
    if (req.userRole === 'admin') {
      if (req.user.locales && req.user.locales.length > 0) {
        // Mostrar usuarios que pertenezcan a cualquiera de los locales del admin
        filters.locales = { $in: req.user.locales };
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
      .populate('locales', 'nombre direccion telefono email')
      .populate('primaryLocal', 'nombre direccion')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(); // Usar lean() para mejorar rendimiento y obtener objetos JS planos
    
    // Obtener conteo de usuarios por local para administradores
    const localUserCounts = {};
    
    // Sólo realizar el conteo cuando es relevante (para admins y superAdmins)
    if (req.userRole === 'admin' || req.userRole === 'superAdmin') {
      // Obtener los IDs de locales únicos de la lista de usuarios
      const localIds = [...new Set(users
        .filter(user => user.locales && user.locales.length > 0 && user.role === 'admin')
        .flatMap(user => user.locales.map(local => local._id.toString())))];
        
      // Para cada local, contar sus usuarios regulares
      for (const localId of localIds) {
        const count = await User.countDocuments({
          locales: localId,
          role: 'usuario',
          activo: true,
          includeInactive: false
        });
        localUserCounts[localId] = count;
      }
      
      // Si es admin, obtener el conteo específico para sus locales
      if (req.userRole === 'admin' && req.user.locales && req.user.locales.length > 0) {
        for (const adminLocal of req.user.locales) {
          const adminLocalId = adminLocal.toString();
        if (!localUserCounts[adminLocalId]) {
          localUserCounts[adminLocalId] = await User.countDocuments({
              locales: adminLocalId,
            role: 'usuario',
            activo: true
          });
          }
        }
      }
    }
    
    // Modificar la respuesta para mostrar todos los usuarios en formato plano
    const usersData = users.map(user => {
      // Obtener el conteo de usuarios para este local si es admin
      let usuariosEnLocal = null;
      if (user.role === 'admin' && user.locales && user.locales.length > 0) {
        // Sumar usuarios de todos los locales que administra
        usuariosEnLocal = user.locales.reduce((sum, local) => {
          const localId = local._id.toString();
          return sum + (localUserCounts[localId] || 0);
        }, 0);
      }
      
      return {
        id: user._id.toString(),
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        telefono: user.telefono || '',
        direccion: user.direccion || '',
        organizacion: user.organizacion || '',
        permisos: user.permisos || {},
        esAdministradorLocal: user.esAdministradorLocal || false,
        locales: user.locales ? user.locales.map(local => ({
          id: local._id?.toString(),
          nombre: local.nombre,
          direccion: local.direccion,
          telefono: local.telefono,
          email: local.email
        })) : [],
        primaryLocal: user.primaryLocal ? {
          id: user.primaryLocal._id?.toString(),
          nombre: user.primaryLocal.nombre,
          direccion: user.primaryLocal.direccion
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
        } : null,
        // Añadir el conteo directamente en el usuario si es admin
        usuariosEnLocal: user.role === 'admin' ? usuariosEnLocal : undefined
      };
    });
    
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
    const userId = req.params.id;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('locales', 'nombre direccion telefono email')
      .populate('primaryLocal', 'nombre direccion')
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
      
      // Solo puede ver usuarios que pertenezcan a alguno de sus locales
      const tienePermisos = user.locales && user.locales.some(local => 
        req.user.locales && req.user.locales.some(adminLocal => 
          adminLocal.toString() === local.toString()
        )
      );
      
      if (!tienePermisos) {
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
    const { nombre, email, password, role, telefono, direccion, organizacion, locales } = req.body;
    
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
    
    // Si el usuario es admin, solo puede crear usuarios regulares en sus locales
    if (req.userRole === 'admin') {
      // No puede crear administradores
      if (role && role !== 'usuario') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para crear usuarios con este rol'
        });
      }
      
      // Si se especifican locales, verificar que pertenezcan al admin
      if (locales && Array.isArray(locales) && locales.length > 0) {
        // Verificar que todos los locales especificados pertenezcan al admin
        const tienePermiso = locales.every(localId => 
          req.user.locales && req.user.locales.some(adminLocal => 
            adminLocal.toString() === localId
          )
        );
        
        if (!tienePermiso) {
          return res.status(403).json({
          success: false,
            message: 'Solo puede asignar usuarios a sus propios locales/marcas'
          });
        }
      } else {
        // Si no se especifican locales, asignar los locales del admin
        req.body.locales = req.user.locales;
      }
    } else if (req.userRole === 'superAdmin') {
      // Verificar que los locales existan
      if (locales && Array.isArray(locales) && locales.length > 0) {
        for (const localId of locales) {
          const localExiste = await Local.findById(localId);
        if (!localExiste) {
          return res.status(404).json({
            success: false,
              message: `El local/marca con ID ${localId} no existe`
          });
          }
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
    
    // Preparar datos del usuario
    const userData = {
      nombre,
      email,
      password,
      role: role || 'usuario',
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
    };
    
    // Asignar locales si están presentes
    if (locales && Array.isArray(locales) && locales.length > 0) {
      // Solo los administradores pueden tener múltiples locales
      if (role !== 'admin') {
        userData.locales = [locales[0]]; // Para usuarios regulares y superAdmin, solo el primer local
      } else {
        userData.locales = locales;
      }
      // Establecer el primer local como primaryLocal
      userData.primaryLocal = locales[0];
    }
    
    // Crear el usuario
    const newUser = await User.create(userData);
    
    // Si se creó un admin con locales asignados, marcarlo como administrador del local
    if (newUser.role === 'admin' && newUser.locales && newUser.locales.length > 0) {
      newUser.esAdministradorLocal = true;
      await newUser.save();
    }
    
    // Omitir la contraseña en la respuesta
    const userResponse = {
      id: newUser._id,
      nombre: newUser.nombre,
      email: newUser.email,
      role: newUser.role,
      locales: newUser.locales,
      primaryLocal: newUser.primaryLocal,
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
    const userId = req.params.id;
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
    const user = await User.findById(userId).populate('locales', 'nombre');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Si es admin, solo puede actualizar usuarios de sus locales
    if (req.userRole === 'admin') {
      // Verificar si el usuario pertenece a alguno de los locales que administra
      const puedeAdministrar = req.user.puedeAdministrar(user);
      
      if (!puedeAdministrar) {
        return res.status(403).json({
          success: false,
          message: 'No puede editar usuarios de otros locales/marcas'
        });
      }
      
      // No puede cambiar el rol ni el local
      delete updateData.role;
      delete updateData.locales;
      delete updateData.primaryLocal;
    } else if (req.userRole === 'superAdmin') {
      // Si es superAdmin y cambia a un usuario a admin, verificar que tenga local asignado
      if (updateData.role === 'admin' && 
          (!updateData.locales || !updateData.locales.length) && 
          !user.locales.length) {
        return res.status(400).json({
          success: false,
          message: 'Debe asignar al menos un local al administrador'
        });
      }
      
      // Si se están cambiando los locales, verificar que existan
      if (updateData.locales && Array.isArray(updateData.locales)) {
        for (const localId of updateData.locales) {
          const localExiste = await Local.findById(localId);
        if (!localExiste) {
          return res.status(404).json({
            success: false,
              message: `El local/marca con ID ${localId} no existe`
          });
          }
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
    
    // Si cambia a admin y tiene locales, marcar como administrador del local
    if (updateData.role === 'admin' && 
        ((updateData.locales && updateData.locales.length > 0) || user.locales.length > 0)) {
      updateData.esAdministradorLocal = true;
    }
    
    // Si se están actualizando los locales, actualizar también el primaryLocal
    if (updateData.locales && Array.isArray(updateData.locales) && updateData.locales.length > 0) {
      // Si se está cambiando el rol a no-admin, solo permitir un local
      if (updateData.role && updateData.role !== 'admin') {
        updateData.locales = [updateData.locales[0]];
      }
      updateData.primaryLocal = updateData.locales[0];
    }
    
    // Si se está cambiando el rol a no-admin y el usuario tiene múltiples locales,
    // reducir a solo el local principal
    if (updateData.role && updateData.role !== 'admin' && user.locales && user.locales.length > 1) {
      if (user.primaryLocal) {
        updateData.locales = [user.primaryLocal];
      } else if (user.locales.length > 0) {
        updateData.locales = [user.locales[0]];
        updateData.primaryLocal = user.locales[0];
      }
    }
    
    // Actualizar el usuario
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password')
     .populate('locales', 'nombre direccion')
     .populate('primaryLocal', 'nombre direccion');
    
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

// Eliminar un usuario (superAdmin y admin)
export const deleteUser = async (req, res) => {
  try {
    // Usamos 'id' en lugar de 'userId' para corresponder con la definición de la ruta
    const userId = req.params.id;
    
    logger.info(`Intento de eliminar usuario ID: ${userId}`);

    // Verificar que userId no sea undefined o null
    if (!userId) {
      logger.error('ID de usuario no proporcionado en la petición');
      return res.status(400).json({
        success: false,
        message: 'ID de usuario no proporcionado'
      });
    }
    
    // Validar formato del ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn(`Intento de eliminar usuario con ID inválido: ${userId}`);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }
    
    // Buscar el usuario a eliminar, asegurándonos de incluir usuarios inactivos
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      logger.warn(`Usuario con ID ${userId} no encontrado en la base de datos`);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    logger.info(`Usuario encontrado: ${user.email} (${user.role})`);
    
    // Verificaciones para superAdmin
    if (req.userRole === 'superAdmin') {
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
      if (user.role === 'admin' && user.locales && user.locales.length > 0) {
        for (const localId of user.locales) {
      const adminsCount = await User.countDocuments({ 
        role: 'admin', 
            locales: localId, 
            activo: true,
            _id: { $ne: userId } // Excluir al usuario actual
      });
      
          if (adminsCount === 0) {
        return res.status(400).json({
          success: false,
              message: 'No se puede eliminar el único administrador de un local/marca'
            });
          }
        }
      }
    } 
    // Verificaciones para admin
    else if (req.userRole === 'admin') {
      // Admin no puede eliminar a otros admins ni superadmins
      if (user.role === 'admin' || user.role === 'superAdmin') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para eliminar administradores o superadministradores'
        });
      }
      
      // Verificar que el usuario pertenezca a alguno de los locales del admin
      const puedeEliminar = user.locales && user.locales.length > 0 && req.user && req.user.locales && 
        user.locales.some(localId => 
          req.user.locales.some(adminLocal => 
            adminLocal.toString() === localId.toString()
          )
        );
      
      if (!puedeEliminar) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para eliminar usuarios de otros locales/marcas'
        });
      }
    } 
    // Si no es superAdmin ni admin, no tiene permisos
    else {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para eliminar usuarios'
      });
    }
    
    logger.info(`Procediendo a desactivar el usuario ${userId}`);
    
    // En lugar de eliminar, marcar como inactivo para mantener historial
    const updateResult = await User.findByIdAndUpdate(userId, { 
      activo: false,
      enLinea: false, // Si se desactiva, también está desconectado
      ultimaModificacion: {
        usuario: req.userId,
        fecha: Date.now()
      }
    }, { new: true });
    
    if (!updateResult) {
      logger.error(`Error al actualizar usuario ${userId}: No se pudo completar la actualización`);
      return res.status(500).json({
        success: false,
        message: 'Error al desactivar el usuario'
      });
    }
    
    // Registrar en el log quién eliminó al usuario
    logger.info(`Usuario ${userId} (${user.email}) desactivado exitosamente por ${req.userId} con rol ${req.userRole}`);
    
    res.status(200).json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    logger.error(`Error eliminando usuario: ${error.message}`, { stack: error.stack });
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
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    // Buscar el usuario
    const user = await User.findById(userId).populate('locales', 'nombre');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar permisos: admin solo puede restablecer contraseñas de usuarios de sus locales
    if (req.userRole === 'admin') {
      if (user.role === 'superAdmin' || user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar la contraseña de este usuario'
        });
      }
      
      // Verificar si el usuario pertenece a alguno de los locales del admin
      const tienePermisos = user.locales && user.locales.some(local => 
        req.user.locales && req.user.locales.some(adminLocal => 
          adminLocal.toString() === local._id.toString()
        )
      );
      
      if (!tienePermisos) {
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
    // Usar id en lugar de userId para corresponder con la definición de la ruta
    const userId = req.params.id;
    const { activo } = req.body;
    
    logger.info(`Intento de cambiar estado de usuario ID: ${userId} a ${activo ? 'activo' : 'inactivo'} por usuario ${req.userId} (${req.userRole})`);
    
    // Verificar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn(`ID de usuario inválido: ${userId}`);
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }
    
    // Asegurarnos de buscar usuarios independientemente de su estado actual (activo o inactivo)
    const user = await User.findOne({ _id: userId })
      .populate('locales', 'nombre direccion');
    
    // Registrar más detalles sobre la búsqueda
    logger.info(`Búsqueda de usuario: ID=${userId}, Encontrado=${!!user}, Consulta=findOne({ _id: ${userId} })`);
    
    if (!user) {
      logger.warn(`Usuario con ID ${userId} no encontrado en la base de datos`);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    logger.info(`Usuario encontrado: ${user.email} (${user.role}), Estado actual: ${user.activo ? 'activo' : 'inactivo'}`);
    
    // Verificación de permisos según rol
    if (req.userRole === 'admin') {
      // Admin NO puede cambiar estado de superAdmins ni otros admins
      if (user.role === 'superAdmin' || user.role === 'admin') {
        logger.warn(`Admin ${req.userId} intentó cambiar estado de ${userId} (${user.role}). Operación denegada.`);
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar el estado de administradores o superadministradores'
        });
      }
      
      // Admin solo puede cambiar estado de usuarios de sus locales
      const tienePermisos = user.locales && user.locales.some(local => 
        req.user.locales && req.user.locales.some(adminLocal => 
          adminLocal.toString() === local._id.toString()
        )
      );
      
      if (!tienePermisos) {
        logger.warn(`Admin ${req.userId} intentó cambiar estado de usuario ${userId} de otro local. Operación denegada.`);
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para cambiar el estado de usuarios de otro local/marca'
        });
      }
    }
    // Si no es admin ni superAdmin (aunque esto no debería ocurrir por el middleware)
    else if (req.userRole !== 'superAdmin') {
      logger.warn(`Usuario con rol ${req.userRole} intentó cambiar estado de usuario ${userId}. Operación denegada.`);
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para cambiar el estado de usuarios'
      });
    }
    
    // Prevenir desactivación del último superAdmin activo
    if (user.role === 'superAdmin' && !activo) {
      const superAdminsCount = await User.countDocuments({ role: 'superAdmin', activo: true });
      if (superAdminsCount <= 1) {
        logger.warn(`Intento de desactivar el último superAdmin activo. Operación denegada.`);
        return res.status(400).json({
          success: false,
          message: 'No se puede desactivar el último superAdmin activo del sistema'
        });
      }
    }
    
    // Prevenir desactivación del último admin de un local
    if (user.role === 'admin' && user.locales && user.locales.length > 0 && !activo) {
      // Verificar cada local del admin
      for (const local of user.locales) {
      const adminsCount = await User.countDocuments({ 
        role: 'admin', 
          locales: local._id, 
          activo: true,
          _id: { $ne: userId } // Excluir al usuario actual
      });
      
        if (adminsCount === 0) {
          logger.warn(`Intento de desactivar el único admin del local ${local._id}. Operación denegada.`);
        return res.status(400).json({
          success: false,
            message: `No se puede desactivar el único administrador del local/marca ${local.nombre}`
        });
        }
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
    
    // Guardar usuario y verificar que se haya actualizado correctamente
    const usuarioActualizado = await user.save();
    logger.info(`Usuario actualizado correctamente: ${usuarioActualizado._id}, Nuevo estado: ${usuarioActualizado.activo ? 'activo' : 'inactivo'}`);
    
    // Agregar logging para depuración
    logger.info(`Usuario ${userId} (${user.email}) ${activo ? 'activado' : 'desactivado'} exitosamente por ${req.userId} con rol ${req.userRole}`);
    
    res.status(200).json({
      success: true,
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    logger.error(`Error cambiando estado de usuario: ${error.message}`, { stack: error.stack });
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

// Obtener estadísticas generales de todos los administradores
export const getAdminStats = async (req, res) => {
  try {
    // Obtener todos los administradores con sus locales
    const admins = await User.find({ role: 'admin', activo: true })
      .populate('locales', 'nombre direccion telefono email')
      .populate('primaryLocal', 'nombre direccion')
      .select('-password');
    
    // Preparar respuesta con estadísticas
    const adminStats = await Promise.all(admins.map(async (admin) => {
      // Información detallada de locales con conteo de usuarios
      const localesInfo = [];
      let totalUsuarios = 0;
      
      if (admin.locales && admin.locales.length > 0) {
        // Procesar cada local
        for (const local of admin.locales) {
          // Contar usuarios en este local
          const usuariosEnLocal = await User.countDocuments({ 
            role: 'usuario',
            locales: local._id 
          });
          
          totalUsuarios += usuariosEnLocal;
          
          localesInfo.push({
            id: local._id,
            nombre: local.nombre,
            direccion: local.direccion,
            telefono: local.telefono,
            email: local.email,
            usuariosRegistrados: usuariosEnLocal
          });
        }
      }
      
      // Contar usuarios activos (que se conectaron en los últimos 30 días)
      const treintaDiasAtras = new Date();
      treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
      
      const usuariosActivos = admin.locales && admin.locales.length > 0 
        ? await User.countDocuments({
            role: 'usuario',
            locales: { $in: admin.locales.map(local => local._id) },
            ultimaConexion: { $gte: treintaDiasAtras }
          })
        : 0;
      
      return {
        id: admin._id,
        nombre: admin.nombre,
        email: admin.email,
        telefono: admin.telefono || '',
        activo: admin.activo || true,
        enLinea: admin.enLinea || false,
        ultimaConexion: admin.ultimaConexion,
        fechaCreacion: admin.createdAt,
        totalLocales: localesInfo.length,
        locales: localesInfo,
        estadisticas: {
          totalUsuarios,
          usuariosActivos,
          porcentajeActivos: totalUsuarios > 0 ? Math.round((usuariosActivos / totalUsuarios) * 100) : 0
        },
        primaryLocal: admin.primaryLocal ? {
          id: admin.primaryLocal._id,
          nombre: admin.primaryLocal.nombre,
          direccion: admin.primaryLocal.direccion
        } : null
      };
    }));
    
    res.status(200).json({
      success: true,
      message: 'Estadísticas de administradores obtenidas exitosamente',
      data: {
        totalAdmins: adminStats.length,
        admins: adminStats
      }
    });
  } catch (error) {
    logger.error(`Error obteniendo estadísticas de administradores: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de administradores',
      error: error.message
    });
  }
};

// Obtener estadísticas detalladas de un administrador específico
export const getAdminDetailStats = async (req, res) => {
  try {
    const { adminId } = req.params;
    
    // Verificar permisos
    if (req.userRole === 'admin' && req.userId !== adminId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para ver estadísticas de otro administrador'
      });
    }
    
    // Obtener el administrador con sus locales
    const admin = await User.findOne({ 
      _id: adminId, 
      role: 'admin' 
    })
    .populate('locales', 'nombre direccion activo')
    .populate('primaryLocal', 'nombre direccion')
    .populate('creadoPor', 'nombre email')
    .populate('ultimaModificacion.usuario', 'nombre email')
    .select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }
    
    // Obtener estadísticas detalladas por cada local
    const localesStats = await Promise.all(admin.locales.map(async (local) => {
      // Contar usuarios por rol en este local
      const usuariosCount = await User.countDocuments({ 
        role: 'usuario', 
        locales: local._id 
      });
      
      // Obtener últimos usuarios registrados en este local
      const ultimosUsuarios = await User.find({ 
        role: 'usuario', 
        locales: local._id 
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('nombre email createdAt ultimoAcceso');
      
      // Usuarios activos en últimos 30 días
      const treintaDiasAtras = new Date();
      treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
      
      const usuariosActivos = await User.countDocuments({
        role: 'usuario',
        locales: local._id,
        ultimoAcceso: { $gte: treintaDiasAtras }
      });
      
      return {
        id: local._id,
        nombre: local.nombre,
        direccion: local.direccion,
        activo: local.activo,
        estadisticas: {
          totalUsuarios: usuariosCount,
          usuariosActivos,
          porcentajeActivos: usuariosCount > 0 ? Math.round((usuariosActivos / usuariosCount) * 100) : 0
        },
        ultimosUsuarios
      };
    }));
    
    // Total de usuarios administrados
    const totalUsuarios = localesStats.reduce((sum, local) => sum + local.estadisticas.totalUsuarios, 0);
    
    // Crear objeto de respuesta
    const adminStats = {
      id: admin._id,
      nombre: admin.nombre,
      email: admin.email,
      telefono: admin.telefono,
      activo: admin.activo,
      enLinea: admin.enLinea,
      ultimoAcceso: admin.ultimoAcceso,
      createdAt: admin.createdAt,
      creadoPor: admin.creadoPor,
      ultimaModificacion: admin.ultimaModificacion,
      estadisticas: {
        totalLocales: admin.locales.length,
        totalUsuarios,
        primaryLocal: admin.primaryLocal ? {
          id: admin.primaryLocal._id,
          nombre: admin.primaryLocal.nombre
        } : null
      },
      locales: localesStats
    };
    
    res.status(200).json({
      success: true,
      message: 'Estadísticas detalladas del administrador obtenidas exitosamente',
      data: adminStats
    });
  } catch (error) {
    logger.error(`Error obteniendo estadísticas detalladas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas detalladas del administrador',
      error: error.message
    });
  }
};

/**
 * Asigna un local adicional a un administrador
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const assignLocalToAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { localId } = req.body;

    if (!localId) {
      return res.status(400).json({ success: false, message: 'ID del local es requerido' });
    }

    // Verificar que el administrador existe
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrador no encontrado' });
    }

    // Verificar que el local existe
    const local = await Local.findById(localId);
    if (!local) {
      return res.status(404).json({ success: false, message: 'Local no encontrado' });
    }

    // Verificar si ya tiene asignado este local
    if (admin.locales.includes(localId)) {
      return res.status(400).json({ success: false, message: 'El local ya está asignado a este administrador' });
    }

    // Agregar el local a la lista de locales del administrador
    admin.locales.push(localId);
    
    // Si es el primer local, establecerlo como principal
    if (admin.locales.length === 1) {
      admin.primaryLocal = localId;
    }

    await admin.save();

    logger.info(`Local ${localId} asignado correctamente al administrador ${adminId}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Local asignado correctamente', 
      data: {
        adminId: admin._id,
        locales: admin.locales,
        primaryLocal: admin.primaryLocal
      }
    });
  } catch (error) {
    logger.error(`Error al asignar local al administrador: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al asignar local al administrador', error: error.message });
  }
};

/**
 * Elimina un local asignado a un administrador
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const removeLocalFromAdmin = async (req, res) => {
  try {
    const { adminId, localId } = req.params;

    // Verificar que el administrador existe
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrador no encontrado' });
    }

    // Verificar si el local está asignado
    if (!admin.locales.includes(localId)) {
      return res.status(400).json({ success: false, message: 'El local no está asignado a este administrador' });
    }

    // No permitir eliminar el único local asignado
    if (admin.locales.length === 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el único local asignado. El administrador debe tener al menos un local asignado'
      });
    }

    // Eliminar el local de la lista
    admin.locales = admin.locales.filter(id => id.toString() !== localId);
    
    // Si el local eliminado era el principal, asignar otro como principal
    if (admin.primaryLocal && admin.primaryLocal.toString() === localId) {
      admin.primaryLocal = admin.locales[0];
    }

    await admin.save();

    logger.info(`Local ${localId} eliminado correctamente del administrador ${adminId}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Local eliminado correctamente', 
      data: {
        adminId: admin._id,
        locales: admin.locales,
        primaryLocal: admin.primaryLocal
      }
    });
  } catch (error) {
    logger.error(`Error al eliminar local del administrador: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al eliminar local del administrador', error: error.message });
  }
};

/**
 * Establece un local como principal para un administrador
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const setAdminPrimaryLocal = async (req, res) => {
  try {
    const { adminId, localId } = req.params;

    // Verificar que el administrador existe
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Administrador no encontrado' });
    }

    // Verificar si el local está asignado
    if (!admin.locales.includes(localId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede establecer como principal un local que no está asignado al administrador'
      });
    }

    // Establecer local como principal
    admin.primaryLocal = localId;
    await admin.save();

    logger.info(`Local ${localId} establecido como principal para el administrador ${adminId}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Local principal establecido correctamente', 
      data: {
        adminId: admin._id,
        locales: admin.locales,
        primaryLocal: admin.primaryLocal
      }
    });
  } catch (error) {
    logger.error(`Error al establecer local principal: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Error al establecer local principal', error: error.message });
  }
};

/**
 * Crea un local de demostración y lo asigna a todos los administradores sin locales
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const createDemoLocalAndAssign = async (req, res) => {
  try {
    // Verificar si el usuario es superAdmin
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo superAdmin puede realizar esta operación'
      });
    }

    // Buscar administradores sin locales
    const adminsWithoutLocals = await User.find({
      role: 'admin',
      $or: [
        { locales: { $exists: false } },
        { locales: { $size: 0 } }
      ]
    });

    if (adminsWithoutLocals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay administradores sin locales asignados',
        data: { adminsProcessed: 0 }
      });
    }

    // Buscar si ya existe el local demo
    let demoLocal = await Local.findOne({ nombre: 'Local Demostración' });

    // Si no existe el local demo, crearlo
    if (!demoLocal) {
      demoLocal = await Local.create({
        nombre: 'Local Demostración',
        direccion: 'Dirección de demostración #123',
        telefono: '1234567890',
        email: 'demo@local.com',
        creadoPor: req.userId,
        ultimaModificacion: {
          usuario: req.userId,
          fecha: Date.now()
        }
      });
      logger.info(`Local de demostración creado con ID: ${demoLocal._id}`);
    }

    // Asignar el local demo a cada administrador sin locales
    const processedAdmins = [];
    
    for (const admin of adminsWithoutLocals) {
      await admin.agregarLocal(demoLocal._id);
      processedAdmins.push({
        id: admin._id,
        nombre: admin.nombre,
        email: admin.email
      });
      logger.info(`Local de demostración asignado al administrador: ${admin.email}`);
    }

    // Actualizar estadísticas del local
    await demoLocal.actualizarEstadisticas();

    return res.status(200).json({
      success: true,
      message: `Local de demostración asignado a ${processedAdmins.length} administradores`,
      data: {
        local: {
          id: demoLocal._id,
          nombre: demoLocal.nombre,
          direccion: demoLocal.direccion
        },
        adminsProcessed: processedAdmins.length,
        admins: processedAdmins
      }
    });
  } catch (error) {
    logger.error(`Error asignando local demo a administradores: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Error al asignar local demo a administradores',
      error: error.message
    });
  }
};

/**
 * Crea usuarios de demostración y los asigna a los locales de los administradores
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 */
export const createDemoUsersForAdmins = async (req, res) => {
  try {
    // Verificar si el usuario es superAdmin
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo superAdmin puede realizar esta operación'
      });
    }

    // Encontrar todos los administradores con locales asignados
    const adminsWithLocals = await User.find({
      role: 'admin',
      locales: { $exists: true, $ne: [] }
    }).populate('locales', 'nombre');

    if (adminsWithLocals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay administradores con locales asignados',
        data: { adminsProcessed: 0 }
      });
    }

    // Para cada administrador, crear usuarios de demostración
    const results = [];
    
    for (const admin of adminsWithLocals) {
      const adminResult = {
        adminId: admin._id,
        adminEmail: admin.email,
        locales: [],
        usersCreated: 0
      };
      
      // Procesar cada local del administrador
      for (const local of admin.locales) {
        const localResult = {
          localId: local._id,
          localNombre: local.nombre,
          usersCreated: []
        };
        
        // Crear 3 usuarios de demostración para este local
        for (let i = 1; i <= 3; i++) {
          const userName = `Usuario Demo ${i} (${local.nombre})`;
          const userEmail = `usuario_demo_${i}_${local._id.toString().substring(0, 5)}@demoapp.com`;
          
          // Verificar si el usuario ya existe
          const userExists = await User.findOne({ email: userEmail });
          
          if (!userExists) {
            // Crear nuevo usuario
            const newUser = await User.create({
              nombre: userName,
              email: userEmail,
              password: 'Demo@1234', // Contraseña segura para demo
              role: 'usuario',
              telefono: `123456789${i}`,
              locales: [local._id],
              primaryLocal: local._id,
              verificado: true,
              activo: true,
              creadoPor: req.userId,
              ultimaModificacion: {
                usuario: req.userId,
                fecha: Date.now()
              }
            });
            
            localResult.usersCreated.push({
              id: newUser._id,
              nombre: newUser.nombre,
              email: newUser.email
            });
            
            adminResult.usersCreated++;
          }
        }
        
        adminResult.locales.push(localResult);
      }
      
      results.push(adminResult);
    }
    
    // Actualizar estadísticas de los locales
    for (const admin of adminsWithLocals) {
      for (const localId of admin.locales) {
        const local = await Local.findById(localId);
        if (local) {
          await local.actualizarEstadisticas();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Usuarios de demostración creados y asignados exitosamente',
      data: {
        adminsProcessed: results.length,
        results
      }
    });
  } catch (error) {
    logger.error(`Error creando usuarios de demostración: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Error al crear usuarios de demostración',
      error: error.message 
    });
  }
}; 