import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../services/api';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    username: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        username: user.username || ''
      });
      loadUserStats();
    }
  }, [user]);

  const loadUserStats = async () => {
    try {
      const response = await apiCall('/users/stats');
      setStats(response.stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, profilePicture: 'File size must be under 5MB' }));
        return;
      }
      setProfilePicture(file);
      setErrors(prev => ({ ...prev, profilePicture: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      // Update profile information
      const updateData = {};
      if (formData.display_name !== user.display_name) {
        updateData.display_name = formData.display_name;
      }
      if (formData.username !== user.username) {
        updateData.username = formData.username;
      }

      if (Object.keys(updateData).length > 0) {
        const response = await apiCall('/users/profile', {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
        updateUser(response.user);
      }

      // Upload profile picture if selected
      if (profilePicture) {
        const formDataPic = new FormData();
        formDataPic.append('profilePicture', profilePicture);
        
        const picResponse = await apiCall('/users/profile-picture', {
          method: 'POST',
          body: formDataPic,
          skipContentType: true
        });
        updateUser(picResponse.user);
      }

      setIsEditing(false);
      setProfilePicture(null);
    } catch (error) {
      console.error('Profile update error:', error);
      setErrors({
        submit: error.message || 'Failed to update profile'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatStudyTime = (seconds) => {
    if (!seconds) return '0 minutes';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  if (!user) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.profile_picture_url ? (
              <img src={user.profile_picture_url} alt={user.display_name} />
            ) : (
              <div className="avatar-placeholder">
                {user.display_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="profile-info">
            <h1>{user.display_name}</h1>
            <p className="username">@{user.username}</p>
            <p className="join-date">
              Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          <button 
            className="edit-profile-btn"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {isEditing && (
          <div className="profile-edit-form">
            <h3>Edit Profile</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="display_name">Display Name</label>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleChange}
                  className={errors.display_name ? 'error' : ''}
                  disabled={isLoading}
                />
                {errors.display_name && (
                  <span className="error-message">{errors.display_name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={errors.username ? 'error' : ''}
                  disabled={isLoading}
                />
                {errors.username && (
                  <span className="error-message">{errors.username}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="profilePicture">Profile Picture</label>
                <input
                  type="file"
                  id="profilePicture"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  disabled={isLoading}
                />
                {errors.profilePicture && (
                  <span className="error-message">{errors.profilePicture}</span>
                )}
              </div>

              {errors.submit && (
                <div className="error-message submit-error">
                  {errors.submit}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className={`save-btn ${isLoading ? 'loading' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {stats && (
          <div className="profile-stats">
            <h3>Your Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Study Sets</h4>
                <div className="stat-value">{stats.studySets?.total || 0}</div>
                <div className="stat-detail">
                  {stats.studySets?.public || 0} public, {stats.studySets?.private || 0} private
                </div>
              </div>
              
              <div className="stat-card">
                <h4>Questions Mastered</h4>
                <div className="stat-value">{stats.progress?.masteredQuestions || 0}</div>
                <div className="stat-detail">
                  out of {stats.progress?.totalQuestions || 0} attempted
                </div>
              </div>
              
              <div className="stat-card">
                <h4>Study Time</h4>
                <div className="stat-value">{formatStudyTime(stats.studyTime?.totalSeconds)}</div>
                <div className="stat-detail">
                  {stats.studyTime?.totalHours || 0} hours total
                </div>
              </div>
              
              <div className="stat-card">
                <h4>Accuracy</h4>
                <div className="stat-value">{stats.progress?.averageCorrectRate || 0}%</div>
                <div className="stat-detail">
                  {stats.progress?.totalQuestionsSeen || 0} questions seen
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;