import { body, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Validación para envío de mensaje de texto
export const validateTextMessage = [
  body('to')
    .trim()
    .notEmpty().withMessage('El número de teléfono es obligatorio')
    .matches(/^[0-9+\s()-]+$/).withMessage('El número de teléfono debe tener un formato válido'),
  
  body('text')
    .trim()
    .notEmpty().withMessage('El texto del mensaje es obligatorio')
    .isLength({ max: 4096 }).withMessage('El texto no puede exceder los 4096 caracteres'),
  
  body('contactName')
    .optional()
    .trim(),
  
  body('local')
    .optional()
    .custom((value) => {
      if (!value) return true;
      
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de local no válido');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validación para envío de mensaje con plantilla
export const validateTemplateMessage = [
  body('to')
    .trim()
    .notEmpty().withMessage('El número de teléfono es obligatorio')
    .matches(/^[0-9+\s()-]+$/).withMessage('El número de teléfono debe tener un formato válido'),
  
  body('templateName')
    .trim()
    .notEmpty().withMessage('El nombre de la plantilla es obligatorio'),
  
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 }).withMessage('El idioma debe tener entre 2 y 5 caracteres'),
  
  body('parameters')
    .optional()
    .isObject().withMessage('Los parámetros deben ser un objeto válido'),
  
  body('contactName')
    .optional()
    .trim(),
  
  body('local')
    .optional()
    .custom((value) => {
      if (!value) return true;
      
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de local no válido');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validación para envío de mensaje con imagen
export const validateImageMessage = [
  body('to')
    .trim()
    .notEmpty().withMessage('El número de teléfono es obligatorio')
    .matches(/^[0-9+\s()-]+$/).withMessage('El número de teléfono debe tener un formato válido'),
  
  body('imageUrl')
    .trim()
    .notEmpty().withMessage('La URL de la imagen es obligatoria')
    .isURL().withMessage('La URL de la imagen debe ser válida'),
  
  body('caption')
    .optional()
    .trim()
    .isLength({ max: 1024 }).withMessage('La descripción no puede exceder los 1024 caracteres'),
  
  body('contactName')
    .optional()
    .trim(),
  
  body('local')
    .optional()
    .custom((value) => {
      if (!value) return true;
      
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de local no válido');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validación para creación de plantilla
export const validateCreateTemplate = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre de la plantilla es obligatorio')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El nombre solo puede contener letras, números y guion bajo'),
  
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 }).withMessage('El idioma debe tener entre 2 y 5 caracteres'),
  
  body('category')
    .notEmpty().withMessage('La categoría es obligatoria')
    .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'ACCOUNT_UPDATE', 'PAYMENT_UPDATE'])
    .withMessage('Categoría no válida'),
  
  body('components')
    .isArray({ min: 1 }).withMessage('Debe incluir al menos un componente'),
  
  body('components.*.type')
    .notEmpty().withMessage('El tipo de componente es obligatorio')
    .isIn(['HEADER', 'BODY', 'FOOTER', 'BUTTONS'])
    .withMessage('Tipo de componente no válido'),
  
  body('local')
    .optional()
    .custom((value) => {
      if (!value) return true;
      
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de local no válido');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Validación para actualización de plantilla
export const validateUpdateTemplate = [
  param('templateId')
    .isMongoId().withMessage('ID de plantilla no válido'),
  
  body('name')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El nombre solo puede contener letras, números y guion bajo'),
  
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 }).withMessage('El idioma debe tener entre 2 y 5 caracteres'),
  
  body('category')
    .optional()
    .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION', 'ACCOUNT_UPDATE', 'PAYMENT_UPDATE'])
    .withMessage('Categoría no válida'),
  
  body('components')
    .optional()
    .isArray({ min: 1 }).withMessage('Debe incluir al menos un componente'),
  
  body('local')
    .optional()
    .custom((value) => {
      if (!value) return true;
      
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de local no válido');
      }
      return true;
    }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
]; 