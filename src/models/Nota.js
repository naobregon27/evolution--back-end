import mongoose from 'mongoose';

const notaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título de la nota es obligatorio'],
    trim: true
  },
  contenido: {
    type: String,
    required: [true, 'El contenido de la nota es obligatorio'],
    trim: true
  },
  tipo: {
    type: String,
    enum: ['GENERAL', 'CLIENTE', 'EVENTO', 'TAREA', 'RECORDATORIO'],
    default: 'GENERAL'
  },
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente'
  },
  evento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evento'
  },
  etiquetas: [String],
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
  esFavorita: {
    type: Boolean,
    default: false
  },
  esArchivada: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#FFFFFF'
  },
  recordatorio: {
    activo: {
      type: Boolean,
      default: false
    },
    fecha: Date
  },
  visibilidad: {
    type: String,
    enum: ['PRIVADA', 'EQUIPO', 'PUBLICA'],
    default: 'PRIVADA'
  },
  compartidaCon: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permisos: {
      lectura: {
        type: Boolean,
        default: true
      },
      edicion: {
        type: Boolean,
        default: false
      },
      eliminacion: {
        type: Boolean,
        default: false
      }
    },
    fechaCompartida: {
      type: Date,
      default: Date.now
    }
  }],
  historialVersiones: [{
    contenido: String,
    fecha: {
      type: Date,
      default: Date.now
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
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
  ultimaModificacion: {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fecha: Date
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
notaSchema.index({ creadoPor: 1 });
notaSchema.index({ cliente: 1 });
notaSchema.index({ evento: 1 });
notaSchema.index({ local: 1 });
notaSchema.index({ 'compartidaCon.usuario': 1 });
notaSchema.index({ tipo: 1 });
notaSchema.index({ esFavorita: 1 });
notaSchema.index({ esArchivada: 1 });

// Método estático para buscar notas por texto
notaSchema.statics.buscarPorTexto = function(texto, userId) {
  return this.find({
    $and: [
      {
        $or: [
          { titulo: { $regex: texto, $options: 'i' } },
          { contenido: { $regex: texto, $options: 'i' } },
          { etiquetas: { $in: [new RegExp(texto, 'i')] } }
        ]
      },
      {
        $or: [
          { creadoPor: userId },
          { 
            'compartidaCon.usuario': userId,
            'compartidaCon.permisos.lectura': true 
          },
          { visibilidad: 'PUBLICA' }
        ]
      }
    ]
  });
};

// Método para añadir versión al historial
notaSchema.methods.addVersion = function(usuario) {
  this.historialVersiones.push({
    contenido: this.contenido,
    usuario: usuario,
    fecha: Date.now()
  });
  return this;
};

// Middleware para actualizar la última modificación
notaSchema.pre('save', function(next) {
  if (this.isModified('contenido') && !this.isNew) {
    this.ultimaModificacion = {
      fecha: Date.now()
      // El usuario debería ser proporcionado al llamar a save()
    };
  }
  next();
});

const Nota = mongoose.model('Nota', notaSchema);

export default Nota; 