import mongoose from 'mongoose';

const eventoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título del evento es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['REUNION', 'ENTREVISTA', 'LLAMADA', 'TAREA', 'OTRO'],
    required: [true, 'El tipo de evento es obligatorio']
  },
  fechaInicio: {
    type: Date,
    required: [true, 'La fecha de inicio es obligatoria']
  },
  fechaFin: {
    type: Date,
    required: [true, 'La fecha de fin es obligatoria']
  },
  todoElDia: {
    type: Boolean,
    default: false
  },
  ubicacion: {
    direccion: String,
    coordenadas: {
      latitud: Number,
      longitud: Number
    },
    virtual: Boolean,
    enlaceVirtual: String
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'COMPLETADO', 'REPROGRAMADO'],
    default: 'PENDIENTE'
  },
  prioridad: {
    type: String,
    enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
    default: 'MEDIA'
  },
  recurrencia: {
    activa: {
      type: Boolean,
      default: false
    },
    frecuencia: {
      type: String,
      enum: ['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL']
    },
    intervalo: {
      type: Number,
      default: 1
    },
    diasSemana: [{ 
      type: Number,
      min: 0, 
      max: 6 
    }], // 0: Domingo, 1: Lunes, ..., 6: Sábado
    finalizaEn: Date,
    cantidadOcurrencias: Number,
    eventoOriginal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evento'
    }
  },
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente'
  },
  participantes: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmado: {
      type: Boolean,
      default: false
    },
    notificado: {
      type: Boolean,
      default: false
    },
    rol: {
      type: String,
      enum: ['ORGANIZADOR', 'REQUERIDO', 'OPCIONAL'],
      default: 'REQUERIDO'
    }
  }],
  recordatorios: [{
    tiempo: Number, // Tiempo en minutos antes del evento
    tipo: {
      type: String,
      enum: ['EMAIL', 'SMS', 'NOTIFICACION', 'WHATSAPP'],
      default: 'NOTIFICACION'
    },
    enviado: {
      type: Boolean,
      default: false
    },
    fechaEnvio: Date
  }],
  notas: [{
    contenido: String,
    fecha: {
      type: Date,
      default: Date.now
    },
    autor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  archivosAdjuntos: [{
    nombre: String,
    url: String,
    tipo: String,
    tamaño: Number,
    fechaSubida: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    idCalendarioExterno: String, // ID en Google Calendar, Outlook, etc.
    urlCalendarioExterno: String
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
    required: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  ultimaModificacion: {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fecha: Date
  }
}, { 
  timestamps: true,
  versionKey: false 
});

// Índices para mejorar rendimiento en búsquedas comunes
eventoSchema.index({ fechaInicio: 1 });
eventoSchema.index({ fechaFin: 1 });
eventoSchema.index({ estado: 1 });
eventoSchema.index({ cliente: 1 });
eventoSchema.index({ 'participantes.usuario': 1 });
eventoSchema.index({ local: 1, fechaInicio: 1 });
eventoSchema.index({ 'recurrencia.eventoOriginal': 1 });

// Método estático para buscar eventos en un rango de fechas
eventoSchema.statics.buscarPorRangoFechas = function(fechaInicio, fechaFin, localId) {
  return this.find({
    local: localId,
    $or: [
      // Evento comienza dentro del rango
      {
        fechaInicio: { $gte: fechaInicio, $lte: fechaFin }
      },
      // Evento termina dentro del rango
      {
        fechaFin: { $gte: fechaInicio, $lte: fechaFin }
      },
      // Evento abarca todo el rango
      {
        fechaInicio: { $lte: fechaInicio },
        fechaFin: { $gte: fechaFin }
      }
    ]
  });
};

// Método estático para buscar eventos de un cliente
eventoSchema.statics.buscarPorCliente = function(clienteId) {
  return this.find({ cliente: clienteId }).sort({ fechaInicio: 1 });
};

// Middleware para actualizar la fecha de última modificación
eventoSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.ultimaModificacion = {
      fecha: Date.now()
      // El usuario debería ser proporcionado al llamar a save()
    };
  }
  next();
});

const Evento = mongoose.model('Evento', eventoSchema);

export default Evento; 