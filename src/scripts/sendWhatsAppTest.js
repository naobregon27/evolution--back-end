import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración para cargar las variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Obtener credenciales desde variables de entorno
const apiKey = process.env.WHATSAPP_API_KEY;
const apiUrl = process.env.WHATSAPP_API_URL;
const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER;

// Verificar credenciales
if (!apiKey || !apiUrl || !phoneNumber) {
  console.error('Error: Faltan credenciales de WhatsApp en el archivo .env');
  process.exit(1);
}

// Número de teléfono destino (actualizar con tu número para pruebas)
const toNumber = process.argv[2] || '543777507158';
const userName = process.argv[3] || 'Nahuel';

// Configuración de la solicitud
const options = {
  method: 'POST',
  hostname: apiUrl,
  path: '/whatsapp/1/message/template',
  headers: {
    'Authorization': `App ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  maxRedirects: 20
};

// Crear un ID único para el mensaje
const messageId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Datos para enviar
const postData = JSON.stringify({
  messages: [
    {
      from: phoneNumber,
      to: toNumber,
      messageId: messageId,
      content: {
        templateName: "test_whatsapp_template_en",
        templateData: {
          body: {
            placeholders: [userName]
          }
        },
        language: "en"
      }
    }
  ]
});

console.log('Enviando mensaje de prueba...');
console.log(`De: ${phoneNumber}`);
console.log(`Para: ${toNumber}`);
console.log(`Nombre: ${userName}`);
console.log('Plantilla: test_whatsapp_template_en');

// Realizar la solicitud
const req = https.request(options, (res) => {
  let chunks = [];

  res.on('data', (chunk) => {
    chunks.push(chunk);
  });

  res.on('end', () => {
    const body = Buffer.concat(chunks);
    console.log('\nRespuesta de Infobip:');
    console.log(body.toString());
    
    try {
      const response = JSON.parse(body.toString());
      if (response.messages && response.messages[0].status) {
        const status = response.messages[0].status;
        console.log(`\nEstado: ${status.groupName} (${status.description})`);
        
        if (status.groupId === 1) {
          console.log('✅ Mensaje enviado correctamente');
        } else {
          console.error('❌ Error al enviar el mensaje');
        }
      }
    } catch (error) {
      console.error('Error al analizar la respuesta:', error.message);
    }
  });

  res.on('error', (error) => {
    console.error('Error en la respuesta:', error);
  });
});

req.on('error', (error) => {
  console.error('Error en la solicitud:', error);
});

// Enviar los datos
req.write(postData);
req.end();

console.log('\nSolicitud enviada, esperando respuesta...'); 