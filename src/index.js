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
// import allCors from './middlewares/allCors.js'; // Importar el middleware de CORS sin restricciones

// Configuración de variables de entorno
dotenv.config();

// Inicializar Express
const app = express();

// Configuración para Render
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Configurar trust proxy para express-rate-limit
// Esto es necesario para aplicaciones detrás de proxies como los de Render, Heroku, etc.
app.set('trust proxy', 1);

// Conectar a la base de datos
connectDB();

// ÚLTIMO RECURSO: usar middleware que permite todas las solicitudes CORS
// app.use(allCors); // Descomenta esta línea si nada más funciona

// Middleware específico para solicitudes preflight OPTIONS - DEBE IR ANTES DE OTROS MIDDLEWARES
app.options('*', (req, res) => {
  // Configurar headers CORS para solicitudes preflight
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 horas
  // Responder exitosamente a la solicitud preflight
  res.status(204).end();
});

// Middlewares de seguridad
app.use(helmet()); // Seguridad básica de headers
// Configurar CSP para que no bloquee solicitudes CORS
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'", "*"],
    scriptSrc: ["'self'", "'unsafe-inline'", "*"],
    styleSrc: ["'self'", "'unsafe-inline'", "*"],
    imgSrc: ["'self'", "data:", "*"],
    connectSrc: ["'self'", "*"]  // Importante para CORS y fetch/XHR
  }
}));

// Middleware para depurar solicitudes CORS
app.use((req, res, next) => {
  logger.info(`Solicitud recibida: ${req.method} ${req.url} desde origen: ${req.headers.origin || 'no origin'}`);
  
  // Para las solicitudes preflight OPTIONS
  if (req.method === 'OPTIONS') {
    logger.info('Solicitud OPTIONS recibida - manejando preflight CORS');
  }
  
  // Siempre añadir estos headers para CORS
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Limitar solicitudes para prevenir ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limitar a 100 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
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
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de login, intente más tarde'
  }
});
app.use('/api/users/login', authLimiter);

// Configuración CORS más permisiva para desarrollo
const corsOptions = {
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como aplicaciones móviles o Postman)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:5173', 'http://localhost:3000', 'https://evolution-frontend.vercel.app', 'https://evolution-frontend.netlify.app'];
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Para depuración
      logger.warn(`Solicitud CORS bloqueada: ${origin} no está permitido`);
      // Durante desarrollo o pruebas, permitir todos los orígenes
      callback(null, true);
      // En producción estricta: callback(new Error('No permitido por CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 horas
  preflightContinue: false,
  optionsSuccessStatus: 204
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

// Ruta específica para prueba de CORS
app.get('/cors-test', (req, res) => {
  // Logs adicionales para depuración
  logger.info('Headers recibidos:');
  logger.info(JSON.stringify(req.headers));
  
  res.json({
    success: true,
    message: 'Prueba de CORS exitosa',
    origin: req.headers.origin || 'No origin',
    headers: req.headers
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
let tareasProgramadas;

// Esta función inicia las tareas programadas solo después de confirmar conexión exitosa a MongoDB
const iniciarTareasProgramadas = () => {
  // Verificar si ya existen tareas programadas para evitar duplicarlas
  if (tareasProgramadas) {
    clearInterval(tareasProgramadas);
  }
  
  // Ejecutar actualización inicial después de confirmar conexión
  actualizarEstadoSistema();
  
  // Programar ejecuciones futuras
  tareasProgramadas = setInterval(actualizarEstadoSistema, 5 * 60 * 1000);
  logger.info('Tareas programadas iniciadas correctamente');
};

// Escuchar el evento de conexión exitosa para iniciar tareas
mongoose.connection.once('connected', () => {
  logger.info('Conexión MongoDB establecida - Iniciando tareas programadas');
  iniciarTareasProgramadas();
});

// Escuchar reconexión para reiniciar tareas si es necesario
mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconectado - Reiniciando tareas programadas');
  iniciarTareasProgramadas();
});

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT} en modo ${process.env.NODE_ENV || 'desarrollo'}`);
  
  // Ya no ejecutamos actualizarEstadoSistema() aquí directamente
  // Se ejecutará cuando MongoDB esté conectado
}); 