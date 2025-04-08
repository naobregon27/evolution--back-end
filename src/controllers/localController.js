import Local from '../models/Local.js';
import User from '../models/User.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

// Crear un nuevo local (solo superAdmin)
export const createLocal = async (req, res) => {
  try {
    const { nombre, direccion, telefono, email, horario } = req.body;
    
    // Verificar si ya existe un local con ese nombre
    const existingLocal = await Local.findOne({ nombre });
    if (existingLocal) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un local/marca con ese nombre'
      });
    }
    
    // Crear el local
    const local = await Local.create({
      nombre,
      direccion,
      telefono,
      email,
      horario,
      creadoPor: req.userId,
      ultimaModificacion: {
        usuario: req.userId,
        fecha: Date.now()
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Local/Marca creado exitosamente',
      data: local
    });
  } catch (error) {
    logger.error(`Error creando local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear el local/marca',
      error: error.message
    });
  }
};

// Obtener todos los locales
export const getAllLocales = async (req, res) => {
  try {
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtros
    const filters = {};
    
    if (req.query.activo === 'true') filters.activo = true;
    if (req.query.activo === 'false') filters.activo = false;
    if (req.query.search) {
      filters.nombre = { $regex: req.query.search, $options: 'i' };
    }
    
    // Si es admin, solo puede ver su propio local
    if (req.userRole === 'admin' && req.user.local) {
      filters._id = req.user.local;
    }
    
    // Ejecutar consulta
    const locales = await Local.find(filters)
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Contar total
    const total = await Local.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        locales,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Error obteniendo locales: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los locales/marcas',
      error: error.message
    });
  }
};

// Obtener un local por ID
export const getLocalById = async (req, res) => {
  try {
    const { localId } = req.params;
    
    const local = await Local.findById(localId)
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email');
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Si es admin, verificar que sea de su local
    if (req.userRole === 'admin' && 
        (!req.user.local || req.user.local.toString() !== local._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a este local/marca'
      });
    }
    
    res.status(200).json({
      success: true,
      data: local
    });
  } catch (error) {
    logger.error(`Error obteniendo local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el local/marca',
      error: error.message
    });
  }
};

// Actualizar un local
export const updateLocal = async (req, res) => {
  try {
    const { localId } = req.params;
    const updateData = req.body;
    
    // Verificar si el local existe
    const local = await Local.findById(localId);
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Si es admin, verificar que sea de su local
    if (req.userRole === 'admin' && 
        (!req.user.local || req.user.local.toString() !== local._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar este local/marca'
      });
    }
    
    // Registrar quien modificó
    updateData.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    // Actualizar
    const updatedLocal = await Local.findByIdAndUpdate(
      localId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('creadoPor', 'nombre email')
     .populate('ultimaModificacion.usuario', 'nombre email');
    
    res.status(200).json({
      success: true,
      message: 'Local/Marca actualizado exitosamente',
      data: updatedLocal
    });
  } catch (error) {
    logger.error(`Error actualizando local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el local/marca',
      error: error.message
    });
  }
};

// Activar/Desactivar local
export const toggleLocalStatus = async (req, res) => {
  try {
    const { localId } = req.params;
    const { activo } = req.body;
    
    // Verificar si el local existe
    const local = await Local.findById(localId);
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Solo superAdmin puede desactivar locales
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo el superAdmin puede cambiar el estado de un local/marca'
      });
    }
    
    // Si se va a desactivar, verificar si tiene usuarios activos
    if (activo === false) {
      const usuariosActivos = await User.countDocuments({ 
        local: localId, 
        activo: true 
      });
      
      if (usuariosActivos > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede desactivar el local/marca porque tiene ${usuariosActivos} usuarios activos asociados`
        });
      }
    }
    
    // Actualizar estado
    local.activo = activo;
    local.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    await local.save();
    
    res.status(200).json({
      success: true,
      message: `Local/Marca ${activo ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    logger.error(`Error cambiando estado de local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado del local/marca',
      error: error.message
    });
  }
};

// Obtener usuarios de un local
export const getLocalUsers = async (req, res) => {
  try {
    const { localId } = req.params;
    
    // Verificar si el local existe
    const local = await Local.findById(localId);
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Si es admin, verificar que sea de su local
    if (req.userRole === 'admin' && 
        (!req.user.local || req.user.local.toString() !== local._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a este local/marca'
      });
    }
    
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtros
    const filters = { local: localId };
    
    if (req.query.role) filters.role = req.query.role;
    if (req.query.activo === 'true') filters.activo = true;
    if (req.query.activo === 'false') filters.activo = false;
    if (req.query.enLinea === 'true') filters.enLinea = true;
    if (req.query.enLinea === 'false') filters.enLinea = false;
    if (req.query.search) {
      filters.$or = [
        { nombre: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Ejecutar consulta
    const usuarios = await User.find(filters)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Obtener estadísticas de usuarios del local
    const stats = await User.aggregate([
      { $match: { local: mongoose.Types.ObjectId.createFromHexString(localId) } },
      { 
        $group: {
          _id: null,
          total: { $sum: 1 },
          activos: { $sum: { $cond: [{ $eq: ["$activo", true] }, 1, 0] } },
          enLinea: { $sum: { $cond: [{ $eq: ["$enLinea", true] }, 1, 0] } },
          admin: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
          usuarios: { $sum: { $cond: [{ $eq: ["$role", "usuario"] }, 1, 0] } }
        }
      }
    ]);
    
    // Contar total
    const total = await User.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        usuarios,
        stats: stats.length > 0 ? stats[0] : {
          total: 0,
          activos: 0,
          enLinea: 0,
          admin: 0,
          usuarios: 0
        },
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Error obteniendo usuarios del local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios del local/marca',
      error: error.message
    });
  }
};

