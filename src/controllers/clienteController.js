import Cliente from '../models/Cliente.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

// Obtener todos los clientes
export const getClientes = async (req, res) => {
  try {
    const { local, limit = 50, skip = 0, sort = 'nombre', categoria, buscar } = req.query;
    
    // Construir el filtro
    const filtro = {};
    
    // Filtro por local
    if (local) {
      filtro.local = local;
    } else if (req.user.primaryLocal) {
      filtro.local = req.user.primaryLocal;
    }
    
    // Filtro por categoría
    if (categoria) {
      filtro.categoria = categoria;
    }
    
    // Búsqueda por texto
    if (buscar) {
      filtro.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { apellido: { $regex: buscar, $options: 'i' } },
        { email: { $regex: buscar, $options: 'i' } },
        { telefono: { $regex: buscar, $options: 'i' } }
      ];
    }
    
    // Obtener total de documentos para paginación
    const total = await Cliente.countDocuments(filtro);
    
    // Ejecutar consulta
    const clientes = await Cliente.find(filtro)
      .populate('local', 'nombre')
      .populate('asignadoA', 'nombre email')
      .sort(sort)
      .limit(Number(limit))
      .skip(Number(skip));
      
    res.json({
      success: true,
      total,
      count: clientes.length,
      data: clientes
    });
  } catch (error) {
    logger.error(`Error al obtener clientes: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener clientes',
      error: error.message
    });
  }
};

// Obtener un cliente por ID
export const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cliente = await Cliente.findById(id)
      .populate('local', 'nombre')
      .populate('asignadoA', 'nombre email')
      .populate('creadoPor', 'nombre email');
      
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    logger.error(`Error al obtener cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
};

// Crear un nuevo cliente
export const createCliente = async (req, res) => {
  try {
    const { 
      nombre, apellido, email, telefono, direccion, 
      fechaNacimiento, documentoIdentidad, categoria, 
      etiquetas, preferencias, local, asignadoA 
    } = req.body;
    
    // Verificar si el email ya existe
    const clienteExistente = await Cliente.findOne({ email, local });
    if (clienteExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con este email en este local'
      });
    }
    
    // Crear el cliente
    const nuevoCliente = new Cliente({
      nombre,
      apellido,
      email,
      telefono,
      direccion,
      fechaNacimiento,
      documentoIdentidad,
      categoria,
      etiquetas,
      preferencias,
      local: local || req.user.primaryLocal,
      asignadoA: asignadoA || req.user._id,
      creadoPor: req.user._id
    });
    
    await nuevoCliente.save();
    
    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: nuevoCliente
    });
  } catch (error) {
    logger.error(`Error al crear cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear cliente',
      error: error.message
    });
  }
};

// Actualizar un cliente existente
export const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nombre, apellido, email, telefono, direccion, 
      fechaNacimiento, documentoIdentidad, categoria, 
      etiquetas, preferencias, local, asignadoA, activo
    } = req.body;
    
    // Verificar que el cliente existe
    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    // Verificar si el email ya está en uso por otro cliente
    if (email && email !== cliente.email) {
      const emailExiste = await Cliente.findOne({ 
        email, 
        local: local || cliente.local,
        _id: { $ne: id }
      });
      
      if (emailExiste) {
        return res.status(400).json({
          success: false,
          message: 'Este email ya está en uso por otro cliente'
        });
      }
    }
    
    // Actualizar cliente
    const clienteActualizado = await Cliente.findByIdAndUpdate(
      id,
      { 
        nombre, 
        apellido, 
        email, 
        telefono, 
        direccion,
        fechaNacimiento, 
        documentoIdentidad, 
        categoria,
        etiquetas, 
        preferencias, 
        local, 
        asignadoA,
        activo,
        ultimoContacto: new Date()
      },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: clienteActualizado
    });
  } catch (error) {
    logger.error(`Error al actualizar cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente',
      error: error.message
    });
  }
};

// Eliminar un cliente
export const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar y eliminar el cliente
    const clienteEliminado = await Cliente.findByIdAndDelete(id);
    
    if (!clienteEliminado) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
      data: clienteEliminado
    });
  } catch (error) {
    logger.error(`Error al eliminar cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cliente',
      error: error.message
    });
  }
};

// Agregar una nota a un cliente
export const addNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    
    if (!contenido) {
      return res.status(400).json({
        success: false,
        message: 'El contenido de la nota es obligatorio'
      });
    }
    
    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    // Agregar la nota
    cliente.notas.push({
      contenido,
      autor: req.user._id,
      fecha: new Date()
    });
    
    await cliente.save();
    
    res.status(201).json({
      success: true,
      message: 'Nota agregada exitosamente',
      data: cliente.notas[cliente.notas.length - 1]
    });
  } catch (error) {
    logger.error(`Error al agregar nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al agregar nota',
      error: error.message
    });
  }
};

// Registrar interacción con un cliente
export const addInteraccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, descripcion, resultado } = req.body;
    
    if (!tipo || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'El tipo y la descripción son obligatorios'
      });
    }
    
    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    // Agregar la interacción
    const nuevaInteraccion = {
      tipo,
      descripcion,
      resultado,
      fecha: new Date(),
      usuario: req.user._id
    };
    
    cliente.historialInteracciones.push(nuevaInteraccion);
    cliente.ultimoContacto = new Date();
    
    await cliente.save();
    
    res.status(201).json({
      success: true,
      message: 'Interacción registrada exitosamente',
      data: nuevaInteraccion
    });
  } catch (error) {
    logger.error(`Error al registrar interacción: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al registrar interacción',
      error: error.message
    });
  }
};

// Obtener estadísticas de clientes
export const getEstadisticas = async (req, res) => {
  try {
    const { local } = req.query;
    const localId = local || req.user.primaryLocal;
    
    // Total de clientes por categoría
    const categorias = await Cliente.aggregate([
      { $match: { local: localId ? new mongoose.Types.ObjectId(localId) : { $exists: true } } },
      { $group: { _id: '$categoria', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Clientes nuevos en el último mes
    const unMesAtras = new Date();
    unMesAtras.setMonth(unMesAtras.getMonth() - 1);
    
    const clientesNuevos = await Cliente.countDocuments({
      local: localId,
      fechaCreacion: { $gte: unMesAtras }
    });
    
    // Total de clientes
    const totalClientes = await Cliente.countDocuments({ local: localId });
    
    res.json({
      success: true,
      data: {
        totalClientes,
        clientesNuevos,
        porCategoria: categorias
      }
    });
  } catch (error) {
    logger.error(`Error al obtener estadísticas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
}; 