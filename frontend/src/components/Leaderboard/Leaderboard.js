import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../services/api';
import './Leaderboard.css';

const Leaderboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('questions');
  const [questionsLeaderboard, setQuestionsLeaderboard] = useState([]);
  const [timeLeaderboard, setTimeLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [weekInfo, setWeekInfo] = useState({});

  useEffect(() => {
    loadLeaderboards();
    if (user) {
      loadUserRank();
    }
  }, [user]);

  const loadLeaderboards = async () => {
    setIsLoading(true);
    try {
      const [questionsResponse, timeResponse] = await Promise.all([
        apiCall('/leaderboards/questions?limit=20'),
        apiCall('/leaderboards/time?limit=20')
      ]);

      setQuestionsLeaderboard(questionsResponse.leaderboard || []);
      setTimeLeaderboard(timeResponse.leaderboard || []);
      
      // Set week info from either response
      setWeekInfo({
        weekStart: questionsResponse.weekStart || timeResponse.weekStart,
        weekEnd: questionsResponse.weekEnd || timeResponse.weekEnd
      });
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRank = async () => {
    try {
      const response = await apiCall('/leaderboards/me');
      setUserRank(response);
    } catch (error) {
      console.error('Error loading user rank:', error);
    }
  };

  const formatStudyTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatWeekRange = () => {
    if (!weekInfo.weekStart || !weekInfo.weekEnd) return '';
    
    const start = new Date(weekInfo.weekStart);
    const end = new Date(weekInfo.weekEnd);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const currentLeaderboard = activeTab === 'questions' ? questionsLeaderboard : timeLeaderboard;

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h1>Weekly Leaderboard</h1>
          <p className="week-range">
            {formatWeekRange() && `Week of ${formatWeekRange()}`}
          </p>
          <p className="leaderboard-description">
            Compete with other students and climb the weekly rankings!
          </p>
        </div>

        <div className="leaderboard-tabs">
          <button
            className={`tab ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            📚 Questions Mastered
          </button>
          <button
            className={`tab ${activeTab === 'time' ? 'active' : ''}`}
            onClick={() => setActiveTab('time')}
          >
            ⏱️ Study Time
          </button>
        </div>

        {user && userRank && (
          <div className="user-rank-card">
            <h3>Your Ranking</h3>
            <div className="user-rank-content">
              <div className="rank-section">
                <h4>Questions Mastered</h4>
                {userRank.questionsRank ? (
                  <div className="rank-info">
                    <span className="rank-position">
                      {getRankIcon(userRank.questionsRank.rank)} 
                      out of {userRank.questionsRank.total_participants}
                    </span>
                    <span className="rank-value">
                      {userRank.questionsRank.questions_mastered} questions
                    </span>
                  </div>
                ) : (
                  <span className="no-rank">No ranking yet</span>
                )}
              </div>
              
              <div className="rank-section">
                <h4>Study Time</h4>
                {userRank.timeRank ? (
                  <div className="rank-info">
                    <span className="rank-position">
                      {getRankIcon(userRank.timeRank.rank)} 
                      out of {userRank.timeRank.total_participants}
                    </span>
                    <span className="rank-value">
                      {formatStudyTime(userRank.timeRank.study_time_seconds)}
                    </span>
                  </div>
                ) : (
                  <span className="no-rank">No ranking yet</span>
                )}
              </div>
              
              <div className="rank-section">
                <h4>This Week Progress</h4>
                <div className="current-progress">
                  <span>{userRank.currentWeekProgress?.questions_mastered || 0} questions</span>
                  <span>{formatStudyTime(userRank.currentWeekProgress?.study_time_seconds)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="leaderboard-content">
          {isLoading ? (
            <div className="loading">Loading leaderboard...</div>
          ) : currentLeaderboard.length === 0 ? (
            <div className="no-data">
              <p>No leaderboard data available yet.</p>
              <p>Start studying to appear on next week's leaderboard!</p>
            </div>
          ) : (
            <div className="leaderboard-list">
              <div className="leaderboard-header-row">
                <div className="rank-col">Rank</div>
                <div className="user-col">User</div>
                <div className="value-col">
                  {activeTab === 'questions' ? 'Questions' : 'Study Time'}
                </div>
              </div>
              
              {currentLeaderboard.map((entry) => (
                <div 
                  key={entry.user_id} 
                  className={`leaderboard-row ${user && entry.user_id === user.id ? 'current-user' : ''}`}
                >
                  <div className="rank-col">
                    <span className="rank-icon">
                      {getRankIcon(activeTab === 'questions' ? entry.rank_questions : entry.rank_time)}
                    </span>
                  </div>
                  
                  <div className="user-col">
                    <div className="user-info">
                      {entry.profile_picture_url ? (
                        <img 
                          src={entry.profile_picture_url} 
                          alt={entry.display_name}
                          className="user-avatar"
                        />
                      ) : (
                        <div className="user-avatar-placeholder">
                          {entry.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="user-details">
                        <div className="user-name">{entry.display_name}</div>
                        <div className="username">@{entry.username}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="value-col">
                    <span className="primary-value">
                      {activeTab === 'questions' 
                        ? `${entry.questions_mastered} questions`
                        : formatStudyTime(entry.study_time_seconds)
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="leaderboard-info">
          <div className="info-card">
            <h4>How it works</h4>
            <ul>
              <li>📚 Questions mastered: Complete questions correctly to mark them as mastered</li>
              <li>⏱️ Study time: Time spent actively studying (quiz sessions)</li>
              <li>🔄 Weekly reset: Leaderboard resets every Sunday at midnight UTC</li>
              <li>🏆 Compete with other students and track your progress</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;