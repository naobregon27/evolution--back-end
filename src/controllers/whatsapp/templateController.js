import Template from '../../models/whatsapp/Template.js';
import infobipService from '../../services/whatsapp/infobipService.js';
import logger from '../../config/logger.js';

// Obtener todas las plantillas
export const getAllTemplates = async (req, res) => {
  try {
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtros
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status.toUpperCase();
    }
    
    if (req.query.category) {
      filters.category = req.query.category.toUpperCase();
    }
    
    if (req.query.search) {
      filters.name = { $regex: req.query.search, $options: 'i' };
    }
    
    // Si es admin, solo puede ver plantillas de su local
    if (req.userRole === 'admin' && req.user.local) {
      filters.local = req.user.local;
    }
    
    // Ejecutar consulta
    const templates = await Template.find(filters)
      .populate('local', 'nombre')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Contar total
    const total = await Template.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        templates,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Error obteniendo plantillas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las plantillas',
      error: error.message
    });
  }
};

// Obtener una plantilla por ID
export const getTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = await Template.findById(templateId).populate('local', 'nombre');
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Plantilla no encontrada'
      });
    }
    
    // Si es admin, verificar que la plantilla sea de su local
    if (req.userRole === 'admin' && 
        req.user.local &&
        template.local &&
        req.user.local.toString() !== template.local.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta plantilla'
      });
    }
    
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error obteniendo plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la plantilla',
      error: error.message
    });
  }
};

// Crear una nueva plantilla
export const createTemplate = async (req, res) => {
  try {
    const { 
      name, 
      language, 
      category, 
      components, 
      local 
    } = req.body;
    
    // Validar datos requeridos
    if (!name || !category || !components) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, categoría y componentes son obligatorios'
      });
    }
    
    // Verificar si ya existe una plantilla con ese nombre
    const existingTemplate = await Template.findOne({ 
      name,
      language: language || 'es'
    });
    
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una plantilla con ese nombre e idioma'
      });
    }
    
    // Preparar asignación de local según el rol
    let assignedLocal = local;
    
    if (req.userRole === 'admin' && req.user.local) {
      // Admin solo puede crear plantillas para su local
      assignedLocal = req.user.local;
    }
    
    // Crear la plantilla en la base de datos
    const template = await Template.create({
      name,
      language: language || 'es',
      category,
      components,
      local: assignedLocal,
      status: 'PENDING', // Por defecto está pendiente de aprobación
      timesUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.status(201).json({
      success: true,
      message: 'Plantilla creada exitosamente',
      data: template
    });
  } catch (error) {
    logger.error(`Error creando plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al crear la plantilla',
      error: error.message
    });
  }
};

// Actualizar una plantilla existente
export const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;
    
    // Verificar si la plantilla existe
    const template = await Template.findById(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Plantilla no encontrada'
      });
    }
    
    // Si es admin, verificar que la plantilla sea de su local
    if (req.userRole === 'admin' && 
        req.user.local &&
        template.local &&
        req.user.local.toString() !== template.local.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta plantilla'
      });
    }
    
    // No permitir cambiar el nombre si ya está aprobada
    if (template.status === 'APPROVED' && updateData.name && updateData.name !== template.name) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cambiar el nombre de una plantilla aprobada'
      });
    }
    
    // Si se modifica contenido, volver a estado pendiente
    if (updateData.components || updateData.category) {
      updateData.status = 'PENDING';
    }
    
    // Actualizar fecha de modificación
    updateData.updatedAt = new Date();
    
    // Actualizar plantilla
    const updatedTemplate = await Template.findByIdAndUpdate(
      templateId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Plantilla actualizada exitosamente',
      data: updatedTemplate
    });
  } catch (error) {
    logger.error(`Error actualizando plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la plantilla',
      error: error.message
    });
  }
};

// Eliminar una plantilla
export const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Verificar si la plantilla existe
    const template = await Template.findById(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Plantilla no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.userRole === 'admin') {
      // Admin solo puede eliminar plantillas de su local que no estén aprobadas
      if (template.status === 'APPROVED') {
        return res.status(403).json({
          success: false,
          message: 'No se pueden eliminar plantillas aprobadas'
        });
      }
      
      if (!req.user.local || template.local.toString() !== req.user.local.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para eliminar esta plantilla'
        });
      }
    } else if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para eliminar plantillas'
      });
    }
    
    // Eliminar plantilla
    await Template.findByIdAndDelete(templateId);
    
    res.status(200).json({
      success: true,
      message: 'Plantilla eliminada exitosamente'
    });
  } catch (error) {
    logger.error(`Error eliminando plantilla: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la plantilla',
      error: error.message
    });
  }
};

// Sincronizar plantillas con el proveedor (Infobip)
export const syncTemplates = async (req, res) => {
  try {
    // Solo superAdmin puede sincronizar plantillas
    if (req.userRole !== 'superAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Solo el superAdmin puede sincronizar plantillas'
      });
    }
    
    // Obtener plantillas desde Infobip
    const result = await infobipService.getTemplates();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener plantillas desde el proveedor',
        error: result.error
      });
    }
    
    const providerTemplates = result.templates || [];
    let updated = 0;
    let created = 0;
    
    // Procesar cada plantilla del proveedor
    for (const providerTemplate of providerTemplates) {
      // Buscar si la plantilla ya existe en nuestra base de datos
      const existingTemplate = await Template.findOne({
        name: providerTemplate.name,
        language: providerTemplate.language?.code || 'es'
      });
      
      if (existingTemplate) {
        // Actualizar plantilla existente
        existingTemplate.status = 'APPROVED';
        existingTemplate.providerTemplateId = providerTemplate.id;
        existingTemplate.providerData = providerTemplate;
        
        if (providerTemplate.status === 'REJECTED') {
          existingTemplate.status = 'REJECTED';
          existingTemplate.rejectionReason = providerTemplate.rejectionReason || 'Rechazada por el proveedor';
        }
        
        await existingTemplate.save();
        updated++;
      } else {
        // Crear nueva plantilla con datos del proveedor
        await Template.create({
          name: providerTemplate.name,
          language: providerTemplate.language?.code || 'es',
          category: providerTemplate.category || 'UTILITY',
          components: providerTemplate.structure || [],
          status: providerTemplate.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          rejectionReason: providerTemplate.rejectionReason,
          providerTemplateId: providerTemplate.id,
          providerData: providerTemplate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        created++;
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Plantillas sincronizadas exitosamente',
      data: {
        total: providerTemplates.length,
        updated,
        created
      }
    });
  } catch (error) {
    logger.error(`Error sincronizando plantillas: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error al sincronizar plantillas',
      error: error.message
    });
  }
}; 