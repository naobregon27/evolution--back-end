import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  // Información básica de la plantilla
  name: {
    type: String,
    required: true,
    index: true,
  },
  language: {
    type: String,
    required: true,
    default: 'es',
  },
  category: {
    type: String,
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'ACCOUNT_UPDATE', 'PAYMENT_UPDATE'],
    required: true,
  },
  
  // Contenido de la plantilla
  components: [{
    type: {
      type: String,
      enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
      required: true,
    },
    format: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'],
    },
    text: String,
    buttons: [{
      type: {
        type: String,
        enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
      },
      text: String,
      url: String,
      phone_number: String,
    }],
    example: {
      header_text: [String],
      header_url: [String],
      body_text: [[String]],
    },
  }],
  
  // Estado y aprobación
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  rejectionReason: String,
  
  // Relacionado con un local del sistema
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Local',
  },
  
  // Metadatos de uso
  timesUsed: {
    type: Number,
    default: 0,
  },
  lastUsed: Date,
  
  // Información del proveedor (Infobip, etc.)
  providerTemplateId: String,
  providerData: Object,
  
  // Campos para la personalización
  variables: [{
    name: String,
    description: String,
    example: String,
    required: {
      type: Boolean,
      default: false,
    },
  }],
}, {
  timestamps: true,
});

// Índices para mejorar rendimiento
templateSchema.index({ name: 1, language: 1 }, { unique: true });
templateSchema.index({ status: 1 });
templateSchema.index({ local: 1 });
templateSchema.index({ category: 1 });

const Template = mongoose.model('WhatsAppTemplate', templateSchema);

export default Template; 