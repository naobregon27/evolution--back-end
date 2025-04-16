import { google } from 'googleapis';
import ical from 'ical-generator';
import Evento from '../models/Evento.js';
import logger from '../config/logger.js';

/**
 * Servicio para integración con calendarios externos
 */

// Configuración de Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Obtiene un cliente OAuth2 autenticado para Google Calendar
 * @param {Object} credenciales - Credenciales de OAuth2
 * @returns {Object} - Cliente OAuth2 autenticado
 */
export const getGoogleCalendarAuth = (credenciales) => {
  const { clientId, clientSecret, redirectUri, refreshToken } = credenciales;
  
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  oAuth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  return oAuth2Client;
};

/**
 * Obtiene la URL para autorización de Google Calendar
 * @param {Object} credenciales - Credenciales de OAuth2
 * @returns {String} - URL de autorización
 */
export const getGoogleAuthUrl = (credenciales) => {
  const { clientId, clientSecret, redirectUri } = credenciales;
  
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  
  return authUrl;
};

/**
 * Obtiene un token de acceso con el código de autorización
 * @param {Object} credenciales - Credenciales de OAuth2
 * @param {String} code - Código de autorización
 * @returns {Object} - Token de acceso
 */
export const getGoogleTokenWithCode = async (credenciales, code) => {
  const { clientId, clientSecret, redirectUri } = credenciales;
  
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
};

/**
 * Sincroniza un evento con Google Calendar
 * @param {Object} evento - Objeto evento
 * @param {Object} credenciales - Credenciales de OAuth2
 * @returns {Object} - Evento de Google Calendar
 */
export const sincronizarEventoConGoogle = async (evento, credenciales) => {
  try {
    const auth = getGoogleCalendarAuth(credenciales);
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Preparar evento para Google Calendar
    const googleEvent = {
      summary: evento.titulo,
      description: evento.descripcion || '',
      start: {
        dateTime: evento.fechaInicio.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      end: {
        dateTime: evento.fechaFin.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      location: evento.ubicacion?.direccion || '',
      attendees: evento.participantes?.map(p => ({
        email: p.usuario.email,
        responseStatus: p.confirmado ? 'accepted' : 'needsAction'
      })) || [],
      reminders: {
        useDefault: false,
        overrides: evento.recordatorios?.map(r => ({
          method: r.tipo === 'EMAIL' ? 'email' : 'popup',
          minutes: r.tiempo
        })) || [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 }
        ]
      }
    };
    
    let respuesta;
    
    // Si ya tiene ID de Google Calendar, actualizar
    if (evento.metadata?.idCalendarioExterno) {
      respuesta = await calendar.events.update({
        calendarId: 'primary',
        eventId: evento.metadata.idCalendarioExterno,
        resource: googleEvent
      });
      
      logger.info(`Evento actualizado en Google Calendar: ${respuesta.data.id}`);
    } else {
      // Si no tiene ID, crear nuevo
      respuesta = await calendar.events.insert({
        calendarId: 'primary',
        resource: googleEvent
      });
      
      // Guardar ID en el evento
      await Evento.findByIdAndUpdate(evento._id, {
        'metadata.idCalendarioExterno': respuesta.data.id,
        'metadata.urlCalendarioExterno': respuesta.data.htmlLink
      });
      
      logger.info(`Evento creado en Google Calendar: ${respuesta.data.id}`);
    }
    
    return respuesta.data;
  } catch (error) {
    logger.error(`Error al sincronizar con Google Calendar: ${error.message}`);
    throw error;
  }
};

/**
 * Elimina un evento de Google Calendar
 * @param {Object} evento - Objeto evento
 * @param {Object} credenciales - Credenciales de OAuth2
 * @returns {Boolean} - True si se eliminó exitosamente
 */
export const eliminarEventoDeGoogle = async (evento, credenciales) => {
  try {
    // Si no tiene ID de Google Calendar, no hacer nada
    if (!evento.metadata?.idCalendarioExterno) {
      return true;
    }
    
    const auth = getGoogleCalendarAuth(credenciales);
    const calendar = google.calendar({ version: 'v3', auth });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: evento.metadata.idCalendarioExterno
    });
    
    logger.info(`Evento eliminado de Google Calendar: ${evento.metadata.idCalendarioExterno}`);
    return true;
  } catch (error) {
    logger.error(`Error al eliminar de Google Calendar: ${error.message}`);
    throw error;
  }
};

/**
 * Genera un archivo iCal para un evento
 * @param {Object} evento - Objeto evento
 * @returns {String} - Contenido del archivo iCal
 */
export const generarICalParaEvento = (evento) => {
  try {
    const calendar = ical({
      domain: 'evolutionbackend.com',
      prodId: { company: 'Evolution', product: 'Calendar' },
      name: 'Evento: ' + evento.titulo,
      timezone: 'America/Argentina/Buenos_Aires'
    });
    
    const event = calendar.createEvent({
      start: evento.fechaInicio,
      end: evento.fechaFin,
      summary: evento.titulo,
      description: evento.descripcion || '',
      location: evento.ubicacion?.direccion || '',
      url: evento.ubicacion?.enlaceVirtual || ''
    });
    
    // Agregar organizador
    if (evento.creadoPor && evento.creadoPor.email) {
      event.organizer({
        name: evento.creadoPor.nombre || 'Organizador',
        email: evento.creadoPor.email
      });
    }
    
    // Agregar participantes
    if (evento.participantes && evento.participantes.length > 0) {
      evento.participantes.forEach(p => {
        if (p.usuario && p.usuario.email) {
          event.createAttendee({
            name: p.usuario.nombre || 'Participante',
            email: p.usuario.email,
            status: p.confirmado ? 'ACCEPTED' : 'NEEDS-ACTION',
            rsvp: true,
            role: p.rol === 'ORGANIZADOR' ? 'CHAIR' : 'REQ-PARTICIPANT'
          });
        }
      });
    }
    
    // Generar iCal como string
    return calendar.toString();
  } catch (error) {
    logger.error(`Error al generar iCal: ${error.message}`);
    throw error;
  }
};

/**
 * Importa eventos desde un archivo iCal
 * @param {String} icalString - Contenido del archivo iCal
 * @param {String} usuarioId - ID del usuario que importa
 * @param {String} localId - ID del local
 * @returns {Array} - Lista de eventos importados
 */
export const importarEventosDesdeICal = async (icalString, usuarioId, localId) => {
  // Esta función requiere una librería adicional para parsear iCal
  // como ical.js o node-ical, que habría que instalar
  // Por ahora es un placeholder
  logger.info('Importación desde iCal no implementada aún');
  return [];
};

/**
 * Controlador para generar archivo iCal
 */
export const descargarICalEvento = async (req, res) => {
  try {
    const { id } = req.params;
    
    const evento = await Evento.findById(id)
      .populate('creadoPor', 'nombre email')
      .populate('participantes.usuario', 'nombre email');
    
    if (!evento) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado'
      });
    }
    
    const icalString = generarICalParaEvento(evento);
    
    // Configurar respuesta para descarga de archivo
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="evento-${id}.ics"`);
    
    res.send(icalString);
  } catch (error) {
    logger.error(`Error al generar iCal para descarga: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: 'Error al generar archivo iCal',
      error: error.message
    });
  }
}; 