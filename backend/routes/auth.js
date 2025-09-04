const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  changePassword 
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/password', authenticateToken, changePassword);

module.exports = router;