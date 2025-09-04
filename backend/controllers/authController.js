const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { validateRegisterData, validateLoginData } = require('../middleware/validation');
const { filterContent } = require('../middleware/contentFilter');

// Register new user
const register = async (req, res) => {
  try {
    const { email, username, password, display_name } = req.body;

    // Validate input data
    const { error, value } = validateRegisterData(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [User.sequelize.Sequelize.Op.or]: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email or username already exists'
      });
    }

    // Filter inappropriate content from username and display name
    const filteredUsername = await filterContent(username);
    const filteredDisplayName = await filterContent(display_name);

    if (filteredUsername !== username) {
      return res.status(400).json({
        error: 'Username contains inappropriate content'
      });
    }

    if (filteredDisplayName !== display_name) {
      return res.status(400).json({
        error: 'Display name contains inappropriate content'
      });
    }

    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password_hash: password, // Will be hashed by the model hook
      display_name: filteredDisplayName
    });

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data without password
    res.status(201).json({
      message: 'User registered successfully',
      user: user.getSafeUserData(),
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'User with this email or username already exists'
      });
    }
    
    res.status(500).json({
      error: 'Registration failed'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input data
    const { error, value } = validateLoginData(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Find user with password hash included
    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }

    // Check password
    const isValidPassword = await user.checkPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data without password
    res.json({
      message: 'Login successful',
      user: user.getSafeUserData(),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    // req.user is set by auth middleware
    res.json({
      user: req.user.getSafeUserData()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
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
      user: updatedUser.getSafeUserData()
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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
};