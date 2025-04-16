import cron from 'node-cron';
import { procesarRecordatoriosPendientes } from '../services/recordatorioService.js';
import logger from '../config/logger.js';

/**
 * Configura las tareas programadas
 */
export const configurarTareasProgramadas = () => {
  logger.info('Configurando tareas programadas...');
  
  // Procesar recordatorios cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Ejecutando tarea programada: procesamiento de recordatorios');
    
    try {
      const resultado = await procesarRecordatoriosPendientes();
      logger.info(`Tarea completada: ${resultado.mensaje}`);
    } catch (error) {
      logger.error(`Error en tarea programada de recordatorios: ${error.message}`);
    }
  });
  
  // Otras tareas programadas pueden agregarse aquí
  
  logger.info('Tareas programadas configuradas exitosamente');
};

/**
 * Inicia manualmente todas las tareas programadas
 */
export const ejecutarTareasManuales = async () => {
  logger.info('Ejecutando tareas manualmente...');
  
  try {
    // Procesar recordatorios
    const resultadoRecordatorios = await procesarRecordatoriosPendientes();
    logger.info(`Procesamiento de recordatorios: ${resultadoRecordatorios.mensaje}`);
    
    // Otras tareas pueden agregarse aquí
    
    return {
      success: true,
      message: 'Tareas ejecutadas exitosamente',
      resultados: {
        recordatorios: resultadoRecordatorios
      }
    };
  } catch (error) {
    logger.error(`Error al ejecutar tareas manualmente: ${error.message}`);
    
    return {
      success: false,
      message: 'Error al ejecutar tareas',
      error: error.message
    };
  }
};

// Exportar método para ejecución manual desde API
export const ejecutarTareasManual = async (req, res) => {
  try {
    const resultado = await ejecutarTareasManuales();
    
    return res.json({
      success: resultado.success,
      message: resultado.message,
      data: resultado
    });
  } catch (error) {
    logger.error(`Error al ejecutar tareas desde API: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Error al ejecutar tareas',
      error: error.message
    });
  }
}; 