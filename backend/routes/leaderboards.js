const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  getQuestionsLeaderboard,
  getTimeLeaderboard,
  getUserLeaderboardRank,
  triggerManualReset
} = require('../controllers/leaderboardController');

// Get questions mastered leaderboard
router.get('/questions', optionalAuth, getQuestionsLeaderboard);

// Get study time leaderboard
router.get('/time', optionalAuth, getTimeLeaderboard);

// Get current user's rank (requires authentication)
router.get('/me', authenticateToken, getUserLeaderboardRank);

// Manual trigger for leaderboard reset (admin/testing only)
router.post('/reset', authenticateToken, triggerManualReset);

module.exports = router;