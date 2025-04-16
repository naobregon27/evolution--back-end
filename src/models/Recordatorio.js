import mongoose from 'mongoose';

const recordatorioSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título del recordatorio es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  evento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evento'
  },
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente'
  },
  fechaProgramada: {
    type: Date,
    required: [true, 'La fecha programada es obligatoria']
  },
  tiempo: {
    type: Number, // Tiempo en minutos antes del evento
    required: [true, 'El tiempo antes del evento es obligatorio']
  },
  tipo: {
    type: String,
    enum: ['EMAIL', 'SMS', 'NOTIFICACION', 'WHATSAPP'],
    default: 'NOTIFICACION',
    required: [true, 'El tipo de recordatorio es obligatorio']
  },
  destinatarios: [{
    tipo: {
      type: String,
      enum: ['USUARIO', 'CLIENTE'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'destinatarios.tipo',
      required: true
    },
    notificado: {
      type: Boolean,
      default: false
    }
  }],
  estado: {
    type: String,
    enum: ['PENDIENTE', 'ENVIADO', 'FALLIDO', 'CANCELADO'],
    default: 'PENDIENTE'
  },
  plantillaPersonalizada: {
    asunto: String,
    contenido: String,
    variables: Map // Mapa de variables para reemplazar en la plantilla
  },
  intentos: {
    type: Number,
    default: 0
  },
  ultimoIntento: Date,
  mensajeError: String,
  prioridad: {
    type: String,
    enum: ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'],
    default: 'MEDIA'
  },
  datos: {
    // Datos adicionales dependiendo del tipo de recordatorio
    idWhatsapp: String,
    idSMS: String,
    idEmail: String
  },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
    required: true
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  versionKey: false 
});

// Índices para mejorar rendimiento en búsquedas comunes
recordatorioSchema.index({ fechaProgramada: 1 });
recordatorioSchema.index({ estado: 1 });
recordatorioSchema.index({ evento: 1 });
recordatorioSchema.index({ cliente: 1 });
recordatorioSchema.index({ local: 1 });
recordatorioSchema.index({ 'destinatarios.id': 1 });

// Método estático para buscar recordatorios pendientes de envío
recordatorioSchema.statics.buscarPendientes = function() {
  const ahora = new Date();
  return this.find({
    fechaProgramada: { $lte: ahora },
    estado: 'PENDIENTE'
  }).sort({ prioridad: -1, fechaProgramada: 1 });
};

// Método estático para buscar recordatorios por evento
recordatorioSchema.statics.buscarPorEvento = function(eventoId) {
  return this.find({ evento: eventoId }).sort({ fechaProgramada: 1 });
};

// Método estático para buscar recordatorios por cliente
recordatorioSchema.statics.buscarPorCliente = function(clienteId) {
  return this.find({ cliente: clienteId }).sort({ fechaProgramada: 1 });
};

// Método para marcar como enviado
recordatorioSchema.methods.marcarComoEnviado = function() {
  this.estado = 'ENVIADO';
  this.ultimoIntento = Date.now();
  return this.save();
};

// Método para marcar como fallido
recordatorioSchema.methods.marcarComoFallido = function(mensaje) {
  this.estado = 'FALLIDO';
  this.ultimoIntento = Date.now();
  this.intentos += 1;
  this.mensajeError = mensaje;
  return this.save();
};

const Recordatorio = mongoose.model('Recordatorio', recordatorioSchema);

export default Recordatorio; 