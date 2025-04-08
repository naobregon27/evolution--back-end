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