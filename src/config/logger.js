import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Definir formato personalizado
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Determinar la ruta de logs según el entorno
const isProduction = process.env.NODE_ENV === 'production';
// En producción (como Render), es mejor usar un directorio temporal o logs en consola
const logDir = isProduction ? '/tmp/evolution-logs' : path.join(process.cwd(), 'logs');

// Crear directorio de logs si no existe
try {
  if (!isProduction) {
    // Solo crear directorio en desarrollo local
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
} catch (error) {
  console.error('Error al crear directorio de logs:', error);
}

// Configurar transports según el entorno
const transports = [
  // Escribir logs en consola (en todos los entornos)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

// Agregar archivos de logs solo en desarrollo
if (!isProduction) {
  transports.push(
    // Guardar logs de error en archivo
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Guardar logs generales en archivo
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  );
}

// Crear logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports,
  // Manejar excepciones
  exceptionHandlers: isProduction 
    ? [new winston.transports.Console()] 
    : [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: path.join(logDir, 'exceptions.log') 
        })
      ]
});

export default logger; 