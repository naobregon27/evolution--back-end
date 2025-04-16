import Evento from '../models/Evento.js';
import Recordatorio from '../models/Recordatorio.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

// Obtener todos los eventos
export const getEventos = async (req, res) => {
  try {
    const { 
      local, 
      fechaInicio, 
      fechaFin, 
      estado, 
      tipo, 
      cliente, 
      usuario, 
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
    
    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.fechaInicio = {};
      
      if (fechaInicio) {
        filtro.fechaInicio.$gte = new Date(fechaInicio);
      }
      
      if (fechaFin) {
        filtro.fechaFin = { $lte: new Date(fechaFin) };
      }
    }
    
    // Filtro por estado
    if (estado) {
      filtro.estado = estado;
    }
    
    // Filtro por tipo
    if (tipo) {
      filtro.tipo = tipo;
    }
    
    // Filtro por cliente
    if (cliente) {
      filtro.cliente = cliente;
    }
    
    // Filtro por usuario participante
    if (usuario) {
      filtro['participantes.usuario'] = usuario;
    }
    
    // Agrega esto después del bloque de filtro por usuario
    const soloMisEventos = req.query.misEventos === 'true';
    if (soloMisEventos) {
      filtro.$or = [
        { 'participantes.usuario': req.user._id },
        { creadoPor: req.user._id }
      ];
    }
    
    // Obtener total de documentos para paginación
    const total = await Evento.countDocuments(filtro);
    
    // Ejecutar consulta
    const eventos = await Evento.find(filtro)
      .populate('cliente', 'nombre apellido email telefono')
      .populate('participantes.usuario', 'nombre email')
      .populate('local', 'nombre')
      .populate('creadoPor', 'nombre email')
      .sort({ fechaInicio: 1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    res.json({
      success: true,
      total,
      count: eventos.length,
      data: eventos
    });
  } catch (error) {
    logger.error(`Error al obtener eventos: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener eventos',
      error: error.message
    });
  }
};

// Obtener un evento por ID
export const getEventoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const evento = await Evento.findById(id)
      .populate('cliente', 'nombre apellido email telefono')
      .populate('participantes.usuario', 'nombre email')
      .populate('local', 'nombre')
      .populate('creadoPor', 'nombre email')
      .populate('ultimaModificacion.usuario', 'nombre email');
      
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: evento
    });
  } catch (error) {
    logger.error(`Error al obtener evento: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener evento',
      error: error.message
    });
  }
};

// Crear un nuevo evento
export const createEvento = async (req, res) => {
  try {
    const { 
      titulo, descripcion, tipo, fechaInicio, fechaFin, todoElDia,
      ubicacion, estado, prioridad, recurrencia, cliente,
      participantes, recordatorios, local
    } = req.body;
    
    // Crear el evento
    const nuevoEvento = new Evento({
      titulo,
      descripcion,
      tipo,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      todoElDia,
      ubicacion,
      estado,
      prioridad,
      recurrencia,
      cliente,
      local: local || req.user.primaryLocal,
      creadoPor: req.user._id
    });
    
    // Agregar participantes
    if (participantes && participantes.length > 0) {
      nuevoEvento.participantes = participantes;
    }
    
    // Agregar al creador como organizador si no está en la lista
    const creadorIncluido = nuevoEvento.participantes.some(p => 
      p.usuario.toString() === req.user._id.toString()
    );
    
    if (!creadorIncluido) {
      nuevoEvento.participantes.push({
        usuario: req.user._id,
        confirmado: true,
        rol: 'ORGANIZADOR'
      });
    }
    
    // Agregar recordatorios
    if (recordatorios && recordatorios.length > 0) {
      nuevoEvento.recordatorios = recordatorios;
    }
    
    // Guardar evento
    await nuevoEvento.save();
    
    // Crear recordatorios programados si existen
    if (recordatorios && recordatorios.length > 0) {
      const recordatoriosProgramados = recordatorios.map(rec => {
        // Calcular la fecha programada
        const fechaRecordatorio = new Date(fechaInicio);
        fechaRecordatorio.setMinutes(fechaRecordatorio.getMinutes() - rec.tiempo);
        
        return {
          titulo: `Recordatorio: ${nuevoEvento.titulo}`,
          descripcion: nuevoEvento.descripcion,
          evento: nuevoEvento._id,
          cliente: nuevoEvento.cliente,
          fechaProgramada: fechaRecordatorio,
          tiempo: rec.tiempo,
          tipo: rec.tipo,
          destinatarios: [
            {
              tipo: 'USUARIO',
              id: req.user._id
            }
          ],
          local: nuevoEvento.local,
          creadoPor: req.user._id
        };
      });
      
      await Recordatorio.insertMany(recordatoriosProgramados);
    }
    
    // Si es un evento recurrente, crear todas las instancias
    if (recurrencia && recurrencia.activa) {
      const eventosRecurrentes = await generarEventosRecurrentes(nuevoEvento);
      
      if (eventosRecurrentes.length > 0) {
        await Evento.insertMany(eventosRecurrentes);
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente',
      data: nuevoEvento
    });
  } catch (error) {
    logger.error(`Error al crear evento: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear evento',
      error: error.message
    });
  }
};

// Actualizar un evento existente
export const updateEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      titulo, descripcion, tipo, fechaInicio, fechaFin, todoElDia,
      ubicacion, estado, prioridad, recurrencia, cliente,
      participantes, recordatorios, actualizarSerie
    } = req.body;
    
    // Verificar que el evento existe
    const evento = await Evento.findById(id);
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    // Crear objeto con datos a actualizar
    const datosActualizados = {
      titulo,
      descripcion,
      tipo,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
      todoElDia,
      ubicacion,
      estado,
      prioridad,
      recurrencia,
      cliente,
      participantes,
      recordatorios,
      ultimaModificacion: {
        usuario: req.user._id,
        fecha: new Date()
      }
    };
    
    // Eliminar propiedades undefined
    Object.keys(datosActualizados).forEach(key => 
      datosActualizados[key] === undefined && delete datosActualizados[key]
    );
    
    // Si es un evento recurrente y se debe actualizar toda la serie
    if (evento.recurrencia && evento.recurrencia.activa && actualizarSerie) {
      await Evento.updateMany(
        { 'recurrencia.eventoOriginal': evento.recurrencia.eventoOriginal || evento._id },
        { $set: datosActualizados }
      );
      
      const eventoActualizado = await Evento.findById(id);
      
      return res.json({
        success: true,
        message: 'Serie de eventos actualizada exitosamente',
        data: eventoActualizado
      });
    }
    
    // Actualizar solo este evento
    const eventoActualizado = await Evento.findByIdAndUpdate(
      id,
      datosActualizados,
      { new: true, runValidators: true }
    );
    
    // Actualizar recordatorios existentes
    if (recordatorios && eventoActualizado.fechaInicio && fechaInicio) {
      await actualizarRecordatoriosEvento(
        eventoActualizado._id, 
        recordatorios, 
        new Date(fechaInicio), 
        eventoActualizado.local, 
        req.user._id
      );
    }
    
    res.json({
      success: true,
      message: 'Evento actualizado exitosamente',
      data: eventoActualizado
    });
  } catch (error) {
    logger.error(`Error al actualizar evento: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar evento',
      error: error.message
    });
  }
};

