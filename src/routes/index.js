import { Router } from 'express';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import localRoutes from './localRoutes.js';
import logger from '../config/logger.js';

const router = Router();

// Middleware para registrar todas las peticiones a la API
router.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Configuración de rutas principales
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/locales', localRoutes);

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