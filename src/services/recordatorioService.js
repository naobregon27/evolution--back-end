import Recordatorio from '../models/Recordatorio.js';
import logger from '../config/logger.js';
import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';
import { sendWhatsAppMessage } from './whatsappService.js';

/**
 * Procesa los recordatorios pendientes y envía notificaciones
 */
export const procesarRecordatoriosPendientes = async () => {
  try {
    logger.info('Iniciando procesamiento de recordatorios pendientes');
    
    const ahora = new Date();
    
    // Buscar recordatorios pendientes cuya fecha de envío ya pasó
    const recordatoriosPendientes = await Recordatorio.find({
      fechaProgramada: { $lte: ahora },
      estado: 'PENDIENTE'
    })
    .populate('evento', 'titulo fechaInicio')
    .populate('cliente', 'nombre apellido email telefono')
    .sort({ prioridad: -1, fechaProgramada: 1 });
    
    logger.info(`Encontrados ${recordatoriosPendientes.length} recordatorios pendientes`);
    
    // Procesar cada recordatorio
    for (const recordatorio of recordatoriosPendientes) {
      await procesarRecordatorio(recordatorio);
    }
    
    return {
      total: recordatoriosPendientes.length,
      mensaje: `Procesados ${recordatoriosPendientes.length} recordatorios pendientes`
    };
  } catch (error) {
    logger.error(`Error al procesar recordatorios pendientes: ${error.message}`);
    throw error;
  }
};

/**
 * Procesa un recordatorio individual enviando la notificación correspondiente
 * @param {Object} recordatorio - El objeto recordatorio a procesar
 */
const procesarRecordatorio = async (recordatorio) => {
  try {
    // Actualizar el número de intentos
    recordatorio.intentos += 1;
    
    // Preparar mensaje
    const mensaje = prepararMensaje(recordatorio);
    
    // Enviar notificación según el tipo
    let resultado = false;
    
    switch (recordatorio.tipo) {
      case 'EMAIL':
        resultado = await enviarPorEmail(recordatorio, mensaje);
        break;
      case 'SMS':
        resultado = await enviarPorSMS(recordatorio, mensaje);
        break;
      case 'WHATSAPP':
        resultado = await enviarPorWhatsApp(recordatorio, mensaje);
        break;
      case 'NOTIFICACION':
        // Las notificaciones push se implementarán en el futuro
        resultado = false;
        break;
      default:
        logger.warn(`Tipo de recordatorio no soportado: ${recordatorio.tipo}`);
        resultado = false;
    }
    
    // Actualizar estado del recordatorio
    if (resultado) {
      recordatorio.estado = 'ENVIADO';
      recordatorio.ultimoIntento = new Date();
      
      // Marcar destinatarios como notificados
      recordatorio.destinatarios.forEach(destinatario => {
        destinatario.notificado = true;
      });
      
      logger.info(`Recordatorio ID:${recordatorio._id} enviado correctamente`);
    } else {
      // Si ha fallado pero aún no se alcanza el máximo de intentos, sigue en PENDIENTE
      if (recordatorio.intentos >= 3) {
        recordatorio.estado = 'FALLIDO';
        recordatorio.mensajeError = 'Máximo número de intentos alcanzado';
        logger.warn(`Recordatorio ID:${recordatorio._id} marcado como FALLIDO después de ${recordatorio.intentos} intentos`);
      } else {
        logger.warn(`Intento ${recordatorio.intentos} de envío de recordatorio ID:${recordatorio._id} fallido, reintentando más tarde`);
      }
      
      recordatorio.ultimoIntento = new Date();
    }
    
    // Guardar cambios
    await recordatorio.save();
    
    return resultado;
  } catch (error) {
    logger.error(`Error al procesar recordatorio ID:${recordatorio._id}: ${error.message}`);
    
    // Actualizar estado a FALLIDO si hay error
    recordatorio.estado = 'FALLIDO';
    recordatorio.mensajeError = error.message;
    recordatorio.ultimoIntento = new Date();
    await recordatorio.save();
    
    return false;
  }
};

/**
 * Preparar el mensaje de la notificación
 * @param {Object} recordatorio - El objeto recordatorio
 * @returns {Object} - Objeto con asunto y contenido
 */
