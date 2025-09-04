// /models/index.js

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust if your sequelize config path is different

const StudySet = require('./StudySet');
const Question = require('./Question');
// Import other models here…

// --- ASSOCIATIONS ---
StudySet.hasMany(Question, { foreignKey: 'study_set_id', as: 'questions' });
Question.belongsTo(StudySet, { foreignKey: 'study_set_id', as: 'studySet' });

// Add more associations for other models here if needed

module.exports = {
  sequelize,
  StudySet,
  Question,
  // Export other models here…
};
