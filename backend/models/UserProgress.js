const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class UserProgress extends Model {
  // Instance method to mark question as seen
  async markAsSeen() {
    this.times_seen = (this.times_seen || 0) + 1;
    this.last_answered_at = new Date();
    await this.save();
    return this;
  }

  // Instance method to record correct answer
  async recordCorrectAnswer() {
    this.correct_count = (this.correct_count || 0) + 1;
    this.times_seen = (this.times_seen || 0) + 1;
    this.last_answered_at = new Date();
    
    // Check if mastered (3 correct answers)
    if (this.correct_count >= 3) {
      this.is_mastered = true;
    }
    
    await this.save();
    return this;
  }

  // Instance method to record incorrect answer
  async recordIncorrectAnswer() {
    this.correct_count = 0; // Reset correct count
    this.times_seen = (this.times_seen || 0) + 1;
    this.last_answered_at = new Date();
    this.is_mastered = false;
    
    await this.save();
    return this;
  }

  // Static method to get or create progress entry
  static async getOrCreate(userId, questionId, studySetId) {
    const [progress, created] = await this.findOrCreate({
      where: {
        user_id: userId,
        question_id: questionId
      },
      defaults: {
        user_id: userId,
        question_id: questionId,
        study_set_id: studySetId,
        correct_count: 0,
        times_seen: 0,
        is_mastered: false
      }
    });
    
    return progress;
  }

  // Static method to get user's progress summary for a study set
  static async getStudySetSummary(userId, studySetId) {
    const progress = await this.findAll({
      where: {
        user_id: userId,
        study_set_id: studySetId
      }
    });

    const totalQuestions = await sequelize.models.Question.count({
      where: { study_set_id: studySetId }
    });

    const masteredCount = progress.filter(p => p.is_mastered).length;
    const totalSeen = progress.reduce((sum, p) => sum + p.times_seen, 0);
    const averageCorrectRate = progress.length > 0 
      ? progress.reduce((sum, p) => sum + (p.times_seen > 0 ? p.correct_count / p.times_seen : 0), 0) / progress.length 
      : 0;

    return {
      totalQuestions,
      questionsAttempted: progress.length,
      questionsMastered: masteredCount,
      totalTimesSeen: totalSeen,
      averageCorrectRate: Math.round(averageCorrectRate * 100),
      progressPercentage: Math.round((masteredCount / totalQuestions) * 100)
    };
  }

  // Static method to get questions that need practice (not mastered)
  static async getQuestionsNeedingPractice(userId, studySetId) {
    return this.findAll({
      where: {
        user_id: userId,
        study_set_id: studySetId,
        is_mastered: false
      },
      include: [
        {
          model: sequelize.models.Question,
          as: 'question'
        }
      ],
      order: [
        ['times_seen', 'ASC'], // Prioritize less seen questions
        ['last_answered_at', 'ASC'] // Then older attempts
      ]
    });
  }
}

UserProgress.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  question_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'questions',
      key: 'id'
    }
  },
  study_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'study_sets',
      key: 'id'
    }
  },
  correct_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  times_seen: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  last_answered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_mastered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'UserProgress',
  tableName: 'user_progress',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'question_id']
    },
    {
      fields: ['user_id', 'study_set_id']
    },
    {
      fields: ['is_mastered']
    },
    {
      fields: ['last_answered_at']
    }
  ]
});

module.exports = UserProgress;