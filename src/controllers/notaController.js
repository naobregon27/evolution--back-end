import Nota from '../models/Nota.js';
import logger from '../config/logger.js';

// Obtener todas las notas
export const getNotas = async (req, res) => {
  try {
    const { 
      tipo, 
      cliente, 
      evento, 
      buscar, 
      esFavorita, 
      esArchivada, 
      etiqueta, 
      local, 
      limit = 50, 
      skip = 0 
    } = req.query;
    
    // Construir filtro base
    const filtroBase = {};
    
    // Filtro por local
    if (local) {
      filtroBase.local = local;
    } else if (req.user.primaryLocal) {
      filtroBase.local = req.user.primaryLocal;
    }
    
    // Filtro por tipo
    if (tipo) {
      filtroBase.tipo = tipo;
    }
    
    // Filtro por cliente
    if (cliente) {
      filtroBase.cliente = cliente;
    }
    
    // Filtro por evento
    if (evento) {
      filtroBase.evento = evento;
    }
    
    // Filtro por favoritas
    if (esFavorita === 'true') {
      filtroBase.esFavorita = true;
    }
    
    // Filtro por archivadas
    if (esArchivada === 'true') {
      filtroBase.esArchivada = true;
    } else if (esArchivada !== 'all') {
      // Por defecto, no mostrar archivadas
      filtroBase.esArchivada = { $ne: true };
    }
    
    // Filtro por etiqueta
    if (etiqueta) {
      filtroBase.etiquetas = etiqueta;
    }
    
    // Búsqueda por texto
    if (buscar) {
      filtroBase.$or = [
        { titulo: { $regex: buscar, $options: 'i' } },
        { contenido: { $regex: buscar, $options: 'i' } }
      ];
    }
    
    // Filtro de permisos
    const filtro = {
      $and: [
        filtroBase,
        {
          $or: [
            { creadoPor: req.user._id }, // Notas creadas por el usuario
            { 
              'compartidaCon.usuario': req.user._id,
              'compartidaCon.permisos.lectura': true 
            }, // Notas compartidas con el usuario
            { visibilidad: 'PUBLICA' } // Notas públicas
          ]
        }
      ]
    };
    
    // Obtener total de documentos para paginación
    const total = await Nota.countDocuments(filtro);
    
    // Ejecutar consulta
    const notas = await Nota.find(filtro)
      .populate('cliente', 'nombre apellido')
      .populate('evento', 'titulo fechaInicio')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email')
      .populate('compartidaCon.usuario', 'nombre email')
      .sort({ fechaCreacion: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    res.json({
      success: true,
      total,
      count: notas.length,
      data: notas
    });
  } catch (error) {
    logger.error(`Error al obtener notas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notas',
      error: error.message
    });
  }
};

// Obtener una nota por ID
export const getNotaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const nota = await Nota.findById(id)
      .populate('cliente', 'nombre apellido')
      .populate('evento', 'titulo fechaInicio')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email')
      .populate('compartidaCon.usuario', 'nombre email')
      .populate('historialVersiones.usuario', 'nombre email');
      
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso de lectura
    const puedeVer = 
      nota.creadoPor && nota.creadoPor.toString() === req.user._id.toString() ||
      nota.visibilidad === 'PUBLICA' ||
      (nota.visibilidad === 'EQUIPO' && req.user.locales.includes(nota.local)) ||
      nota.compartidaCon.some(c => 
        c.usuario && c.usuario._id && // Verificar que usuario no sea null
        c.usuario._id.toString() === req.user._id.toString() && 
        c.permisos.lectura
      );
      
    if (!puedeVer) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta nota'
      });
    }
    
    res.json({
      success: true,
      data: nota
    });
  } catch (error) {
    logger.error(`Error al obtener nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener nota',
      error: error.message
    });
  }
};

// Crear una nueva nota
export const createNota = async (req, res) => {
  try {
    const { 
      titulo, contenido, tipo, cliente, evento, etiquetas,
      color, recordatorio, visibilidad, compartirCon, local
    } = req.body;
    
    // Validar datos obligatorios
    if (!titulo || !contenido) {
      return res.status(400).json({
        success: false,
        message: 'El título y contenido son obligatorios'
      });
    }
    
    // Crear la nota
    const nuevaNota = new Nota({
      titulo,
      contenido,
      tipo,
      cliente,
      evento,
      etiquetas,
      color,
      recordatorio,
      visibilidad: visibilidad || 'PRIVADA',
      local: local || req.user.primaryLocal,
      creadoPor: req.user._id,
      ultimaModificacion: {
        usuario: req.user._id,
        fecha: new Date()
      }
    });
    
    // Agregar usuarios con quienes se comparte
    if (compartirCon && compartirCon.length > 0) {
      nuevaNota.compartidaCon = compartirCon.map(c => ({
        usuario: c.usuario,
        permisos: c.permisos || { lectura: true, edicion: false, eliminacion: false },
        fechaCompartida: new Date()
      }));
    }
    
    // Guardar nota
    await nuevaNota.save();
    
    res.status(201).json({
      success: true,
      message: 'Nota creada exitosamente',
      data: nuevaNota
    });
  } catch (error) {
    logger.error(`Error al crear nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear nota',
      error: error.message
    });
  }
};

// Actualizar una nota existente
export const updateNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      titulo, contenido, tipo, cliente, evento, etiquetas,
      color, recordatorio, visibilidad, compartirCon, esFavorita, esArchivada
    } = req.body;
    
    // Verificar que la nota existe
    const nota = await Nota.findById(id);
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso de edición
    const puedeEditar = 
      nota.creadoPor.toString() === req.user._id.toString() ||
      nota.compartidaCon.some(c => 
        c.usuario.toString() === req.user._id.toString() && 
        c.permisos.edicion
      );
      
    if (!puedeEditar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar esta nota'
      });
    }
    
    // Si el contenido ha cambiado, añadir versión al historial
    if (contenido && contenido !== nota.contenido) {
      nota.addVersion(req.user._id);
    }
    
    // Actualizar datos
    if (titulo) nota.titulo = titulo;
    if (contenido) nota.contenido = contenido;
    if (tipo) nota.tipo = tipo;
    if (cliente !== undefined) nota.cliente = cliente;
    if (evento !== undefined) nota.evento = evento;
    if (etiquetas) nota.etiquetas = etiquetas;
    if (color) nota.color = color;
    if (recordatorio) nota.recordatorio = recordatorio;
    if (visibilidad) nota.visibilidad = visibilidad;
    if (esFavorita !== undefined) nota.esFavorita = esFavorita;
    if (esArchivada !== undefined) nota.esArchivada = esArchivada;
    
    // Actualizar usuarios con quienes se comparte
    if (compartirCon && Array.isArray(compartirCon)) {
      nota.compartidaCon = compartirCon.map(c => ({
        usuario: c.usuario,
        permisos: c.permisos || { lectura: true, edicion: false, eliminacion: false },
        fechaCompartida: new Date()
      }));
    }
    
    // Actualizar información de modificación
    nota.ultimaModificacion = {
      usuario: req.user._id,
      fecha: new Date()
    };
    
    // Guardar cambios
    await nota.save();
    
    res.json({
      success: true,
      message: 'Nota actualizada exitosamente',
      data: nota
    });
  } catch (error) {
    logger.error(`Error al actualizar nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar nota',
      error: error.message
    });
  }
};

