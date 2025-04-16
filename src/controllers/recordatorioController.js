import Recordatorio from '../models/Recordatorio.js';
import logger from '../config/logger.js';

// Obtener todos los recordatorios
export const getRecordatorios = async (req, res) => {
  try {
    const { 
      estado, 
      tipo, 
      evento, 
      cliente, 
      fechaDesde, 
      fechaHasta, 
      local, 
      limit = 50, 
      skip = 0 
    } = req.query;
    
    // Construir el filtro
    const filtro = {};
    
    // Filtro por local
    if (local) {
      filtro.local = local;
    } else if (req.user.primaryLocal) {
      filtro.local = req.user.primaryLocal;
    }
    
    // Filtro por estado
    if (estado) {
      filtro.estado = estado;
    }
    
    // Filtro por tipo
    if (tipo) {
      filtro.tipo = tipo;
    }
    
    // Filtro por evento
    if (evento) {
      filtro.evento = evento;
    }
    
    // Filtro por cliente
    if (cliente) {
      filtro.cliente = cliente;
    }
    
    // Filtro por rango de fechas
    if (fechaDesde || fechaHasta) {
      filtro.fechaProgramada = {};
      
      if (fechaDesde) {
        filtro.fechaProgramada.$gte = new Date(fechaDesde);
      }
      
      if (fechaHasta) {
        filtro.fechaProgramada.$lte = new Date(fechaHasta);
      }
    }
    
    // Por defecto, mostrar recordatorios del usuario
    filtro['destinatarios.id'] = req.user._id;
    
    // Obtener total de documentos para paginación
    const total = await Recordatorio.countDocuments(filtro);
    
    // Ejecutar consulta
    const recordatorios = await Recordatorio.find(filtro)
      .populate('evento', 'titulo fechaInicio')
      .populate('cliente', 'nombre apellido email')
      .populate('local', 'nombre')
      .populate('creadoPor', 'nombre email')
      .sort({ fechaProgramada: 1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    res.json({
      success: true,
      total,
      count: recordatorios.length,
      data: recordatorios
    });
  } catch (error) {
    logger.error(`Error al obtener recordatorios: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recordatorios',
      error: error.message
    });
  }
};

// Obtener un recordatorio por ID
export const getRecordatorioById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const recordatorio = await Recordatorio.findById(id)
      .populate('evento', 'titulo fechaInicio')
      .populate('cliente', 'nombre apellido email')
      .populate('local', 'nombre')
      .populate('creadoPor', 'nombre email');
      
    if (!recordatorio) {
      return res.status(404).json({
        success: false,
        message: 'Recordatorio no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: recordatorio
    });
  } catch (error) {
    logger.error(`Error al obtener recordatorio: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recordatorio',
      error: error.message
    });
  }
};

// Crear un nuevo recordatorio
export const createRecordatorio = async (req, res) => {
  try {
    const { 
      titulo, descripcion, evento, cliente, fechaProgramada, 
      tiempo, tipo, destinatarios, plantillaPersonalizada, prioridad, local
    } = req.body;
    
    // Crear el recordatorio
    const nuevoRecordatorio = new Recordatorio({
      titulo,
      descripcion,
      evento,
      cliente,
      fechaProgramada: new Date(fechaProgramada),
      tiempo,
      tipo,
      plantillaPersonalizada,
      prioridad,
      local: local || req.user.primaryLocal,
      creadoPor: req.user._id
    });
    
    // Agregar destinatarios
    if (destinatarios && destinatarios.length > 0) {
      nuevoRecordatorio.destinatarios = destinatarios;
    } else {
      // Por defecto, agregar al usuario actual como destinatario
      nuevoRecordatorio.destinatarios = [
        {
          tipo: 'USUARIO',
          id: req.user._id
        }
      ];
    }
    
    // Guardar recordatorio
    await nuevoRecordatorio.save();
    
    res.status(201).json({
      success: true,
      message: 'Recordatorio creado exitosamente',
      data: nuevoRecordatorio
    });
  } catch (error) {
    logger.error(`Error al crear recordatorio: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear recordatorio',
      error: error.message
    });
  }
};

// Actualizar un recordatorio existente
export const updateRecordatorio = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      titulo, descripcion, evento, cliente, fechaProgramada, 
      tiempo, tipo, destinatarios, estado, plantillaPersonalizada, prioridad
    } = req.body;
    
    // Verificar que el recordatorio existe
    const recordatorio = await Recordatorio.findById(id);
    if (!recordatorio) {
      return res.status(404).json({
        success: false,
        message: 'Recordatorio no encontrado'
      });
    }
    
    // Verificar permiso (solo el creador o usuarios en destinatarios pueden actualizar)
    const puedeActualizar = 
      recordatorio.creadoPor.toString() === req.user._id.toString() ||
      recordatorio.destinatarios.some(d => d.id.toString() === req.user._id.toString());
      
    if (!puedeActualizar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar este recordatorio'
      });
    }
    
    // Crear objeto con datos a actualizar
    const datosActualizados = {
      titulo,
      descripcion,
      evento,
      cliente,
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : undefined,
      tiempo,
      tipo,
      destinatarios,
      estado,
      plantillaPersonalizada,
      prioridad
    };
    
    // Eliminar propiedades undefined
    Object.keys(datosActualizados).forEach(key => 
      datosActualizados[key] === undefined && delete datosActualizados[key]
    );
    
    // Actualizar recordatorio
    const recordatorioActualizado = await Recordatorio.findByIdAndUpdate(
      id,
      datosActualizados,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Recordatorio actualizado exitosamente',
      data: recordatorioActualizado
    });
  } catch (error) {
    logger.error(`Error al actualizar recordatorio: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar recordatorio',
      error: error.message
    });
  }
};

