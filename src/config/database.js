import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

// Validar formato básico de la URI de MongoDB
const validarMongoURI = (uri) => {
  if (!uri) return false;
  
  // Verificar formato básico (mongodb:// o mongodb+srv://)
  const formatoValido = uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
  
  if (!formatoValido) {
    logger.error('El formato de MONGODB_URI es incorrecto. Debe comenzar con mongodb:// o mongodb+srv://');
    return false;
  }
  
  // Verificar que tenga usuario, contraseña y host
  try {
    const uriSinProtocolo = uri.replace(/^(mongodb):\/\/|^(mongodb\+srv):\/\//, '');
    const [credenciales, resto] = uriSinProtocolo.split('@');
    
    if (!credenciales || !resto) {
      logger.error('MONGODB_URI debe contener credenciales y host');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error al validar MONGODB_URI: ${error.message}`);
    return false;
  }
};

// Opciones de configuración mejoradas para Mongoose
const options = {
  serverSelectionTimeoutMS: 30000, // Aumentar timeout a 30 segundos
  socketTimeoutMS: 45000, // Timeout para operaciones de socket
  connectTimeoutMS: 30000, // Timeout para la conexión inicial
  heartbeatFrequencyMS: 10000, // Frecuencia de latido (heartbeat)
  retryWrites: true, // Reintentar escrituras 
  retryReads: true,  // Reintentar lecturas
};

// Función para conectar a la base de datos con reintentos
export const connectDB = async (retryCount = 5) => {
  try {
    logger.info(`Intentando conectar a MongoDB... (Intento ${6 - retryCount})`);
    
    // Verificar que tenemos la URI configurada
    if (!process.env.MONGODB_URI) {
      throw new Error('La variable de entorno MONGODB_URI no está configurada');
    }
    
    // Validar formato de la URI
    if (!validarMongoURI(process.env.MONGODB_URI)) {
      throw new Error('La variable de entorno MONGODB_URI tiene un formato incorrecto');
    }
    
    // Mostrar URI parcial en logs (ocultando credenciales por seguridad)
    const uriOculta = process.env.MONGODB_URI.replace(
      /(mongodb|mongodb\+srv):\/\/([^:]+):([^@]+)@/,
      '$1://$2:****@'
    );
    logger.info(`Conectando a: ${uriOculta}`);
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, options);
    logger.info('Conexión exitosa a MongoDB');
    
    // Configurar eventos de conexión
    setupConnectionHandlers();
    
  } catch (error) {
    logger.error(`Error al conectar a MongoDB: ${error.message}`);
    
    // Si el error es de autenticación o acceso, mostrar un mensaje más específico
    if (error.message.includes('Authentication failed') || 
        error.message.includes('not authorized') ||
        error.message.includes('ECONNREFUSED')) {
      logger.error('Problema de autenticación o acceso. Verifica credenciales y lista blanca de IPs en MongoDB Atlas');
    }
    
    // Reintentar la conexión si aún tenemos intentos disponibles
    if (retryCount > 0) {
      logger.info(`Reintentando conexión en 5 segundos... (${retryCount} intentos restantes)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retryCount - 1);
    } else {
      logger.error('Se agotaron los intentos de conexión a MongoDB');
      process.exit(1); // Salir con error después de agotar reintentos
    }
  }
};

// Configurar manejadores de eventos para la conexión
const setupConnectionHandlers = () => {
  // Manejar desconexión
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB desconectado - Intentando reconectar...');
    
    // Intentar reconectar con retraso
    setTimeout(() => {
      connectDB(3);  // Intentar reconectar hasta 3 veces
    }, 3000);
  });

  // Manejar errores en la conexión
  mongoose.connection.on('error', (err) => {
    logger.error(`Error en conexión MongoDB: ${err.message}`);
  });

  // Cuando la conexión está lista
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB conectado y listo para operaciones');
  });
};

export default connectDB; 