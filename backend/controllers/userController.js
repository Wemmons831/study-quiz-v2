const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const StudySet = require('../models');
const { filterContent } = require('../middleware/contentFilter');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Get current user profile
const getUserProfile = async (req, res) => {
  try {
    // req.user is set by auth middleware
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile'
    });
  }
};

// Get public user profile by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'display_name', 'profile_picture_url', 'created_at']
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Get public stats
    const publicStudySetsCount = await StudySet.count({
      where: { 
        user_id: id,
        is_public: true 
      }
    });

    const totalQuestionsCreated = await StudySet.sum('questionCount', {
      where: { 
        user_id: id,
        is_public: true 
      }
    }) || 0;

    res.json({
      user: {
        ...user.toJSON(),
        stats: {
          publicStudySets: publicStudySetsCount,
          questionsCreated: totalQuestionsCreated
        }
      }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      error: 'Failed to get user profile'
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { display_name, username } = req.body;
    const userId = req.user.id;

    const updateData = {};

    // Validate and filter display name if provided
    if (display_name !== undefined) {
      if (!display_name || display_name.trim().length === 0) {
        return res.status(400).json({
          error: 'Display name cannot be empty'
        });
      }

      const filteredDisplayName = await filterContent(display_name.trim());
      if (filteredDisplayName !== display_name.trim()) {
        return res.status(400).json({
          error: 'Display name contains inappropriate content'
        });
      }

      updateData.display_name = filteredDisplayName;
    }

    // Validate and filter username if provided
    if (username !== undefined) {
      if (!username || username.trim().length < 3) {
        return res.status(400).json({
          error: 'Username must be at least 3 characters long'
        });
      }

      // Check if username is already taken
      const existingUser = await User.findOne({
        where: { 
          username: username.toLowerCase(),
          id: { [User.sequelize.Sequelize.Op.ne]: userId }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username is already taken'
        });
      }

      const filteredUsername = await filterContent(username.trim());
      if (filteredUsername !== username.trim()) {
        return res.status(400).json({
          error: 'Username contains inappropriate content'
        });
      }

      updateData.username = filteredUsername.toLowerCase();
    }

    // Update user
    await User.update(updateData, {
      where: { id: userId }
    });

    // Get updated user
    const updatedUser = await User.findByPk(userId);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Username is already taken'
      });
    }
    
    res.status(500).json({
      error: 'Failed to update profile'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password hash
    const user = await User.scope('withPassword').findByPk(userId);
    
    // Verify current password
    const isValidPassword = await user.checkPassword(current_password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    await User.update(
      { password_hash: new_password }, // Will be hashed by model hook
      { where: { id: userId } }
    );

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password'
    });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'No image file uploaded'
      });
    }

    // Process image with Sharp (resize and optimize)
    const filename = `profile_${userId}_${Date.now()}.jpg`;
    const outputPath = path.join('uploads/profiles', filename);

    await sharp(file.path)
      .resize(200, 200, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    // Delete temporary upload file
    fs.unlinkSync(file.path);

    // Update user profile picture URL
    const profilePictureUrl = `/uploads/profiles/${filename}`;
    await User.update(
      { profile_picture_url: profilePictureUrl },
      { where: { id: userId } }
    );

    // Get updated user
    const updatedUser = await User.findByPk(userId);

    res.json({
      message: 'Profile picture updated successfully',
      user: updatedUser,
      profilePictureUrl
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);

    // Clean up uploaded file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to upload profile picture'
    });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get study set statistics
    const studySetStats = await StudySet.findAll({
      where: { user_id: userId },
      attributes: [
        [StudySet.sequelize.fn('COUNT', StudySet.sequelize.col('id')), 'totalStudySets'],
        [StudySet.sequelize.fn('SUM', StudySet.sequelize.col('play_count')), 'totalPlays'],
        [StudySet.sequelize.fn('SUM', StudySet.sequelize.col('fork_count')), 'totalForks']
      ],
      raw: true
    });

    const publicStudySetsCount = await StudySet.count({
      where: { 
        user_id: userId,
        is_public: true 
      }
    });

    // Get progress statistics
    const progressStats = await UserProgress.findAll({
      where: { user_id: userId },
      attributes: [
        [UserProgress.sequelize.fn('COUNT', UserProgress.sequelize.col('id')), 'totalQuestions'],
        [UserProgress.sequelize.fn('COUNT', UserProgress.sequelize.literal('CASE WHEN is_mastered = true THEN 1 END')), 'masteredQuestions'],
        [UserProgress.sequelize.fn('SUM', UserProgress.sequelize.col('times_seen')), 'totalQuestionsSeen'],
        [UserProgress.sequelize.fn('AVG', UserProgress.sequelize.literal('CASE WHEN times_seen > 0 THEN correct_count::float / times_seen ELSE 0 END')), 'avgCorrectRate']
      ],
      raw: true
    });

    // Get study time from sessions (this is a placeholder - you'd need to implement StudySession model)
    const totalStudyTimeQuery = `
      SELECT COALESCE(SUM(duration_seconds), 0) as total_study_time
      FROM study_sessions 
      WHERE user_id = $1 
      AND end_time IS NOT NULL
    `;

    const studyTimeResult = await User.sequelize.query(totalStudyTimeQuery, {
      bind: [userId],
      type: User.sequelize.QueryTypes.SELECT
    });

    const stats = {
      studySets: {
        total: parseInt(studySetStats[0]?.totalStudySets || 0),
        public: publicStudySetsCount,
        private: parseInt(studySetStats[0]?.totalStudySets || 0) - publicStudySetsCount,
        totalPlays: parseInt(studySetStats[0]?.totalPlays || 0),
        totalForks: parseInt(studySetStats[0]?.totalForks || 0)
      },
      progress: {
        totalQuestions: parseInt(progressStats[0]?.totalQuestions || 0),
        masteredQuestions: parseInt(progressStats[0]?.masteredQuestions || 0),
        totalQuestionsSeen: parseInt(progressStats[0]?.totalQuestionsSeen || 0),
        averageCorrectRate: Math.round((parseFloat(progressStats[0]?.avgCorrectRate || 0)) * 100)
      },
      studyTime: {
        totalSeconds: parseInt(studyTimeResult[0]?.total_study_time || 0),
        totalMinutes: Math.round(parseInt(studyTimeResult[0]?.total_study_time || 0) / 60),
        totalHours: Math.round(parseInt(studyTimeResult[0]?.total_study_time || 0) / 3600)
      }
    };

    res.json({
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Failed to get user statistics'
    });
  }
};

// Delete user account
const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // This is a destructive operation - consider adding additional verification
    // For example, require password confirmation or send email verification

    // Delete user (cascade will handle related records)
    await User.destroy({
      where: { id: userId }
    });

    res.json({
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Failed to delete account'
    });
  }
};

module.exports = {
  getUserProfile,
  getUserById,
  updateUserProfile,
  changePassword,
  uploadProfilePicture,
  getUserStats,
  deleteUserAccount
};