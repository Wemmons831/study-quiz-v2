const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

class User extends Model {
  // Instance method to check password
  async checkPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  // Instance method to get safe user data (without sensitive info)
  getSafeUserData() {
    const { password_hash, ...safeData } = this.toJSON();
    return safeData;
  }

  // Static method to hash password
  static async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [1, 255]
    }
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      is: /^[a-zA-Z0-9_]+$/ // Only alphanumeric and underscore
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  display_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  profile_picture_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['username']
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await User.hashPassword(user.password_hash);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await User.hashPassword(user.password_hash);
      }
    }
  },
  scopes: {
    // Default scope excludes password_hash
    defaultScope: {
      attributes: { exclude: ['password_hash'] }
    },
    // Use withPassword scope when you need the password hash
    withPassword: {
      attributes: { include: ['password_hash'] }
    }
  }
});

module.exports = User;