const prepararMensaje = (recordatorio) => {
  // Usar plantilla personalizada si existe
  if (recordatorio.plantillaPersonalizada && 
      recordatorio.plantillaPersonalizada.asunto && 
      recordatorio.plantillaPersonalizada.contenido) {
    
    return {
      asunto: reemplazarVariables(recordatorio.plantillaPersonalizada.asunto, recordatorio),
      contenido: reemplazarVariables(recordatorio.plantillaPersonalizada.contenido, recordatorio)
    };
  }
  
  // Si no hay plantilla personalizada, crear mensaje estándar
  let asunto = recordatorio.titulo || 'Recordatorio';
  
  let contenido = recordatorio.descripcion || '';
  
  if (recordatorio.evento) {
    asunto = `Recordatorio: ${recordatorio.evento.titulo}`;
    
    const fechaEvento = recordatorio.evento.fechaInicio 
      ? new Date(recordatorio.evento.fechaInicio).toLocaleString('es-ES') 
      : 'fecha no especificada';
    
    contenido = `
      Tienes un evento programado para ${fechaEvento}.
      
      ${recordatorio.descripcion || ''}
    `;
  }
  
  return { asunto, contenido };
};

/**
 * Reemplaza las variables en una plantilla con valores reales
 * @param {String} texto - El texto con variables
 * @param {Object} recordatorio - El objeto recordatorio con los datos
 * @returns {String} - Texto con variables reemplazadas
 */
const reemplazarVariables = (texto, recordatorio) => {
  let resultado = texto;
  
  // Variables de evento
  if (recordatorio.evento) {
    resultado = resultado.replace(/{evento.titulo}/g, recordatorio.evento.titulo || '');
    resultado = resultado.replace(/{evento.fecha}/g, 
      recordatorio.evento.fechaInicio 
        ? new Date(recordatorio.evento.fechaInicio).toLocaleString('es-ES') 
        : 'fecha no especificada'
    );
  }
  
  // Variables de cliente
  if (recordatorio.cliente) {
    resultado = resultado.replace(/{cliente.nombre}/g, recordatorio.cliente.nombre || '');
    resultado = resultado.replace(/{cliente.apellido}/g, recordatorio.cliente.apellido || '');
    resultado = resultado.replace(/{cliente.email}/g, recordatorio.cliente.email || '');
    resultado = resultado.replace(/{cliente.telefono}/g, recordatorio.cliente.telefono || '');
    resultado = resultado.replace(/{cliente.nombreCompleto}/g, 
      `${recordatorio.cliente.nombre || ''} ${recordatorio.cliente.apellido || ''}`.trim()
    );
  }
  
  // Otras variables
  resultado = resultado.replace(/{fecha.hoy}/g, new Date().toLocaleDateString('es-ES'));
  resultado = resultado.replace(/{fecha.ahora}/g, new Date().toLocaleString('es-ES'));
  
  return resultado;
};

/**
 * Envía un recordatorio por email
 * @param {Object} recordatorio - El objeto recordatorio
 * @param {Object} mensaje - El mensaje preparado (asunto y contenido)
 * @returns {Boolean} - Verdadero si se envió correctamente
 */
const enviarPorEmail = async (recordatorio, mensaje) => {
  try {
    // Obtener destinatarios de email
    const destinatariosEmail = [];
    
    for (const destinatario of recordatorio.destinatarios) {
      if (destinatario.tipo === 'USUARIO') {
        // Buscar email del usuario
        const usuario = await mongoose.model('User').findById(destinatario.id)
          .select('email nombre');
          
        if (usuario && usuario.email) {
          destinatariosEmail.push({
            email: usuario.email,
            nombre: usuario.nombre
          });
        }
      } else if (destinatario.tipo === 'CLIENTE') {
        // Buscar email del cliente
        const cliente = await mongoose.model('Cliente').findById(destinatario.id)
          .select('email nombre apellido');
          
        if (cliente && cliente.email) {
          destinatariosEmail.push({
            email: cliente.email,
            nombre: `${cliente.nombre} ${cliente.apellido}`
          });
        }
      }
    }
    
    if (destinatariosEmail.length === 0) {
      logger.warn(`No se encontraron destinatarios válidos para el recordatorio ID:${recordatorio._id}`);
      return false;
    }
    
    // Enviar email a cada destinatario
    for (const destinatario of destinatariosEmail) {
      await sendEmail({
        to: destinatario.email,
        subject: mensaje.asunto,
        html: mensaje.contenido,
        text: mensaje.contenido.replace(/<[^>]*>/g, '') // Versión texto plano
      });
    }
    
    logger.info(`Email enviado a ${destinatariosEmail.length} destinatarios`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar recordatorio por email: ${error.message}`);
    return false;
  }
};

/**
 * Envía un recordatorio por SMS
 * @param {Object} recordatorio - El objeto recordatorio
 * @param {Object} mensaje - El mensaje preparado (asunto y contenido)
 * @returns {Boolean} - Verdadero si se envió correctamente
 */
const enviarPorSMS = async (recordatorio, mensaje) => {
  try {
    // Obtener destinatarios de SMS
    const destinatariosSMS = [];
    
    for (const destinatario of recordatorio.destinatarios) {
      if (destinatario.tipo === 'USUARIO') {
        // Buscar teléfono del usuario
        const usuario = await mongoose.model('User').findById(destinatario.id)
          .select('telefono nombre');
          
        if (usuario && usuario.telefono) {
          destinatariosSMS.push({
            telefono: usuario.telefono,
            nombre: usuario.nombre
          });
        }
      } else if (destinatario.tipo === 'CLIENTE') {
        // Buscar teléfono del cliente
        const cliente = await mongoose.model('Cliente').findById(destinatario.id)
          .select('telefono nombre apellido');
          
        if (cliente && cliente.telefono) {
          destinatariosSMS.push({
            telefono: cliente.telefono,
            nombre: `${cliente.nombre} ${cliente.apellido}`
          });
        }
      }
    }
    
    if (destinatariosSMS.length === 0) {
      logger.warn(`No se encontraron destinatarios válidos para el recordatorio ID:${recordatorio._id}`);
      return false;
    }
    
    // Contenido del SMS (solo texto plano y limitado)
    let contenidoSMS = `${mensaje.asunto}: ${mensaje.contenido.replace(/<[^>]*>/g, '')}`;
    // Limitar longitud para SMS
    contenidoSMS = contenidoSMS.substring(0, 160);
    
    // Enviar SMS a cada destinatario
    for (const destinatario of destinatariosSMS) {
      await sendSMS({
        to: destinatario.telefono,
        message: contenidoSMS
      });
    }
    
    logger.info(`SMS enviado a ${destinatariosSMS.length} destinatarios`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar recordatorio por SMS: ${error.message}`);
    return false;
  }
};

