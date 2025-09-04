const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { filterUploadedFiles } = require('../middleware/contentFilter');
const { 
  getUserProfile,
  updateUserProfile, 
  changePassword,
  uploadProfilePicture,
  getUserStats,
  deleteUserAccount,
  getUserById
} = require('../controllers/userController');
const { profileUpdateSchema, changePasswordSchema } = require('../middleware/validation');

// Configure multer for profile picture uploads
const upload = multer({
  dest: 'uploads/profiles/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and GIF images are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// Get current user's profile (same as /auth/me but here for consistency)
router.get('/profile', getUserProfile);

// Update user profile
router.put('/profile', 
  validateRequest(profileUpdateSchema),
  updateUserProfile
);

// Change password
router.put('/password', 
  validateRequest(changePasswordSchema),
  changePassword
);

// Upload profile picture
router.post('/profile-picture', 
  upload.single('profilePicture'),
  filterUploadedFiles,
  uploadProfilePicture
);

// Get user statistics
router.get('/stats', getUserStats);

// Get public user profile by ID
router.get('/:id', getUserById);

// Delete user account (careful - this is destructive!)
router.delete('/account', deleteUserAccount);

module.exports = router;