// Eliminar un evento
export const deleteEvento = async (req, res) => {
  try {
    const { id } = req.params;
    const { eliminarSerie } = req.query;
    
    // Buscar el evento
    const evento = await Evento.findById(id);
    
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    // Si es recurrente y se debe eliminar toda la serie
    if (evento.recurrencia && evento.recurrencia.activa && eliminarSerie === 'true') {
      const idOriginal = evento.recurrencia.eventoOriginal || evento._id;
      
      await Evento.deleteMany({
        $or: [
          { _id: idOriginal },
          { 'recurrencia.eventoOriginal': idOriginal }
        ]
      });
      
      // Eliminar recordatorios asociados
      await Recordatorio.deleteMany({ evento: { $in: [idOriginal, id] } });
      
      return res.json({
        success: true,
        message: 'Serie de eventos eliminada exitosamente'
      });
    }
    
    // Eliminar solo este evento
    await Evento.findByIdAndDelete(id);
    
    // Eliminar recordatorios asociados
    await Recordatorio.deleteMany({ evento: id });
    
    res.json({
      success: true,
      message: 'Evento eliminado exitosamente',
      data: evento
    });
  } catch (error) {
    logger.error(`Error al eliminar evento: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar evento',
      error: error.message
    });
  }
};

// Agregar una nota a un evento
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
    
    const evento = await Evento.findById(id);
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    // Agregar la nota
    evento.notas.push({
      contenido,
      autor: req.user._id,
      fecha: new Date()
    });
    
    // Actualizar última modificación
    evento.ultimaModificacion = {
      usuario: req.user._id,
      fecha: new Date()
    };
    
    await evento.save();
    
    res.status(201).json({
      success: true,
      message: 'Nota agregada exitosamente',
      data: evento.notas[evento.notas.length - 1]
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

// Confirmar participación en un evento
export const confirmarParticipacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmado } = req.body;
    
    if (confirmado === undefined) {
      return res.status(400).json({
        success: false,
        message: 'El estado de confirmación es obligatorio'
      });
    }
    
    const evento = await Evento.findById(id);
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    // Buscar al participante
    const participanteIndex = evento.participantes.findIndex(
      p => p.usuario.toString() === req.user._id.toString()
    );
    
    if (participanteIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'No eres participante de este evento'
      });
    }
    
    // Actualizar estado de confirmación
    evento.participantes[participanteIndex].confirmado = confirmado;
    
    // Guardar
    await evento.save();
    
    res.json({
      success: true,
      message: `Participación ${confirmado ? 'confirmada' : 'rechazada'} exitosamente`,
      data: evento.participantes[participanteIndex]
    });
  } catch (error) {
    logger.error(`Error al confirmar participación: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al confirmar participación',
      error: error.message
    });
  }
};

