import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  // Información del contacto
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  waId: {
    type: String,
    index: true,
  },
  name: String,
  profileName: String,
  firstName: String,
  lastName: String,
  email: String,
  
  // Consentimiento y preferencias
  optIn: {
    type: Boolean,
    default: false,
  },
  optInDate: Date,
  optOutDate: Date,
  
  // Relación con el sistema
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
  },
  
  // Estado y metadatos
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active',
  },
  lastActivity: Date,
  lastIncomingMessage: Date,
  lastOutgoingMessage: Date,
  
  // Contadores de mensajes
  messagesSent: {
    type: Number,
    default: 0,
  },
  messagesReceived: {
    type: Number,
    default: 0,
  },
  
  // Datos adicionales y personalizados
  tags: [String],
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  
  // Historial de interacciones importantes
  interactionHistory: [{
    type: {
      type: String,
      enum: ['optIn', 'optOut', 'firstContact', 'reengagement', 'customEvent'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: mongoose.Schema.Types.Mixed,
  }],
}, {
  timestamps: true,
});

// Índices para mejorar rendimiento
contactSchema.index({ local: 1, status: 1 });
contactSchema.index({ optIn: 1 });
contactSchema.index({ lastActivity: -1 });
contactSchema.index({ 'customFields.key': 1 });

const Contact = mongoose.model('WhatsAppContact', contactSchema);

export default Contact; 