import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Información del mensaje
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'document', 'audio', 'video', 'location', 'template', 'interactive'],
    default: 'text',
  },
  content: {
    text: String,
    caption: String,
    mediaUrl: String,
    fileName: String,
    mimeType: String,
    latitude: Number,
    longitude: Number,
    templateName: String,
    templateData: Object,
    interactive: Object,
  },
  
  // Información del contacto/chat
  contactNumber: {
    type: String,
    required: true,
    index: true,
  },
  contactName: String,
  businessNumber: {
    type: String,
    required: true,
  },
  
  // Estado del mensaje
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
  },
  
  // Relacionado con un usuario del sistema
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Relacionado con un local del sistema
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
  },
  
  // Timestamps y metadatos
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  
  // Información adicional
  rawResponse: Object,
  errorDetails: Object,
}, { 
  timestamps: true 
});

// Índices para mejorar rendimiento en búsquedas
messageSchema.index({ contactNumber: 1, createdAt: -1 });
messageSchema.index({ local: 1, createdAt: -1 });
messageSchema.index({ relatedUser: 1, createdAt: -1 });
messageSchema.index({ status: 1 });

const Message = mongoose.model('WhatsAppMessage', messageSchema);

export default Message; 