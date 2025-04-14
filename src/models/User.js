import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio']
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    validate: {
      validator: function(value) {
        // Debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        return regex.test(value);
      },
      message: 'La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial'
    },
    select: false // No incluir por defecto en consultas
  },
  role: {
    type: String,
    enum: ['usuario', 'admin', 'superAdmin'],
    default: 'usuario'
  },
  locales: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local'
  }],
  localPrincipal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
    required: false
  },
  esAdministradorLocal: {
    type: Boolean,
    default: function() {
      return this.role === 'admin';
    }
  },
  permisos: {
    crearUsuarios: {
      type: Boolean,
      default: function() {
        return this.role === 'admin' || this.role === 'superAdmin';
      }
    },
    editarUsuarios: {
      type: Boolean,
      default: function() {
        return this.role === 'admin' || this.role === 'superAdmin';
      }
    },
    eliminarUsuarios: {
      type: Boolean,
      default: function() {
        return this.role === 'superAdmin';
      }
    },
    asignarRoles: {
      type: Boolean,
      default: function() {
        return this.role === 'superAdmin';
      }
    },
    verEstadisticas: {
      type: Boolean,
      default: function() {
        return this.role === 'admin' || this.role === 'superAdmin';
      }
    },
    configurarSistema: {
      type: Boolean,
      default: function() {
        return this.role === 'superAdmin';
      }
    },
    gestionarLocales: {
      type: Boolean,
      default: function() {
        return this.role === 'superAdmin';
      }
    }
  },
  imagenPerfil: {
    type: String,
    default: 'default.jpg'
  },
  telefono: String,
  direccion: String,
  organizacion: String,
  activo: {
    type: Boolean,
    default: true
  },
  enLinea: {
    type: Boolean,
    default: false
  },
  ultimaConexion: {
    type: Date,
    default: null
  },
  verificado: {
    type: Boolean,
    default: false
  },
  codigoVerificacion: String,
  codigoVerificacionExpira: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  intentosFallidos: {
    type: Number,
    default: 0
  },
  bloqueadoHasta: Date,
  ultimoLogin: Date,
  lastLoginIP: String,
  tokenVersion: {
    type: Number,
    default: 0
  },
  dispositivos: [{
    dispositivo: String,
    ip: String,
    ubicacion: String,
    fechaAcceso: Date
  }],
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

userSchema.index({ role: 1 });
userSchema.index({ activo: 1 });
userSchema.index({ 'locales': 1 });
userSchema.index({ localPrincipal: 1 });
userSchema.index({ enLinea: 1 });
userSchema.index({ role: 1, 'locales': 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    if (this.isModified('password') && !this.isNew) {
      this.passwordChangedAt = Date.now() - 1000;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function(next) {
  if (this.locales && this.locales.length > 0 && !this.localPrincipal) {
    this.localPrincipal = this.locales[0];
  }
  next();
});

userSchema.pre(/^find/, function(next) {
  if (this.getQuery().includeInactive !== true) {
    this.find({ activo: { $ne: false } });
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementTokenVersion = function() {
  this.tokenVersion += 1;
  return this.tokenVersion;
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

userSchema.methods.registrarIntentoFallido = async function() {
  this.intentosFallidos += 1;
  
  if (this.intentosFallidos >= 5) {
    this.bloqueadoHasta = Date.now() + 30 * 60 * 1000;
  }
  
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.registrarLoginExitoso = async function(infoDispositivo = {}) {
  this.intentosFallidos = 0;
  this.bloqueadoHasta = undefined;
  this.ultimoLogin = Date.now();
  this.enLinea = true;
  
  if (Object.keys(infoDispositivo).length > 0) {
    this.dispositivos.push({
      ...infoDispositivo,
      fechaAcceso: Date.now()
    });
    
    if (this.dispositivos.length > 5) {
      this.dispositivos = this.dispositivos.slice(-5);
    }
  }
  
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.registrarLogout = async function() {
  this.enLinea = false;
  this.ultimaConexion = Date.now();
  
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.estaBloqueada = function() {
  return this.bloqueadoHasta && this.bloqueadoHasta > Date.now();
};

userSchema.methods.tienePermiso = function(permiso) {
  return !!this.permisos[permiso];
};

userSchema.methods.generarCodigoVerificacion = async function() {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.codigoVerificacion = codigo;
  this.codigoVerificacionExpira = Date.now() + 24 * 60 * 60 * 1000;
  
  await this.save({ validateBeforeSave: false });
  
  return codigo;
};

userSchema.methods.puedeAdministrar = function(otroUsuario) {
  if (this.role === 'superAdmin') return true;
  
  if (this.role === 'admin' && otroUsuario.role === 'usuario') {
    if (this.locales && this.locales.length > 0 && otroUsuario.localPrincipal) {
      return this.locales.some(local => 
        local.toString() === otroUsuario.localPrincipal.toString()
      );
    }
  }
  
  return false;
};

userSchema.methods.perteneceALocal = function(localId) {
  if (this.localPrincipal && this.localPrincipal.toString() === localId.toString()) {
    return true;
  }
  
  if (this.locales && this.locales.length > 0) {
    return this.locales.some(local => local.toString() === localId.toString());
  }
  
  return false;
};

userSchema.methods.agregarLocal = async function(localId) {
  if (this.locales && this.locales.some(local => local.toString() === localId.toString())) {
    return false;
  }
  
  if (!this.locales) this.locales = [];
  this.locales.push(localId);
  
  if (!this.localPrincipal) {
    this.localPrincipal = localId;
  }
  
  await this.save({ validateBeforeSave: false });
  return true;
};

userSchema.methods.removerLocal = async function(localId) {
  if (!this.locales || this.locales.length === 0) {
    return false;
  }
  
  this.locales = this.locales.filter(local => local.toString() !== localId.toString());
  
  if (this.localPrincipal && this.localPrincipal.toString() === localId.toString()) {
    this.localPrincipal = this.locales.length > 0 ? this.locales[0] : null;
  }
  
  await this.save({ validateBeforeSave: false });
  return true;
};

userSchema.statics.crearSuperAdminInicial = async function(datosAdmin) {
  try {
    await this.create({
      ...datosAdmin,
      role: 'superAdmin',
      verificado: true,
      activo: true,
      enLinea: false
    });
    
    console.log('SuperAdmin inicial creado con éxito');
    return true;
  } catch (error) {
    console.error('Error al crear el superAdmin inicial:', error);
    return false;
  }
};

userSchema.statics.actualizarEstadoInactividad = async function(tiempoInactividad = 30) {
  const tiempoLimite = new Date(Date.now() - tiempoInactividad * 60 * 1000);
  
  try {
    const resultado = await this.updateMany(
      { 
        enLinea: true, 
        ultimoLogin: { $lt: tiempoLimite } 
      },
      { 
        $set: { 
          enLinea: false,
          ultimaConexion: Date.now()
        } 
      }
    );
    
    return resultado.modifiedCount;
  } catch (error) {
    console.error('Error al actualizar estado de inactividad:', error);
    return 0;
  }
};

const User = mongoose.model('User', userSchema);

export default User; 