// Eliminar un recordatorio
export const deleteRecordatorio = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar el recordatorio
    const recordatorio = await Recordatorio.findById(id);
    
    if (!recordatorio) {
      return res.status(404).json({
        success: false,
        message: 'Recordatorio no encontrado'
      });
    }
    
    // Verificar permiso (solo el creador puede eliminar)
    if (recordatorio.creadoPor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este recordatorio'
      });
    }
    
    // Eliminar recordatorio
    await Recordatorio.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Recordatorio eliminado exitosamente',
      data: recordatorio
    });
  } catch (error) {
    logger.error(`Error al eliminar recordatorio: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar recordatorio',
      error: error.message
    });
  }
};

// Marcar recordatorio como enviado/completado
export const marcarEnviado = async (req, res) => {
  try {
    const { id } = req.params;
    
    const recordatorio = await Recordatorio.findById(id);
    if (!recordatorio) {
      return res.status(404).json({
        success: false,
        message: 'Recordatorio no encontrado'
      });
    }
    
    // Actualizar estado
    recordatorio.estado = 'ENVIADO';
    recordatorio.ultimoIntento = new Date();
    
    // Actualizar destinatarios
    recordatorio.destinatarios.forEach(destinatario => {
      destinatario.notificado = true;
    });
    
    await recordatorio.save();
    
    res.json({
      success: true,
      message: 'Recordatorio marcado como enviado',
      data: recordatorio
    });
  } catch (error) {
    logger.error(`Error al marcar recordatorio como enviado: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al marcar recordatorio como enviado',
      error: error.message
    });
  }
};

// Obtener recordatorios pendientes para procesamiento
export const getRecordatoriosPendientes = async (req, res) => {
  try {
    const ahora = new Date();
    
    const recordatoriosPendientes = await Recordatorio.find({
      fechaProgramada: { $lte: ahora },
      estado: 'PENDIENTE'
    })
    .populate('evento', 'titulo fechaInicio')
    .populate('cliente', 'nombre apellido email telefono')
    .sort({ prioridad: -1, fechaProgramada: 1 });
    
    res.json({
      success: true,
      count: recordatoriosPendientes.length,
      data: recordatoriosPendientes
    });
  } catch (error) {
    logger.error(`Error al obtener recordatorios pendientes: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recordatorios pendientes',
      error: error.message
    });
  }
}; 