import { body, param, validationResult } from 'express-validator';

// Validación para registro de usuario
export const validateRegister = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial'),
  
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

// Validación para login
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('La contraseña es obligatoria'),
  
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

// Validación para cambio de contraseña
export const validateChangePassword = [
  body('currentPassword')
    .trim()
    .notEmpty().withMessage('La contraseña actual es obligatoria'),
  
  body('newPassword')
    .trim()
    .notEmpty().withMessage('La nueva contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }
      return true;
    }),
  
  body('confirmPassword')
    .trim()
    .notEmpty().withMessage('La confirmación de contraseña es obligatoria')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
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

// Validación para solicitud de reseteo de contraseña
export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Debe ser un email válido'),
  
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

// Validación para creación de usuario por admin
export const validateCreateUser = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial'),
  
  body('role')
    .optional()
    .isIn(['usuario', 'admin', 'superAdmin']).withMessage('Rol no válido'),
  
  body('telefono')
    .optional()
    .trim(),
  
  body('direccion')
    .optional()
    .trim(),
  
  body('organizacion')
    .optional()
    .trim(),
  
  body('local')
    .optional()
    .isMongoId().withMessage('ID de local no válido'),
  
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

// Validación para actualización de usuario
export const validateUpdateUser = [
  param('userId')
    .isMongoId().withMessage('ID de usuario no válido'),
  
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('role')
    .optional()
    .isIn(['usuario', 'admin', 'superAdmin']).withMessage('Rol no válido'),
  
  body('telefono')
    .optional()
    .trim(),
  
  body('direccion')
    .optional()
    .trim(),
  
  body('organizacion')
    .optional()
    .trim(),
  
  body('local')
    .optional()
    .isMongoId().withMessage('ID de local no válido'),
  
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

// Validación para reseteo de contraseña por admin
export const validateUserPassword = [
  param('userId')
    .isMongoId().withMessage('ID de usuario no válido'),
  
  body('newPassword')
    .trim()
    .notEmpty().withMessage('La nueva contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial'),
  
  body('confirmPassword')
    .trim()
    .notEmpty().withMessage('La confirmación de contraseña es obligatoria')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
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

// Validación para activar/desactivar usuario
export const validateToggleStatus = [
  param('userId')
    .isMongoId().withMessage('ID de usuario no válido'),
  
  body('activo')
    .isBoolean().withMessage('El valor debe ser true o false'),
  
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

// Validación para inicialización de superAdmin
export const validateInitSuperAdmin = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('El email es obligatorio')
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula, una minúscula, un número y un carácter especial'),
  
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

// Validación para creación de local
export const validateCreateLocal = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre del local/marca es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('direccion')
    .trim()
    .notEmpty().withMessage('La dirección es obligatoria'),
  
  body('telefono')
    .optional()
    .trim(),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('horario')
    .optional()
    .isObject().withMessage('El horario debe ser un objeto válido'),
  
  body('horario.apertura')
    .optional()
    .isString().withMessage('La hora de apertura debe ser una cadena de texto'),
  
  body('horario.cierre')
    .optional()
    .isString().withMessage('La hora de cierre debe ser una cadena de texto'),
  
  body('horario.diasOperacion')
    .optional()
    .isArray().withMessage('Los días de operación deben ser un array'),
  
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

// Validación para actualización de local
export const validateUpdateLocal = [
  param('localId')
    .isMongoId().withMessage('ID de local no válido'),
  
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('direccion')
    .optional()
    .trim(),
  
  body('telefono')
    .optional()
    .trim(),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe ser un email válido'),
  
  body('horario')
    .optional()
    .isObject().withMessage('El horario debe ser un objeto válido'),
  
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

// Validación para asignar administrador a un local
export const validateAssignAdmin = [
  param('localId')
    .isMongoId().withMessage('ID de local no válido'),
  
  body('userId')
    .notEmpty().withMessage('El ID de usuario es obligatorio')
    .isMongoId().withMessage('ID de usuario no válido'),
  
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