/**
 * Envía un recordatorio por WhatsApp
 * @param {Object} recordatorio - El objeto recordatorio
 * @param {Object} mensaje - El mensaje preparado (asunto y contenido)
 * @returns {Boolean} - Verdadero si se envió correctamente
 */
const enviarPorWhatsApp = async (recordatorio, mensaje) => {
  try {
    // Obtener destinatarios de WhatsApp
    const destinatariosWA = [];
    
    for (const destinatario of recordatorio.destinatarios) {
      if (destinatario.tipo === 'USUARIO') {
        // Buscar teléfono del usuario
        const usuario = await mongoose.model('User').findById(destinatario.id)
          .select('telefono nombre');
          
        if (usuario && usuario.telefono) {
          destinatariosWA.push({
            telefono: usuario.telefono,
            nombre: usuario.nombre
          });
        }
      } else if (destinatario.tipo === 'CLIENTE') {
        // Buscar teléfono del cliente
        const cliente = await mongoose.model('Cliente').findById(destinatario.id)
          .select('telefono nombre apellido');
          
        if (cliente && cliente.telefono) {
          destinatariosWA.push({
            telefono: cliente.telefono,
            nombre: `${cliente.nombre} ${cliente.apellido}`
          });
        }
      }
    }
    
    if (destinatariosWA.length === 0) {
      logger.warn(`No se encontraron destinatarios válidos para el recordatorio ID:${recordatorio._id}`);
      return false;
    }
    
    // Enviar WhatsApp a cada destinatario
    for (const destinatario of destinatariosWA) {
      await sendWhatsAppMessage({
        to: destinatario.telefono,
        message: mensaje.contenido.replace(/<[^>]*>/g, ''), // Versión texto plano
        templateName: 'recordatorio', // Si se usa una plantilla
        templateData: {
          nombre: destinatario.nombre,
          titulo: mensaje.asunto,
          fecha: recordatorio.evento?.fechaInicio 
            ? new Date(recordatorio.evento.fechaInicio).toLocaleString('es-ES') 
            : new Date().toLocaleString('es-ES')
        }
      });
    }
    
    logger.info(`WhatsApp enviado a ${destinatariosWA.length} destinatarios`);
    return true;
  } catch (error) {
    logger.error(`Error al enviar recordatorio por WhatsApp: ${error.message}`);
    return false;
  }
};

// Exportar un método para ejecutar manualmente
export const procesarRecordatoriosManual = async (req, res) => {
  try {
    const resultado = await procesarRecordatoriosPendientes();
    
    return res.json({
      success: true,
      message: resultado.mensaje,
      data: resultado
    });
  } catch (error) {
    logger.error(`Error al procesar recordatorios manual: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      message: 'Error al procesar recordatorios',
      error: error.message
    });
  }
}; 