// Obtener eventos por cliente
export const getEventosByCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const eventos = await Evento.find({ cliente: clienteId })
      .populate('participantes.usuario', 'nombre email')
      .sort({ fechaInicio: 1 });
      
    res.json({
      success: true,
      count: eventos.length,
      data: eventos
    });
  } catch (error) {
    logger.error(`Error al obtener eventos por cliente: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener eventos por cliente',
      error: error.message
    });
  }
};

// Obtener todos los eventos del local
export const getEventosLocal = async (req, res) => {
  try {
    const { 
      local,
      fechaInicio, 
      fechaFin, 
      estado, 
      tipo, 
      limit = 50, 
      skip = 0 
    } = req.query;
    
    // Construir el filtro
    const filtro = {};
    
    // Filtro por local - usar el especificado o el primario del usuario
    const localId = local || req.user.primaryLocal;
    if (localId) {
      filtro.local = localId;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un local para obtener los eventos'
      });
    }
    
    // Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.fechaInicio = {};
      
      if (fechaInicio) {
        filtro.fechaInicio.$gte = new Date(fechaInicio);
      }
      
      if (fechaFin) {
        filtro.fechaFin = { $lte: new Date(fechaFin) };
      }
    }
    
    // Filtros adicionales opcionales
    if (estado) filtro.estado = estado;
    if (tipo) filtro.tipo = tipo;
    
    // Obtener total de documentos para paginación
    const total = await Evento.countDocuments(filtro);
    
    // Ejecutar consulta
    const eventos = await Evento.find(filtro)
      .populate('cliente', 'nombre apellido email telefono')
      .populate('participantes.usuario', 'nombre email')
      .populate('local', 'nombre')
      .populate('creadoPor', 'nombre email')
      .sort({ fechaInicio: 1 })
      .limit(Number(limit))
      .skip(Number(skip));
      
    res.json({
      success: true,
      total,
      count: eventos.length,
      data: eventos
    });
  } catch (error) {
    logger.error(`Error al obtener eventos del local: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener eventos del local',
      error: error.message
    });
  }
};

// Función auxiliar para generar eventos recurrentes
const generarEventosRecurrentes = async (eventoOriginal) => {
  const eventosGenerados = [];
  const recurrencia = eventoOriginal.recurrencia;
  
  if (!recurrencia || !recurrencia.activa) {
    return eventosGenerados;
  }
  
  const fechaInicio = new Date(eventoOriginal.fechaInicio);
  const fechaFin = new Date(eventoOriginal.fechaFin);
  const duracion = fechaFin.getTime() - fechaInicio.getTime();
  
  let fechaLimite;
  if (recurrencia.finalizaEn) {
    fechaLimite = new Date(recurrencia.finalizaEn);
  } else if (recurrencia.cantidadOcurrencias) {
    // Calcular fecha límite basada en cantidad de ocurrencias
    fechaLimite = calcularFechaLimite(
      fechaInicio, 
      recurrencia.frecuencia, 
      recurrencia.intervalo, 
      recurrencia.cantidadOcurrencias
    );
  } else {
    // Por defecto, generar eventos para un año
    fechaLimite = new Date(fechaInicio);
    fechaLimite.setFullYear(fechaLimite.getFullYear() + 1);
  }
  
  // Si es un evento original, empezar desde la siguiente ocurrencia
  let fechaActual = calcularSiguienteOcurrencia(
    fechaInicio, 
    recurrencia.frecuencia, 
    recurrencia.intervalo,
    recurrencia.diasSemana
  );
  
  // Limitar a 100 ocurrencias para evitar problemas de rendimiento
  let contador = 0;
  const MAX_OCURRENCIAS = 100;
  
  while (fechaActual <= fechaLimite && contador < MAX_OCURRENCIAS) {
    // Calcular fecha fin correspondiente
    const nuevaFechaFin = new Date(fechaActual.getTime() + duracion);
    
    // Crear nuevo evento recurrente
    const nuevoEvento = {
      ...eventoOriginal.toObject(),
      _id: new mongoose.Types.ObjectId(),
      fechaInicio: fechaActual,
      fechaFin: nuevaFechaFin,
      recurrencia: {
        ...recurrencia,
        eventoOriginal: eventoOriginal._id
      }
    };
    
    // Eliminar campos que no deben copiarse
    delete nuevoEvento.createdAt;
    delete nuevoEvento.updatedAt;
    
    eventosGenerados.push(nuevoEvento);
    
    // Calcular siguiente fecha
    fechaActual = calcularSiguienteOcurrencia(
      fechaActual, 
      recurrencia.frecuencia, 
      recurrencia.intervalo,
      recurrencia.diasSemana
    );
    
    contador++;
  }
  
  return eventosGenerados;
};

