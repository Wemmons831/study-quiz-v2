const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
 
class Question extends Model {
  // Instance method to shuffle wrong answers with correct answer
  getShuffledAnswers() {
    const allAnswers = [
      { text: this.correct_answer, isCorrect: true },
      ...this.wrong_answers.map(answer => ({ text: answer, isCorrect: false }))
    ];
    
    // Fisher-Yates shuffle
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }
    
    return allAnswers;
  }

  // Static method to get questions with progress for a user
  static async getWithProgress(studySetId, userId) {
    const questions = await this.findAll({
      where: { study_set_id: studySetId },
      include: [
        {
          model: sequelize.models.UserProgress,
          as: 'progress',
          where: { user_id: userId },
          required: false
        }
      ],
      order: [['created_at', 'ASC']]
    });

    return questions.map(question => ({
      ...question.toJSON(),
      progress: question.progress?.[0] || {
        correct_count: 0,
        times_seen: 0,
        is_mastered: false
      }
    }));
  }

  // Validate that we have exactly 3 wrong answers
  validateWrongAnswers() {
    if (!Array.isArray(this.wrong_answers)) {
      throw new Error('Wrong answers must be an array');
    }
    if (this.wrong_answers.length !== 3) {
      throw new Error('Must have exactly 3 wrong answers');
    }
    if (this.wrong_answers.some(answer => !answer || answer.trim().length === 0)) {
      throw new Error('Wrong answers cannot be empty');
    }
  }
}

Question.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  study_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'study_sets',
      key: 'id'
    }
  },
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 2000]
    }
  },
  correct_answer: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 500]
    }
  },
  wrong_answers: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    validate: {
      isValidWrongAnswers(value) {
        if (!Array.isArray(value)) {
          throw new Error('Wrong answers must be an array');
        }
        if (value.length !== 3) {
          throw new Error('Must have exactly 3 wrong answers');
        }
        if (value.some(answer => !answer || answer.trim().length === 0)) {
          throw new Error('Wrong answers cannot be empty');
        }
        if (value.some(answer => answer.length > 500)) {
          throw new Error('Wrong answers must be 500 characters or less');
        }
      }
    }
  }
}, {
  sequelize,
  modelName: 'Question',
  tableName: 'questions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['study_set_id']
    }
  ],
  hooks: {
    beforeCreate: (question) => {
      question.validateWrongAnswers();
    },
    beforeUpdate: (question) => {
      if (question.changed('wrong_answers')) {
        question.validateWrongAnswers();
      }
    }
  }
});

module.exports = Question;