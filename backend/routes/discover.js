const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { 
  getPopularStudySets,
  getRecentStudySets,
  searchStudySets,
  getStudySetsByTag,
  getAvailableTags,
  getDiscoverStats
} = require('../controllers/discoverController');

// Get popular public study sets
router.get('/popular', optionalAuth, getPopularStudySets);

// Get recently created public study sets
router.get('/recent', optionalAuth, getRecentStudySets);

// Search public study sets
router.get('/search', optionalAuth, searchStudySets);

// Get all available tags
router.get('/tags', getAvailableTags);

// Get study sets by tag
router.get('/tag/:tag', optionalAuth, getStudySetsByTag);

// Get discovery statistics
router.get('/stats', getDiscoverStats);

module.exports = router;