// Función auxiliar para calcular la siguiente ocurrencia
const calcularSiguienteOcurrencia = (fecha, frecuencia, intervalo = 1, diasSemana = []) => {
  const nuevaFecha = new Date(fecha);
  
  switch (frecuencia) {
    case 'DIARIA':
      nuevaFecha.setDate(nuevaFecha.getDate() + intervalo);
      break;
    case 'SEMANAL':
      if (diasSemana && diasSemana.length > 0) {
        // Encontrar el próximo día de la semana en la lista
        let encontrado = false;
        let diasAgregados = 1;
        
        while (!encontrado && diasAgregados < 8) {
          nuevaFecha.setDate(nuevaFecha.getDate() + 1);
          const diaSemana = nuevaFecha.getDay(); // 0 domingo, 1 lunes, etc.
          
          if (diasSemana.includes(diaSemana)) {
            encontrado = true;
          }
          
          diasAgregados++;
        }
        
        if (!encontrado) {
          // Si no se encontró, usar el intervalo regular
          nuevaFecha.setDate(fecha.getDate() + (intervalo * 7));
        }
      } else {
        nuevaFecha.setDate(fecha.getDate() + (intervalo * 7));
      }
      break;
    case 'MENSUAL':
      nuevaFecha.setMonth(nuevaFecha.getMonth() + intervalo);
      break;
    case 'ANUAL':
      nuevaFecha.setFullYear(nuevaFecha.getFullYear() + intervalo);
      break;
    default:
      nuevaFecha.setDate(nuevaFecha.getDate() + intervalo);
  }
  
  return nuevaFecha;
};

// Función auxiliar para calcular la fecha límite basada en cantidad de ocurrencias
const calcularFechaLimite = (fechaInicio, frecuencia, intervalo, cantidadOcurrencias) => {
  const fecha = new Date(fechaInicio);
  
  switch (frecuencia) {
    case 'DIARIA':
      fecha.setDate(fecha.getDate() + (intervalo * cantidadOcurrencias));
      break;
    case 'SEMANAL':
      fecha.setDate(fecha.getDate() + (intervalo * 7 * cantidadOcurrencias));
      break;
    case 'MENSUAL':
      fecha.setMonth(fecha.getMonth() + (intervalo * cantidadOcurrencias));
      break;
    case 'ANUAL':
      fecha.setFullYear(fecha.getFullYear() + (intervalo * cantidadOcurrencias));
      break;
    default:
      fecha.setDate(fecha.getDate() + (intervalo * cantidadOcurrencias));
  }
  
  return fecha;
};

// Función auxiliar para actualizar los recordatorios de un evento
const actualizarRecordatoriosEvento = async (eventoId, recordatorios, fechaInicio, localId, userId) => {
  try {
    // Eliminar recordatorios existentes
    await Recordatorio.deleteMany({ evento: eventoId });
    
    // Crear nuevos recordatorios
    if (recordatorios && recordatorios.length > 0) {
      const recordatoriosProgramados = recordatorios.map(rec => {
        // Calcular la fecha programada
        const fechaRecordatorio = new Date(fechaInicio);
        fechaRecordatorio.setMinutes(fechaRecordatorio.getMinutes() - rec.tiempo);
        
        return {
          titulo: `Recordatorio de evento`,
          evento: eventoId,
          fechaProgramada: fechaRecordatorio,
          tiempo: rec.tiempo,
          tipo: rec.tipo,
          destinatarios: [
            {
              tipo: 'USUARIO',
              id: userId
            }
          ],
          local: localId,
          creadoPor: userId
        };
      });
      
      await Recordatorio.insertMany(recordatoriosProgramados);
    }
  } catch (error) {
    logger.error(`Error al actualizar recordatorios: ${error.message}`);
    throw error;
  }
}; 