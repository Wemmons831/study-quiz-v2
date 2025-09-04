const cron = require('node-cron');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

// Get start of current week (Sunday)
const getWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// Get start of previous week
const getPreviousWeekStartDate = (date = new Date()) => {
  const currentWeekStart = getWeekStartDate(date);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  return previousWeekStart;
};

// Calculate weekly leaderboard data
const calculateWeeklyLeaderboardData = async () => {
  console.log('📊 Starting weekly leaderboard calculation...');
  
  try {
    const weekStart = getPreviousWeekStartDate();
    const weekEnd = getWeekStartDate();
    
    console.log(`📅 Calculating for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
    
    // Get all active users
    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'username', 'display_name']
    });
    
    console.log(`👥 Found ${users.length} active users`);
    
    const leaderboardData = [];
    
    for (const user of users) {
      // Calculate questions mastered this week
      const questionsMasteredQuery = `
        SELECT COUNT(*) as questions_mastered
        FROM user_progress 
        WHERE user_id = :userId 
        AND is_mastered = true 
        AND updated_at >= :weekStart 
        AND updated_at < :weekEnd
      `;
      
      const questionsMasteredResult = await sequelize.query(questionsMasteredQuery, {
        replacements: { 
          userId: user.id, 
          weekStart: weekStart.toISOString(), 
          weekEnd: weekEnd.toISOString() 
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Calculate study time this week
      const studyTimeQuery = `
        SELECT COALESCE(SUM(duration_seconds), 0) as study_time_seconds
        FROM study_sessions 
        WHERE user_id = :userId 
        AND start_time >= :weekStart 
        AND start_time < :weekEnd
        AND end_time IS NOT NULL
      `;
      
      const studyTimeResult = await sequelize.query(studyTimeQuery, {
        replacements: { 
          userId: user.id, 
          weekStart: weekStart.toISOString(), 
          weekEnd: weekEnd.toISOString() 
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      const questionsMastered = parseInt(questionsMasteredResult[0]?.questions_mastered || 0);
      const studyTimeSeconds = parseInt(studyTimeResult[0]?.study_time_seconds || 0);
      
      // Only include users with activity
      if (questionsMastered > 0 || studyTimeSeconds > 0) {
        leaderboardData.push({
          user_id: user.id,
          username: user.username,
          display_name: user.display_name,
          week_start_date: weekStart,
          questions_mastered: questionsMastered,
          study_time_seconds: studyTimeSeconds
        });
      }
    }
    
    console.log(`📈 Generated leaderboard data for ${leaderboardData.length} active users`);
    return leaderboardData;
    
  } catch (error) {
    console.error('❌ Error calculating weekly leaderboard data:', error);
    throw error;
  }
};

// Update leaderboard rankings
const updateLeaderboardRankings = async (leaderboardData) => {
  console.log('🏆 Calculating rankings...');
  
  try {
    // Sort by questions mastered (descending)
    const questionRankings = [...leaderboardData].sort((a, b) => b.questions_mastered - a.questions_mastered);
    
    // Sort by study time (descending)  
    const timeRankings = [...leaderboardData].sort((a, b) => b.study_time_seconds - a.study_time_seconds);
    
    // Assign question rankings
    questionRankings.forEach((entry, index) => {
      entry.rank_questions = index + 1;
    });
    
    // Assign time rankings
    timeRankings.forEach((entry, index) => {
      const dataEntry = leaderboardData.find(d => d.user_id === entry.user_id);
      if (dataEntry) {
        dataEntry.rank_time = index + 1;
      }
    });
    
    console.log('✅ Rankings calculated successfully');
    return leaderboardData;
    
  } catch (error) {
    console.error('❌ Error calculating rankings:', error);
    throw error;
  }
};

// Save leaderboard data to database
const saveLeaderboardData = async (leaderboardData) => {
  console.log('💾 Saving leaderboard data to database...');
  
  try {
    const transaction = await sequelize.transaction();
    
    try {
      for (const entry of leaderboardData) {
        await sequelize.query(`
          INSERT INTO weekly_leaderboards (
            user_id, week_start_date, questions_mastered, 
            study_time_seconds, rank_questions, rank_time
          ) VALUES (
            :user_id, :week_start_date, :questions_mastered,
            :study_time_seconds, :rank_questions, :rank_time
          )
          ON CONFLICT (user_id, week_start_date) 
          DO UPDATE SET
            questions_mastered = EXCLUDED.questions_mastered,
            study_time_seconds = EXCLUDED.study_time_seconds,
            rank_questions = EXCLUDED.rank_questions,
            rank_time = EXCLUDED.rank_time,
            updated_at = CURRENT_TIMESTAMP
        `, {
          replacements: {
            user_id: entry.user_id,
            week_start_date: entry.week_start_date,
            questions_mastered: entry.questions_mastered,
            study_time_seconds: entry.study_time_seconds,
            rank_questions: entry.rank_questions,
            rank_time: entry.rank_time
          },
          transaction
        });
      }
      
      await transaction.commit();
      console.log(`✅ Successfully saved ${leaderboardData.length} leaderboard entries`);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error saving leaderboard data:', error);
    throw error;
  }
};

// Main leaderboard reset function
const resetWeeklyLeaderboards = async () => {
  console.log('🔄 Starting weekly leaderboard reset...');
  
  try {
    const startTime = Date.now();
    
    // Calculate leaderboard data
    const leaderboardData = await calculateWeeklyLeaderboardData();
    
    if (leaderboardData.length === 0) {
      console.log('ℹ️ No user activity found for the past week. Skipping leaderboard update.');
      return;
    }
    
    // Calculate rankings
    const rankedData = await updateLeaderboardRankings(leaderboardData);
    
    // Save to database
    await saveLeaderboardData(rankedData);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`🎉 Weekly leaderboard reset completed successfully in ${duration.toFixed(2)}s`);
    console.log(`📊 Top Questions Mastered: ${rankedData[0]?.display_name} (${rankedData[0]?.questions_mastered})`);
    console.log(`⏱️ Top Study Time: ${rankedData.sort((a, b) => b.study_time_seconds - a.study_time_seconds)[0]?.display_name} (${Math.round(rankedData[0]?.study_time_seconds / 60)} min)`);
    
  } catch (error) {
    console.error('❌ Weekly leaderboard reset failed:', error);
    
    // You could add error notification here (email, Slack, etc.)
    // notifyAdminsOfError('Leaderboard Reset Failed', error);
  }
};

// Start the leaderboard scheduler
const startLeaderboardScheduler = () => {
  const resetDay = process.env.LEADERBOARD_RESET_DAY || '0'; // 0 = Sunday
  const resetHour = process.env.LEADERBOARD_RESET_HOUR || '0'; // 0 = Midnight
  
  // Cron expression: "minute hour day-of-month month day-of-week"
  // This runs every Sunday at midnight (or configured day/hour)
  const cronExpression = `0 ${resetHour} * * ${resetDay}`;
  
  console.log(`📅 Scheduling weekly leaderboard reset: ${cronExpression}`);
  console.log(`⏰ Next reset: Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][resetDay]} at ${resetHour}:00`);
  
  // Schedule the job
  cron.schedule(cronExpression, async () => {
    console.log('⏰ Weekly leaderboard reset triggered by scheduler');
    await resetWeeklyLeaderboards();
  }, {
    timezone: 'UTC' // Use UTC to avoid timezone issues
  });
  
  console.log('✅ Leaderboard scheduler started successfully');
  
  // Optional: Run once on startup in development for testing
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Running initial leaderboard calculation...');
    setTimeout(async () => {
      await resetWeeklyLeaderboards();
    }, 5000); // Wait 5 seconds for database to be ready
  }
};

// Manual trigger function (useful for testing or admin actions)
const triggerLeaderboardReset = async () => {
  console.log('🔧 Manual leaderboard reset triggered');
  await resetWeeklyLeaderboards();
};

// Get current leaderboard data
const getCurrentLeaderboards = async (limit = 10) => {
  try {
    const currentWeek = getWeekStartDate();
    const previousWeek = getPreviousWeekStartDate();
    
    const questionsLeaderboard = await sequelize.query(`
      SELECT 
        wl.*, 
        u.username, 
        u.display_name,
        u.profile_picture_url
      FROM weekly_leaderboards wl
      JOIN users u ON wl.user_id = u.id
      WHERE wl.week_start_date = :weekStart
      ORDER BY wl.rank_questions ASC
      LIMIT :limit
    `, {
      replacements: { weekStart: previousWeek, limit },
      type: sequelize.QueryTypes.SELECT
    });
    
    const timeLeaderboard = await sequelize.query(`
      SELECT 
        wl.*, 
        u.username, 
        u.display_name,
        u.profile_picture_url
      FROM weekly_leaderboards wl
      JOIN users u ON wl.user_id = u.id
      WHERE wl.week_start_date = :weekStart
      ORDER BY wl.rank_time ASC
      LIMIT :limit
    `, {
      replacements: { weekStart: previousWeek, limit },
      type: sequelize.QueryTypes.SELECT
    });
    
    return {
      questionsLeaderboard,
      timeLeaderboard,
      weekStart: previousWeek,
      weekEnd: currentWeek
    };
    
  } catch (error) {
    console.error('❌ Error fetching current leaderboards:', error);
    throw error;
  }
};

module.exports = {
  startLeaderboardScheduler,
  triggerLeaderboardReset,
  getCurrentLeaderboards,
  resetWeeklyLeaderboards
};