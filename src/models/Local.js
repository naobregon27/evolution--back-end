import mongoose from 'mongoose';

const localSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del local/marca es obligatorio'],
    trim: true
  },
  direccion: {
    type: String,
    required: [true, 'La dirección es obligatoria'],
    trim: true
  },
  telefono: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  logo: {
    type: String,
    default: 'default-logo.png'
  },
  horario: {
    apertura: String,
    cierre: String,
    diasOperacion: [String] // ['Lunes', 'Martes', ...]
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Campos para estadísticas de usuarios (se actualizan periódicamente)
  estadisticasUsuarios: {
    totalUsuarios: {
      type: Number,
      default: 0
    },
    usuariosActivos: {
      type: Number,
      default: 0
    },
    usuariosEnLinea: {
      type: Number, 
      default: 0
    },
    administradores: {
      type: Number,
      default: 0
    },
    ultimaActualizacion: {
      type: Date,
      default: Date.now
    }
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

// Índices para mejorar el rendimiento
localSchema.index({ nombre: 1 });
localSchema.index({ activo: 1 });

// Método para actualizar estadísticas de usuarios
localSchema.methods.actualizarEstadisticas = async function() {
  const User = mongoose.model('User');
  
  try {
    const stats = await User.aggregate([
      { $match: { local: this._id } },
      { 
        $group: {
          _id: null,
          total: { $sum: 1 },
          activos: { $sum: { $cond: [{ $eq: ["$activo", true] }, 1, 0] } },
          enLinea: { $sum: { $cond: [{ $eq: ["$enLinea", true] }, 1, 0] } },
          admin: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } }
        }
      }
    ]);
    
    if (stats.length > 0) {
      this.estadisticasUsuarios = {
        totalUsuarios: stats[0].total,
        usuariosActivos: stats[0].activos,
        usuariosEnLinea: stats[0].enLinea,
        administradores: stats[0].admin,
        ultimaActualizacion: Date.now()
      };
      
      await this.save();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error actualizando estadísticas del local:', error);
    return false;
  }
};

// Método estático para actualizar estadísticas de todos los locales
localSchema.statics.actualizarTodasLasEstadisticas = async function() {
  const User = mongoose.model('User');
  const locales = await this.find({ activo: true });
  
  let actualizados = 0;
  
  for (const local of locales) {
    if (await local.actualizarEstadisticas()) {
      actualizados++;
    }
  }
  
  return actualizados;
};

// Virtual para obtener usuarios conectados (no persiste en DB)
localSchema.virtual('usuariosConectados', {
  ref: 'User',
  localField: '_id',
  foreignField: 'local',
  match: { enLinea: true }
});

const Local = mongoose.model('Local', localSchema);

export default Local; 