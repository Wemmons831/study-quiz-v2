const { sequelize } = require('../config/database');
const User = require('../models/User');
const { 
  getCurrentLeaderboards, 
  triggerLeaderboardReset 
} = require('../utils/leaderboardScheduler');

// Get questions mastered leaderboard
const getQuestionsLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 100); // Max 100 entries

    const leaderboards = await getCurrentLeaderboards(parsedLimit);
    
    res.json({
      leaderboard: leaderboards.questionsLeaderboard,
      weekStart: leaderboards.weekStart,
      weekEnd: leaderboards.weekEnd,
      type: 'questions_mastered'
    });

  } catch (error) {
    console.error('Get questions leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to get questions leaderboard'
    });
  }
};

// Get study time leaderboard
const getTimeLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 100); // Max 100 entries

    const leaderboards = await getCurrentLeaderboards(parsedLimit);
    
    res.json({
      leaderboard: leaderboards.timeLeaderboard,
      weekStart: leaderboards.weekStart,
      weekEnd: leaderboards.weekEnd,
      type: 'study_time'
    });

  } catch (error) {
    console.error('Get time leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to get time leaderboard'
    });
  }
};

// Get current user's leaderboard rank
const getUserLeaderboardRank = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current week dates
    const getWeekStartDate = (date = new Date()) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day;
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    };
    
    const getPreviousWeekStartDate = (date = new Date()) => {
      const currentWeekStart = getWeekStartDate(date);
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      return previousWeekStart;
    };
    
    const weekStart = getPreviousWeekStartDate();
    
    // Get user's rank for questions mastered
    const userQuestionRank = await sequelize.query(`
      SELECT 
        rank_questions as rank,
        questions_mastered,
        (SELECT COUNT(*) FROM weekly_leaderboards WHERE week_start_date = :weekStart) as total_participants
      FROM weekly_leaderboards 
      WHERE user_id = :userId 
      AND week_start_date = :weekStart
    `, {
      replacements: { userId, weekStart },
      type: sequelize.QueryTypes.SELECT
    });

    // Get user's rank for study time
    const userTimeRank = await sequelize.query(`
      SELECT 
        rank_time as rank,
        study_time_seconds,
        (SELECT COUNT(*) FROM weekly_leaderboards WHERE week_start_date = :weekStart) as total_participants
      FROM weekly_leaderboards 
      WHERE user_id = :userId 
      AND week_start_date = :weekStart
    `, {
      replacements: { userId, weekStart },
      type: sequelize.QueryTypes.SELECT
    });

    // Calculate current week progress (not yet on leaderboard)
    const currentWeekStart = getWeekStartDate();
    const currentWeekEnd = new Date();
    
    const currentWeekProgress = await sequelize.query(`
      SELECT 
        COALESCE(COUNT(CASE WHEN up.is_mastered = true AND up.updated_at >= :currentWeekStart THEN 1 END), 0) as questions_mastered_this_week,
        COALESCE(SUM(CASE WHEN ss.start_time >= :currentWeekStart THEN ss.duration_seconds ELSE 0 END), 0) as study_time_this_week
      FROM users u
      LEFT JOIN user_progress up ON u.id = up.user_id
      LEFT JOIN study_sessions ss ON u.id = ss.user_id AND ss.end_time IS NOT NULL
      WHERE u.id = :userId
      GROUP BY u.id
    `, {
      replacements: { 
        userId, 
        currentWeekStart: currentWeekStart.toISOString() 
      },
      type: sequelize.QueryTypes.SELECT
    });

    const userRankData = {
      questionsRank: userQuestionRank[0] ? {
        rank: userQuestionRank[0].rank,
        questions_mastered: userQuestionRank[0].questions_mastered,
        total_participants: userQuestionRank[0].total_participants
      } : null,
      
      timeRank: userTimeRank[0] ? {
        rank: userTimeRank[0].rank,
        study_time_seconds: userTimeRank[0].study_time_seconds,
        study_time_minutes: Math.round(userTimeRank[0].study_time_seconds / 60),
        total_participants: userTimeRank[0].total_participants
      } : null,
      
      currentWeekProgress: {
        questions_mastered: parseInt(currentWeekProgress[0]?.questions_mastered_this_week || 0),
        study_time_seconds: parseInt(currentWeekProgress[0]?.study_time_this_week || 0),
        study_time_minutes: Math.round(parseInt(currentWeekProgress[0]?.study_time_this_week || 0) / 60)
      },
      
      weekStart,
      weekEnd: currentWeekStart
    };

    res.json(userRankData);

  } catch (error) {
    console.error('Get user leaderboard rank error:', error);
    res.status(500).json({
      error: 'Failed to get user leaderboard rank'
    });
  }
};

// Manual trigger for leaderboard reset (for testing/admin)
const triggerManualReset = async (req, res) => {
  try {
    console.log(`Manual leaderboard reset triggered by user: ${req.user.username}`);
    
    // You might want to add admin check here in production
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }
    
    await triggerLeaderboardReset();
    
    res.json({
      message: 'Leaderboard reset completed successfully',
      triggeredBy: req.user.username,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual leaderboard reset error:', error);
    res.status(500).json({
      error: 'Failed to reset leaderboard'
    });
  }
};

// Get leaderboard statistics
const getLeaderboardStats = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get both leaderboards
    const leaderboards = await getCurrentLeaderboards(limit);
    
    // Calculate some interesting stats
    const totalParticipants = Math.max(
      leaderboards.questionsLeaderboard.length,
      leaderboards.timeLeaderboard.length
    );
    
    const topQuestionsMastered = leaderboards.questionsLeaderboard[0]?.questions_mastered || 0;
    const topStudyTime = leaderboards.timeLeaderboard[0]?.study_time_seconds || 0;
    
    const averageQuestionsMastered = leaderboards.questionsLeaderboard.length > 0
      ? Math.round(
          leaderboards.questionsLeaderboard.reduce((sum, entry) => sum + entry.questions_mastered, 0) / 
          leaderboards.questionsLeaderboard.length
        )
      : 0;
    
    const averageStudyTime = leaderboards.timeLeaderboard.length > 0
      ? Math.round(
          leaderboards.timeLeaderboard.reduce((sum, entry) => sum + entry.study_time_seconds, 0) / 
          leaderboards.timeLeaderboard.length
        )
      : 0;

    res.json({
      stats: {
        totalParticipants,
        topQuestionsMastered,
        topStudyTimeSeconds: topStudyTime,
        topStudyTimeMinutes: Math.round(topStudyTime / 60),
        averageQuestionsMastered,
        averageStudyTimeSeconds: averageStudyTime,
        averageStudyTimeMinutes: Math.round(averageStudyTime / 60)
      },
      weekStart: leaderboards.weekStart,
      weekEnd: leaderboards.weekEnd
    });

  } catch (error) {
    console.error('Get leaderboard stats error:', error);
    res.status(500).json({
      error: 'Failed to get leaderboard statistics'
    });
  }
};

module.exports = {
  getQuestionsLeaderboard,
  getTimeLeaderboard,
  getUserLeaderboardRank,
  triggerManualReset,
  getLeaderboardStats
};