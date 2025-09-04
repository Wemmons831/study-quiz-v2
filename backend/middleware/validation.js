const Joi = require('joi');

// User registration validation schema
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be no more than 50 characters long',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      'any.required': 'Username is required'
    }),
  
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
  
  display_name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Display name cannot be empty',
      'string.max': 'Display name must be no more than 100 characters long',
      'any.required': 'Display name is required'
    })
});

// User login validation schema
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// Study set validation schema
const studySetSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title must be no more than 200 characters long',
      'any.required': 'Title is required'
    }),
  
  description: Joi.string()
    .allow('')
    .max(2000)
    .optional()
    .messages({
      'string.max': 'Description must be no more than 2000 characters long'
    }),
  
  is_public: Joi.boolean()
    .default(false),
  
  tags: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .default([])
    .messages({
      'array.max': 'Cannot have more than 10 tags',
      'string.max': 'Each tag must be no more than 50 characters long'
    }),
  
  questions: Joi.array()
    .items(
      Joi.object({
        question_text: Joi.string()
          .min(1)
          .max(2000)
          .required()
          .messages({
            'string.min': 'Question text cannot be empty',
            'string.max': 'Question text must be no more than 2000 characters long',
            'any.required': 'Question text is required'
          }),
        
        correct_answer: Joi.string()
          .min(1)
          .max(500)
          .required()
          .messages({
            'string.min': 'Correct answer cannot be empty',
            'string.max': 'Correct answer must be no more than 500 characters long',
            'any.required': 'Correct answer is required'
          }),
        
        wrong_answers: Joi.array()
          .items(Joi.string().min(1).max(500))
          .length(3)
          .required()
          .messages({
            'array.length': 'Must provide exactly 3 wrong answers',
            'string.min': 'Wrong answers cannot be empty',
            'string.max': 'Wrong answers must be no more than 500 characters long',
            'any.required': 'Wrong answers are required'
          })
      })
    )
    .optional()
});

// Question validation schema
const questionSchema = Joi.object({
  question_text: Joi.string()
    .min(1)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Question text cannot be empty',
      'string.max': 'Question text must be no more than 2000 characters long',
      'any.required': 'Question text is required'
    }),
  
  correct_answer: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.min': 'Correct answer cannot be empty',
      'string.max': 'Correct answer must be no more than 500 characters long',
      'any.required': 'Correct answer is required'
    }),
  
  wrong_answers: Joi.array()
    .items(Joi.string().min(1).max(500))
    .length(3)
    .required()
    .messages({
      'array.length': 'Must provide exactly 3 wrong answers',
      'string.min': 'Wrong answers cannot be empty',
      'string.max': 'Wrong answers must be no more than 500 characters long',
      'any.required': 'Wrong answers are required'
    })
});

// Progress update validation schema
const progressUpdateSchema = Joi.object({
  isCorrect: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Answer correctness is required'
    }),
  
  timesSeen: Joi.boolean()
    .optional()
});

// Password change validation schema
const changePasswordSchema = Joi.object({
  current_password: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  
  new_password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'New password must be at least 6 characters long',
      'any.required': 'New password is required'
    })
});

// Profile update validation schema
const profileUpdateSchema = Joi.object({
  display_name: Joi.string()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Display name cannot be empty',
      'string.max': 'Display name must be no more than 100 characters long'
    }),
  
  username: Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must be no more than 50 characters long',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
    })
});

// Validation helper functions
const validateRegisterData = (data) => {
  return registerSchema.validate(data, { abortEarly: false });
};

const validateLoginData = (data) => {
  return loginSchema.validate(data, { abortEarly: false });
};

const validateStudySetData = (data) => {
  return studySetSchema.validate(data, { abortEarly: false });
};

const validateQuestionData = (data) => {
  return questionSchema.validate(data, { abortEarly: false });
};

const validateProgressUpdate = (data) => {
  return progressUpdateSchema.validate(data, { abortEarly: false });
};

const validatePasswordChange = (data) => {
  return changePasswordSchema.validate(data, { abortEarly: false });
};

const validateProfileUpdate = (data) => {
  return profileUpdateSchema.validate(data, { abortEarly: false });
};

// Middleware for request validation
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
};

module.exports = {
  // Schemas
  registerSchema,
  loginSchema,
  studySetSchema,
  questionSchema,
  progressUpdateSchema,
  changePasswordSchema,
  profileUpdateSchema,
  
  // Validation functions
  validateRegisterData,
  validateLoginData,
  validateStudySetData,
  validateQuestionData,
  validateProgressUpdate,
  validatePasswordChange,
  validateProfileUpdate,
  
  // Middleware
  validateRequest
};