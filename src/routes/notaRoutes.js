import { Router } from 'express';
import { 
  getNotas, 
  getNotaById, 
  createNota, 
  updateNota, 
  deleteNota, 
  compartirNota,
  dejarDeCompartir,
  getVersiones,
  toggleFavorita
} from '../controllers/notaController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import Nota from '../models/Nota.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * @route GET /api/notas
 * @desc Obtener todas las notas
 * @access Privado
 */
router.get('/', verifyToken, getNotas);

/**
 * @route GET /api/notas/:id
 * @desc Obtener una nota por ID
 * @access Privado
 */
router.get('/:id', verifyToken, getNotaById);

/**
 * @route POST /api/notas
 * @desc Crear una nueva nota
 * @access Privado
 */
router.post('/', verifyToken, createNota);

/**
 * @route PUT /api/notas/:id
 * @desc Actualizar una nota existente
 * @access Privado
 */
router.put('/:id', verifyToken, updateNota);

/**
 * @route DELETE /api/notas/:id
 * @desc Eliminar una nota
 * @access Privado
 */
router.delete('/:id', verifyToken, deleteNota);

/**
 * @route POST /api/notas/:id/compartir
 * @desc Compartir una nota con otros usuarios
 * @access Privado
 */
router.post('/:id/compartir', verifyToken, compartirNota);

/**
 * @route DELETE /api/notas/:id/compartir/:usuarioId
 * @desc Dejar de compartir una nota con un usuario
 * @access Privado
 */
router.delete('/:id/compartir/:usuarioId', verifyToken, dejarDeCompartir);

/**
 * @route GET /api/notas/:id/versiones
 * @desc Obtener historial de versiones de una nota
 * @access Privado
 */
router.get('/:id/versiones', verifyToken, getVersiones);

/**
 * @route PUT /api/notas/:id/favorita
 * @desc Marcar/desmarcar una nota como favorita
 * @access Privado
 */
router.put('/:id/favorita', verifyToken, toggleFavorita);

/**
 * @route POST /api/notas/:id/limpiar
 * @desc Limpia entradas nulas en compartidaCon
 * @access Privado
 */
router.post('/:id/limpiar', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const nota = await Nota.findById(id);
    
    if (!nota) {
      return res.status(404).json({
        success: false,
        message: 'Nota no encontrada'
      });
    }
    
    // Comprobar que es el creador
    if (nota.creadoPor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta nota'
      });
    }
    
    // Filtrar compartidaCon para eliminar entradas con usuario null
    const compartidosOriginales = nota.compartidaCon.length;
    nota.compartidaCon = nota.compartidaCon.filter(c => c.usuario !== null);
    const compartidosFiltrados = nota.compartidaCon.length;
    
    await nota.save();
    
    res.json({
      success: true,
      message: `Nota limpiada exitosamente. Se eliminaron ${compartidosOriginales - compartidosFiltrados} entradas nulas.`,
      data: nota
    });
  } catch (error) {
    logger.error(`Error al limpiar nota: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar nota',
      error: error.message
    });
  }
});

export default router; 