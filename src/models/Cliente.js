import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del cliente es obligatorio'],
    trim: true
  },
  apellido: {
    type: String,
    required: [true, 'El apellido del cliente es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
  },
  telefono: {
    type: String,
    required: [true, 'El teléfono es obligatorio']
  },
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String,
    codigoPostal: String,
    pais: String
  },
  fechaNacimiento: Date,
  documentoIdentidad: {
    tipo: {
      type: String,
      enum: ['DNI', 'PASAPORTE', 'NIE', 'OTRO']
    },
    numero: String
  },
  categoria: {
    type: String,
    enum: ['POTENCIAL', 'NUEVO', 'RECURRENTE', 'VIP', 'INACTIVO'],
    default: 'POTENCIAL'
  },
  etiquetas: [String],
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
  historialInteracciones: [{
    tipo: {
      type: String,
      enum: ['LLAMADA', 'EMAIL', 'REUNION', 'OTRO']
    },
    fecha: Date,
    descripcion: String,
    resultado: String,
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  preferencias: {
    medioContactoPreferido: {
      type: String,
      enum: ['EMAIL', 'TELEFONO', 'SMS', 'WHATSAPP'],
      default: 'EMAIL'
    },
    horarioPreferido: String,
    recibirNotificaciones: {
      type: Boolean,
      default: true
    }
  },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
    required: true
  },
  asignadoA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  activo: {
    type: Boolean,
    default: true
  },
  ultimoContacto: Date,
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
clienteSchema.index({ email: 1 });
clienteSchema.index({ telefono: 1 });
clienteSchema.index({ categoria: 1 });
clienteSchema.index({ local: 1 });
clienteSchema.index({ asignadoA: 1 });
clienteSchema.index({ activo: 1 });
clienteSchema.index({ 'documentoIdentidad.numero': 1 });

// Método virtual para nombre completo
clienteSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombre} ${this.apellido}`;
});

// Método para buscar clientes por texto
clienteSchema.statics.buscarPorTexto = function(texto) {
  return this.find({
    $or: [
      { nombre: { $regex: texto, $options: 'i' } },
      { apellido: { $regex: texto, $options: 'i' } },
      { email: { $regex: texto, $options: 'i' } },
      { telefono: { $regex: texto, $options: 'i' } }
    ]
  });
};

const Cliente = mongoose.model('Cliente', clienteSchema);

export default Cliente; 