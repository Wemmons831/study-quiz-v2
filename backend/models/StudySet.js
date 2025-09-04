const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StudySet extends Model {
  // Instance method to increment play count
  async incrementPlayCount() {
    this.play_count = (this.play_count || 0) + 1;
    await this.save();
  }

  // Instance method to increment fork count
  async incrementForkCount() {
    this.fork_count = (this.fork_count || 0) + 1;
    await this.save();
  }

  // Static method to get popular study sets
  static async getPopular(limit = 20) {
    return this.findAll({
      where: { is_public: true },
      order: [['play_count', 'DESC'], ['created_at', 'DESC']],
      limit,
      include: [
        {
          model: sequelize.models.User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        }
      ]
    });
  }

  // Static method to get recent study sets
  static async getRecent(limit = 20) {
    return this.findAll({
      where: { is_public: true },
      order: [['created_at', 'DESC']],
      limit,
      include: [
        {
          model: sequelize.models.User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        }
      ]
    });
  }
}

StudySet.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [1, 200],
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    validate: {
      isArrayOfStrings(value) {
        if (value && !Array.isArray(value)) {
          throw new Error('Tags must be an array');
        }
        if (value && value.some(tag => typeof tag !== 'string')) {
          throw new Error('All tags must be strings');
        }
      }
    }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  forked_from_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'study_sets',
      key: 'id'
    }
  },
  fork_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  play_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  }
}, {
  sequelize,
  modelName: 'StudySet',
  tableName: 'study_sets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['is_public']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['play_count']
    },
    {
      fields: ['forked_from_id']
    }
  ]
});

module.exports = StudySet;