// Asignar administrador a un local
export const assignLocalAdmin = async (req, res) => {
  try {
    const { localId } = req.params;
    const { userId } = req.body;
    
    // Verificar si el local existe
    const local = await Local.findById(localId);
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Verificar si el usuario existe
    const usuario = await User.findById(userId);
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Solo superAdmin puede asignar administradores
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo el superAdmin puede asignar administradores a un local/marca'
      });
    }
    
    // Verificar si el local ya tiene administradores
    const adminCount = await User.countDocuments({
      role: 'admin',
      local: localId,
      activo: true
    });
    
    // Actualizar el usuario
    usuario.role = 'admin';
    usuario.local = localId;
    usuario.esAdministradorLocal = true;
    usuario.activo = true; // Asegurarnos que está activo
    usuario.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    await usuario.save();
    
    res.status(200).json({
      success: true,
      message: 'Administrador asignado exitosamente al local/marca',
      data: {
        adminCount: adminCount + 1,
        isFirstAdmin: adminCount === 0
      }
    });
  } catch (error) {
    logger.error(`Error asignando administrador: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al asignar administrador al local/marca',
      error: error.message
    });
  }
};

// Desasignar usuario de un local
export const unassignUserFromLocal = async (req, res) => {
  try {
    const { localId, userId } = req.params;
    
    // Verificar si el local existe
    const local = await Local.findById(localId);
    
    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local/Marca no encontrado'
      });
    }
    
    // Verificar si el usuario existe
    const usuario = await User.findById(userId);
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar que el usuario pertenezca al local
    if (!usuario.local || usuario.local.toString() !== localId) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no está asignado a este local/marca'
      });
    }
    
    // Verificar permisos
    if (req.userRole === 'admin') {
      // Admin solo puede desasignar usuarios regulares de su local
      if (usuario.role !== 'usuario' || 
          !req.user.local || 
          req.user.local.toString() !== localId) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para desasignar este usuario'
        });
      }
    } else if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para desasignar usuarios'
      });
    }
    
    // Si es admin, no permitir desasignación
    if (usuario.role === 'admin') {
      // Solo superAdmin puede desasignar admin, y debe hacerlo de otra forma
      return res.status(400).json({
        success: false,
        message: 'Los administradores no pueden ser desasignados directamente, debe cambiar su rol primero'
      });
    }
    
    // Desasignar al usuario (se necesitaría otro lugar para asignarlo)
    usuario.local = null;
    usuario.activo = false; // Desactivar al usuario al desasignarlo
    usuario.enLinea = false; // Desconectar al usuario
    usuario.ultimaModificacion = {
      usuario: req.userId,
      fecha: Date.now()
    };
    
    await usuario.save();
    
    res.status(200).json({
      success: true,
      message: 'Usuario desasignado exitosamente del local/marca'
    });
  } catch (error) {
    logger.error(`Error desasignando usuario: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al desasignar usuario del local/marca',
      error: error.message
    });
  }
};

// Obtener estadísticas de usuarios por local
export const getLocalUserStats = async (req, res) => {
  try {
    // Si es admin, solo puede ver estadísticas de su local
    let match = {};
    
    if (req.userRole === 'admin' && req.user.local) {
      match = { local: mongoose.Types.ObjectId.createFromHexString(req.user.local.toString()) };
    } else if (req.params.localId) {
      match = { local: mongoose.Types.ObjectId.createFromHexString(req.params.localId) };
    }
    
    // Obtener estadísticas
    const stats = await User.aggregate([
      { $match: match },
      { 
        $group: {
          _id: '$local',
          total: { $sum: 1 },
          activos: { $sum: { $cond: [{ $eq: ["$activo", true] }, 1, 0] } },
          enLinea: { $sum: { $cond: [{ $eq: ["$enLinea", true] }, 1, 0] } },
          admin: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
          usuarios: { $sum: { $cond: [{ $eq: ["$role", "usuario"] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'locals', // Nombre de la colección en MongoDB
          localField: '_id',
          foreignField: '_id',
          as: 'localInfo'
        }
      },
      {
        $unwind: {
          path: '$localInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          total: 1,
          activos: 1,
          enLinea: 1,
          admin: 1,
          usuarios: 1,
          nombreLocal: '$localInfo.nombre',
          direccionLocal: '$localInfo.direccion'
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error obteniendo estadísticas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de usuarios por local',
      error: error.message
    });
  }
}; 