// Imports con sintaxis ES6
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import apiRoutes from './routes/index.js';
import logger from './config/logger.js';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import User from './models/User.js';
import Local from './models/Local.js';
import mongoose from 'mongoose';

// Configuración de variables de entorno
dotenv.config();

// Inicializar Express
const app = express();

// Configuración para Render
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Conectar a la base de datos
connectDB();

// Middlewares de seguridad
app.use(helmet()); // Seguridad básica de headers
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
  }
}));

// Limitar solicitudes para prevenir ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limitar a 100 solicitudes por ventana
  standardHeaders: true,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intente más tarde'
  }
});
app.use('/api/', limiter);

// Configuración específica para rutas de autenticación
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 intentos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de login, intente más tarde'
  }
});
app.use('/api/users/login', authLimiter);

// Configuración CORS más restrictiva
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 horas
};
app.use(cors(corsOptions));

// Otros middlewares
app.use(morgan(isProduction ? 'combined' : 'dev')); // Logging
app.use(express.json({ limit: '10kb' })); // Limitar tamaño del body para evitar ataques
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitización de datos contra NoSQL injection
app.use(mongoSanitize());

// Sanitización contra XSS
app.use(xss());

// Página de inicio
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'API Evolution Backend', 
    version: '1.0.0',
    documentation: '/api',
    environment: process.env.NODE_ENV
  });
});

// Montar todas las rutas de la API usando el router centralizado
app.use('/api', apiRoutes);

// Ruta para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Ruta no encontrada' 
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  // No revelar detalles de errores internos en producción
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.status ? err.message : 'Error interno del servidor',
    error: isProduction ? undefined : err.message
  });
});

// Función para actualizar usuarios inactivos y estadísticas
const actualizarEstadoSistema = async () => {
  try {
    // Verificar que hay conexión a MongoDB antes de proceder
    if (mongoose.connection.readyState !== 1) {
      logger.warn('No se puede actualizar estado de sistema - MongoDB no está conectado');
      return;
    }

    // Marcar como desconectados los usuarios inactivos por más de 30 minutos
    try {
      const usuariosActualizados = await User.actualizarEstadoInactividad(30);
      
      if (usuariosActualizados > 0) {
        logger.info(`Se actualizaron ${usuariosActualizados} usuarios a estado "desconectado" por inactividad`);
      }
    } catch (userError) {
      logger.error(`Error al actualizar estado de inactividad: ${userError.message}`);
      // No lanzamos el error para que no afecte a otras operaciones
    }
    
    // Actualizar estadísticas de locales (cada hora)
    try {
      const ahora = new Date();
      if (ahora.getMinutes() < 5) { // Ejecutar en los primeros 5 minutos de cada hora
        const localesActualizados = await Local.actualizarTodasLasEstadisticas();
        if (localesActualizados > 0) {
          logger.info(`Se actualizaron estadísticas de ${localesActualizados} locales`);
        }
      }
    } catch (localError) {
      logger.error(`Error al actualizar estadísticas de locales: ${localError.message}`);
    }
  } catch (error) {
    logger.error(`Error general en actualización automática: ${error.message}`);
    // No terminamos el proceso, simplemente registramos el error
  }
};

// Programar la tarea para ejecutarse cada 5 minutos
setInterval(actualizarEstadoSistema, 5 * 60 * 1000);

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT} en modo ${process.env.NODE_ENV || 'desarrollo'}`);
  
  // Ejecutar actualización inicial
  actualizarEstadoSistema();
}); 