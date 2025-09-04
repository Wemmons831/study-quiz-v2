const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { 
  getAllStudySets,
  getStudySetById,
  createStudySet,
  updateStudySet,
  deleteStudySet,
  forkStudySet,
  uploadCSV,
  exportCSV,
  getStudySetProgress,
  updateQuestionProgress
} = require('../controllers/studySetController');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/csv/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// CRUD operations
router.get('/', getAllStudySets);
router.get('/:id', getStudySetById);
router.post('/', createStudySet);
router.put('/:id', updateStudySet);
router.delete('/:id', deleteStudySet);

// CSV operations
router.post('/upload-csv', upload.single('csvFile'), uploadCSV);
router.get('/:id/export-csv', exportCSV);

// Fork operation
router.post('/:id/fork', forkStudySet);

// Progress tracking
router.get('/:id/progress', getStudySetProgress);
router.put('/:id/progress/:questionId', updateQuestionProgress);

module.exports = router;