// Eliminar una nota
export const deleteNota = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar la nota
    const nota = await Nota.findById(id);
    
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso de eliminación
    const puedeEliminar = 
      nota.creadoPor.toString() === req.user._id.toString() ||
      nota.compartidaCon.some(c => 
        c.usuario.toString() === req.user._id.toString() && 
        c.permisos.eliminacion
      );
      
    if (!puedeEliminar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar esta nota'
      });
    }
    
    // Eliminar nota
    await Nota.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Nota eliminada exitosamente',
      data: nota
    });
  } catch (error) {
    logger.error(`Error al eliminar nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar nota',
      error: error.message
    });
  }
};

// Compartir una nota con otros usuarios
export const compartirNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarios } = req.body;
    
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se debe proporcionar al menos un usuario para compartir'
      });
    }
    
    // Verificar que la nota existe
    const nota = await Nota.findById(id);
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso (sólo el creador puede compartir)
    if (nota.creadoPor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para compartir esta nota'
      });
    }
    
    // Agregar usuarios
    for (const usuario of usuarios) {
      // Verificar si ya existe
      const index = nota.compartidaCon.findIndex(
        c => c.usuario.toString() === usuario.id.toString()
      );
      
      if (index !== -1) {
        // Actualizar permisos
        nota.compartidaCon[index].permisos = usuario.permisos || 
          { lectura: true, edicion: false, eliminacion: false };
      } else {
        // Agregar nuevo
        nota.compartidaCon.push({
          usuario: usuario.id,
          permisos: usuario.permisos || { lectura: true, edicion: false, eliminacion: false },
          fechaCompartida: new Date()
        });
      }
    }
    
    // Guardar cambios
    await nota.save();
    
    res.json({
      success: true,
      message: 'Nota compartida exitosamente',
      data: nota
    });
  } catch (error) {
    logger.error(`Error al compartir nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al compartir nota',
      error: error.message
    });
  }
};

// Dejar de compartir una nota con un usuario
export const dejarDeCompartir = async (req, res) => {
  try {
    const { id, usuarioId } = req.params;
    
    // Verificar que la nota existe
    const nota = await Nota.findById(id);
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso (sólo el creador puede dejar de compartir)
    if (nota.creadoPor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar el acceso a esta nota'
      });
    }
    
    // Eliminar usuario de la lista de compartidos
    nota.compartidaCon = nota.compartidaCon.filter(
      c => c.usuario.toString() !== usuarioId
    );
    
    // Guardar cambios
    await nota.save();
    
    res.json({
      success: true,
      message: 'Se ha dejado de compartir la nota con el usuario',
      data: nota
    });
  } catch (error) {
    logger.error(`Error al dejar de compartir nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al dejar de compartir nota',
      error: error.message
    });
  }
};

// Obtener historial de versiones
export const getVersiones = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la nota existe
    const nota = await Nota.findById(id)
      .populate('historialVersiones.usuario', 'nombre email')
      .select('historialVersiones');
      
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    res.json({
      success: true,
      count: nota.historialVersiones.length,
      data: nota.historialVersiones
    });
  } catch (error) {
    logger.error(`Error al obtener versiones de nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener versiones de nota',
      error: error.message
    });
  }
};

// Marcar/desmarcar nota como favorita
export const toggleFavorita = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la nota existe
    const nota = await Nota.findById(id);
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Verificar permiso
    const puedeModificar = 
      nota.creadoPor.toString() === req.user._id.toString() ||
      nota.compartidaCon.some(c => 
        c.usuario.toString() === req.user._id.toString() && 
        c.permisos.edicion
      );
      
    if (!puedeModificar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta nota'
      });
    }
    
    // Alternar estado
    nota.esFavorita = !nota.esFavorita;
    
    // Guardar cambios
    await nota.save();
    
    res.json({
      success: true,
      message: `Nota ${nota.esFavorita ? 'marcada como favorita' : 'desmarcada de favoritos'}`,
      data: nota
    });
  } catch (error) {
    logger.error(`Error al cambiar estado de favorita: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de favorita',
      error: error.message
    });
  }
}; 