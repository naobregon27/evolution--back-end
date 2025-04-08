import winston from 'winston';
import path from 'path';

// Definir formato personalizado
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Crear logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Escribir logs en consola
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Guardar logs de error en archivo
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error' 
    }),
    // Guardar logs generales en archivo
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log') 
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join('logs', 'exceptions.log') 
    })
  ]
});

// Crear directorio de logs si no existe
if (process.env.NODE_ENV === 'production') {
  // En producción aquí se podría añadir lógica para crear la carpeta de logs
  // pero lo dejamos simplificado para este ejemplo
}

export default logger; 