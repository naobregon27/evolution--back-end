/**
 * Middleware para permitir todas las solicitudes CORS sin restricciones
 * ADVERTENCIA: No usar en producción sin restricciones adecuadas
 */
const allCors = (req, res, next) => {
  // Configurar headers CORS para permitir todas las solicitudes
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Manejar solicitudes preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

export default allCors; 