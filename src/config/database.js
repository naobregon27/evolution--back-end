import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Opciones de configuración de Mongoose
const options = {
  // Estas opciones ya no son necesarias en Mongoose moderno, pero las dejo comentadas como referencia
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
  // useCreateIndex: true,
  // useFindAndModify: false
};

// Función para conectar a la base de datos
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('Conexión exitosa a MongoDB');
  } catch (error) {
    console.error('Error conectando a MongoDB:', error);
    process.exit(1); // Salir con error
  }
};

// Manejo de eventos de conexión
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
  console.error('Error en conexión MongoDB:', err);
});

export default connectDB; 