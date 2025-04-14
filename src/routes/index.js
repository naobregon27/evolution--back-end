import { Router } from 'express';
//import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import userRoutes from './userRoutes.js';
import localRoutes from './localRoutes.js';
import whatsappMessageRoutes from './whatsapp/messageRoutes.js';
import whatsappTemplateRoutes from './whatsapp/templateRoutes.js';
import logger from '../config/logger.js';

const router = Router();

// Middleware para registrar todas las peticiones a la API
router.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Configuración de rutas principales
//router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/locales', localRoutes);

// Rutas de WhatsApp
router.use('/whatsapp/messages', whatsappMessageRoutes);
router.use('/whatsapp/templates', whatsappTemplateRoutes);

// Información de la API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Evolution Backend',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      admin: '/api/admin',
      locales: '/api/locales'
    }
  });
});

export default router; 