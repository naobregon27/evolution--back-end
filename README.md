# Evolution Backend

API REST construida con Node.js y Express.

## Requisitos Previos

- Node.js (v14 o superior)
- MongoDB
- npm o yarn

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
   - Copiar el archivo `.env.example` a `.env`
   - Ajustar las variables según sea necesario

## Scripts Disponibles

- `npm start`: Inicia el servidor en modo producción
- `npm run dev`: Inicia el servidor en modo desarrollo con hot-reload
- `npm test`: Ejecuta las pruebas

## Estructura del Proyecto

```
src/
├── config/         # Configuraciones
├── controllers/    # Controladores
├── middlewares/    # Middlewares
├── models/        # Modelos
├── routes/        # Rutas
├── services/      # Servicios
├── utils/         # Utilidades
└── index.js       # Punto de entrada
```

## Tecnologías Utilizadas

- Express.js
- MongoDB con Mongoose
- JWT para autenticación
- Winston para logging
- Jest para testing

## Despliegue en Render

Para desplegar esta aplicación en Render, sigue estos pasos:

1. Crea una cuenta en [Render](https://render.com/) si no la tienes
2. Desde el dashboard de Render, haz clic en "New" y selecciona "Web Service"
3. Conecta tu repositorio de GitHub
4. Configura el servicio con los siguientes valores:
   - **Name**: evolution-backend (o el nombre que prefieras)
   - **Environment**: Node
   - **Build Command**: npm install
   - **Start Command**: npm start
   - **Plan**: Free (o el que necesites)

5. En la sección "Environment Variables", agrega las siguientes variables:
   - `PORT`: 10000 (Render asignará automáticamente un puerto)
   - `NODE_ENV`: production
   - `MONGODB_URI`: tu_uri_de_mongodb
   - `JWT_SECRET`: tu_secreto_jwt

6. Haz clic en "Create Web Service"

Alternativamente, puedes usar el archivo `render.yaml` incluido en este repositorio para configurar el despliegue automáticamente. 