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

// Configuración de variables de entorno
dotenv.config();

// Inicializar Express
const app = express();

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
app.use(morgan('dev')); // Logging
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
    documentation: '/api'
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
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Función para actualizar usuarios inactivos y estadísticas
const actualizarEstadoSistema = async () => {
  try {
    // Marcar como desconectados los usuarios inactivos por más de 30 minutos
    const usuariosActualizados = await User.actualizarEstadoInactividad(30);
    
    if (usuariosActualizados > 0) {
      logger.info(`Se actualizaron ${usuariosActualizados} usuarios a estado "desconectado" por inactividad`);
    }
    
    // Actualizar estadísticas de locales (cada hora)
    const ahora = new Date();
    if (ahora.getMinutes() < 5) { // Ejecutar en los primeros 5 minutos de cada hora
      const localesActualizados = await Local.actualizarTodasLasEstadisticas();
      if (localesActualizados > 0) {
        logger.info(`Se actualizaron estadísticas de ${localesActualizados} locales`);
      }
    }
  } catch (error) {
    logger.error(`Error en actualización automática: ${error.message}`);
  }
};

// Programar la tarea para ejecutarse cada 5 minutos
setInterval(actualizarEstadoSistema, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT}`);
  
  // Ejecutar actualización inicial
  actualizarEstadoSistema();
}); 