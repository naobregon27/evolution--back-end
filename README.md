# Evolution Backend

Backend completo para gestión de clientes, eventos y recordatorios, desarrollado con Node.js, Express y MongoDB.

## Características

- 🔐 **Autenticación completa**: Sistema de login, registro y gestión de usuarios.
- 👥 **Gestión de clientes**: Información detallada, categorización y seguimiento.
- 📅 **Gestión de eventos**: Planificación de reuniones, entrevistas y tareas.
- ⏰ **Sistema de recordatorios**: Notificaciones programables por email, SMS o WhatsApp.
- 📝 **Notas**: Sistema de notas con historial de versiones, etiquetas y posibilidad de compartir.
- 🔄 **Sincronización con calendarios**: Integración con Google Calendar y formato iCal.
- 📊 **Estadísticas**: Análisis de datos para mejor toma de decisiones.

## Estructura del proyecto

```
src/
├── config/          # Configuración (DB, logger, etc.)
├── controllers/     # Controladores para cada entidad
├── middlewares/     # Middlewares de autenticación, validación, etc.
├── models/          # Modelos de datos (Mongoose)
├── routes/          # Rutas de la API
├── scripts/         # Scripts y tareas programadas
├── services/        # Servicios (email, SMS, WhatsApp, etc.)
└── index.js         # Punto de entrada de la aplicación
```

## Modelos principales

1. **Usuario**: Gestión de acceso al sistema con roles y permisos.
2. **Cliente**: Información de contacto y perfil completo.
3. **Evento**: Reuniones, entrevistas y tareas.
4. **Recordatorio**: Notificaciones asociadas a eventos.
5. **Nota**: Información adicional vinculada a clientes o eventos.

## Instalación

1. Clonar el repositorio:
   ```
   git clone https://github.com/tu-usuario/evolution-backend.git
   cd evolution-backend
   ```

2. Instalar dependencias:
   ```
   npm install
   ```

3. Configurar variables de entorno creando un archivo `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/evolution
   JWT_SECRET=tu_clave_secreta_jwt
   PORT=3000
   
   # Configuración de email
   EMAIL_SERVICE=gmail
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASS=tu_contraseña
   
   # Configuración de SMS (Twilio)
   TWILIO_ACCOUNT_SID=tu_sid
   TWILIO_AUTH_TOKEN=tu_token
   TWILIO_PHONE_NUMBER=+1234567890
   
   # Configuración de WhatsApp
   WHATSAPP_API_KEY=tu_api_key
   
   # Google Calendar
   GOOGLE_CLIENT_ID=tu_client_id
   GOOGLE_CLIENT_SECRET=tu_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback
   ```

4. Iniciar la aplicación:
   ```
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## API Endpoints

### Autenticación

- `POST /api/users/register` - Registro de usuario
- `POST /api/users/login` - Login de usuario
- `POST /api/users/logout` - Cerrar sesión

### Clientes

- `GET /api/clientes` - Obtener todos los clientes
- `GET /api/clientes/:id` - Obtener un cliente por ID
- `POST /api/clientes` - Crear un nuevo cliente
- `PUT /api/clientes/:id` - Actualizar un cliente
- `DELETE /api/clientes/:id` - Eliminar un cliente
- `POST /api/clientes/:id/notas` - Agregar una nota a un cliente
- `POST /api/clientes/:id/interacciones` - Registrar interacción con un cliente
- `GET /api/clientes/estadisticas` - Obtener estadísticas de clientes

### Eventos

- `GET /api/eventos` - Obtener todos los eventos
- `GET /api/eventos/:id` - Obtener un evento por ID
- `POST /api/eventos` - Crear un nuevo evento
- `PUT /api/eventos/:id` - Actualizar un evento
- `DELETE /api/eventos/:id` - Eliminar un evento
- `POST /api/eventos/:id/notas` - Agregar una nota a un evento
- `POST /api/eventos/:id/confirmar` - Confirmar participación en un evento
- `GET /api/eventos/cliente/:clienteId` - Obtener eventos por cliente
- `GET /api/eventos/:id/ical` - Descargar archivo iCal de un evento

### Recordatorios

- `GET /api/recordatorios` - Obtener todos los recordatorios
- `GET /api/recordatorios/:id` - Obtener un recordatorio por ID
- `POST /api/recordatorios` - Crear un nuevo recordatorio
- `PUT /api/recordatorios/:id` - Actualizar un recordatorio
- `DELETE /api/recordatorios/:id` - Eliminar un recordatorio
- `POST /api/recordatorios/:id/marcar-enviado` - Marcar un recordatorio como enviado
- `GET /api/recordatorios/sistema/pendientes` - Obtener recordatorios pendientes

### Notas

- `GET /api/notas` - Obtener todas las notas
- `GET /api/notas/:id` - Obtener una nota por ID
- `POST /api/notas` - Crear una nueva nota
- `PUT /api/notas/:id` - Actualizar una nota
- `DELETE /api/notas/:id` - Eliminar una nota
- `POST /api/notas/:id/compartir` - Compartir una nota con otros usuarios
- `DELETE /api/notas/:id/compartir/:usuarioId` - Dejar de compartir una nota
- `GET /api/notas/:id/versiones` - Obtener historial de versiones de una nota
- `PUT /api/notas/:id/favorita` - Marcar/desmarcar una nota como favorita

## Tecnologías utilizadas

- **Node.js**: Entorno de ejecución.
- **Express**: Framework web.
- **MongoDB**: Base de datos.
- **Mongoose**: ODM para MongoDB.
- **JWT**: Autenticación basada en tokens.
- **bcrypt**: Encriptación de contraseñas.
- **node-cron**: Tareas programadas.
- **nodemailer**: Envío de emails.
- **Twilio**: Envío de SMS y mensajes de WhatsApp.
- **Google APIs**: Integración con Google Calendar.
- **ical-generator**: Generación de archivos iCal.
- **Winston**: Sistema de logging.

## Pruebas con Postman

Para probar la API con Postman:

1. Importa la colección de Postman desde el archivo `Evolution-API.postman_collection.json`.
2. Configura las variables de entorno en Postman:
   - `base_url`: URL base de la API (ej: `http://localhost:3000/api`)
   - `token`: Token JWT que obtendrás después de iniciar sesión

3. Las solicitudes están organizadas por carpetas según la entidad.
4. Para autenticación, usa primero el endpoint de login y el token JWT se guardará automáticamente en las variables de entorno para las siguientes solicitudes.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles. 