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
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
    // Requerido para admins, opcional para superAdmin (que gestiona todo el sistema)
    required: function() {
      return this.role === 'admin' || this.role === 'usuario';
    }
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
  // Nuevo campo para el estado de sesión
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

// Índices para mejorar el rendimiento
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ activo: 1 });
userSchema.index({ local: 1 });
userSchema.index({ enLinea: 1 });

// Middleware para hashear la contraseña antes de guardar
userSchema.pre('save', async function(next) {
  // Solo hash si la contraseña fue modificada o es nueva
  if (!this.isModified('password')) return next();
  
  try {
    // Aumentar a 12 rondas de salt para mayor seguridad (por defecto es 10)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Si estamos cambiando la contraseña (no es un nuevo usuario)
    if (this.isModified('password') && !this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // -1 segundo para asegurar que se crea el token después
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Query middleware para no incluir usuarios inactivos por defecto
userSchema.pre(/^find/, function(next) {
  // Solo aplicar si no se ha especificado explícitamente incluir inactivos
  if (this.getQuery().includeInactive !== true) {
    this.find({ activo: { $ne: false } });
  }
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Incrementar versión del token al cambiar contraseña (para invalidar tokens existentes)
userSchema.methods.incrementTokenVersion = function() {
  this.tokenVersion += 1;
  return this.tokenVersion;
};

// Verificar si el usuario cambió su contraseña después de emitir un token
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Método para crear token de restablecimiento de contraseña
userSchema.methods.createPasswordResetToken = function() {
  // Generar token aleatorio con crypto
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  // Guardar versión encriptada en la base de datos
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Token expira en 10 minutos
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Método para registrar intento fallido de login
userSchema.methods.registrarIntentoFallido = async function() {
  this.intentosFallidos += 1;
  
  // Si hay 5 o más intentos fallidos, bloquear la cuenta por 30 minutos
  if (this.intentosFallidos >= 5) {
    this.bloqueadoHasta = Date.now() + 30 * 60 * 1000;
  }
  
  await this.save({ validateBeforeSave: false });
};

// Método para registrar login exitoso y establecer enLinea a true
userSchema.methods.registrarLoginExitoso = async function(infoDispositivo = {}) {
  this.intentosFallidos = 0;
  this.bloqueadoHasta = undefined;
  this.ultimoLogin = Date.now();
  this.enLinea = true;
  
  // Registrar información del dispositivo si está disponible
  if (Object.keys(infoDispositivo).length > 0) {
    this.dispositivos.push({
      ...infoDispositivo,
      fechaAcceso: Date.now()
    });
    
    // Mantener solo los últimos 5 dispositivos
    if (this.dispositivos.length > 5) {
      this.dispositivos = this.dispositivos.slice(-5);
    }
  }
  
  await this.save({ validateBeforeSave: false });
};

// Método para registrar logout y establecer enLinea a false
userSchema.methods.registrarLogout = async function() {
  this.enLinea = false;
  this.ultimaConexion = Date.now();
  
  await this.save({ validateBeforeSave: false });
};

// Método para verificar si la cuenta está bloqueada
userSchema.methods.estaBloqueada = function() {
  return this.bloqueadoHasta && this.bloqueadoHasta > Date.now();
};

// Método para verificar si el usuario tiene un permiso específico
userSchema.methods.tienePermiso = function(permiso) {
  return !!this.permisos[permiso];
};

// Método para crear código de verificación
userSchema.methods.generarCodigoVerificacion = async function() {
  // Generar un código aleatorio de 6 dígitos
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Guardar código con fecha de expiración (24 horas)
  this.codigoVerificacion = codigo;
  this.codigoVerificacionExpira = Date.now() + 24 * 60 * 60 * 1000;
  
  await this.save({ validateBeforeSave: false });
  
  return codigo;
};

// Método que comprueba si un usuario puede administrar a otro
userSchema.methods.puedeAdministrar = function(otroUsuario) {
  // Un superAdmin puede administrar a cualquiera
  if (this.role === 'superAdmin') return true;
  
  // Un admin puede administrar a usuarios regulares de su mismo local, pero no a otros admin ni superadmin
  if (this.role === 'admin' && 
      otroUsuario.role === 'usuario' && 
      this.local && 
      otroUsuario.local && 
      this.local.toString() === otroUsuario.local.toString()) {
    return true;
  }
  
  // Nadie más puede administrar a otros
  return false;
};

// Método para determinar si el usuario pertenece a un local específico
userSchema.methods.perteneceALocal = function(localId) {
  return this.local && this.local.toString() === localId.toString();
};

// Método estático para crear un superAdmin inicial si no existe ninguno
userSchema.statics.crearSuperAdminInicial = async function(datosAdmin) {
  try {
    // Crear el superAdmin inicial
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

// Método para actualizar el estado enLinea de usuarios inactivos
userSchema.statics.actualizarEstadoInactividad = async function(tiempoInactividad = 30) {
  const tiempoLimite = new Date(Date.now() - tiempoInactividad * 60 * 1000); // en minutos
  
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