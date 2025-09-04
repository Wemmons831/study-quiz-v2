const StudySet = require('../models/StudySet');
const Question = require('../models/Question');
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { filterContent, filterTextArray } = require('../middleware/contentFilter');
const { sequelize } = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');

// Get all study sets for the authenticated user
const getAllStudySets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const studySets = await StudySet.findAndCountAll({
      where: { user_id: userId },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['updated_at', 'DESC']],
      include: [
        {
          model: Question,
          as: 'questions',
          attributes: ['id']
        }
      ]
    });

    // Add question count and progress summary
    const studySetsWithStats = await Promise.all(
      studySets.rows.map(async (studySet) => {
        const questionCount = studySet.questions?.length || 0;
        const progressSummary = questionCount > 0 
          ? await UserProgress.getStudySetSummary(userId, studySet.id)
          : null;

        return {
          ...studySet.toJSON(),
          questionCount,
          progress: progressSummary
        };
      })
    );

    res.json({
      studySets: studySetsWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(studySets.count / limit),
        totalItems: studySets.count,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get study sets error:', error);
    res.status(500).json({
      error: 'Failed to retrieve study sets'
    });
  }
};

// Get single study set by ID
const getStudySetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const studySet = await StudySet.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions',
          order: [['created_at', 'ASC']]
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        }
      ]
    });

    if (!studySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    // Check if user has access
    if (!studySet.is_public && studySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get progress for this user
    const progressSummary = await UserProgress.getStudySetSummary(userId, studySet.id);

    // Increment play count if user is accessing for study
    if (req.query.study === 'true') {
      await studySet.incrementPlayCount();
    }

    res.json({
      studySet: {
        ...studySet.toJSON(),
        progress: progressSummary
      }
    });

  } catch (error) {
    console.error('Get study set error:', error);
    res.status(500).json({
      error: 'Failed to retrieve study set'
    });
  }
};

// Create new study set
const createStudySet = async (req, res) => {
  try {
    const userId = req.user.id;
    let { title, description, is_public, tags, questions } = req.body;

    // Filter content
    title = await filterContent(title);
    description = description ? await filterContent(description) : null;
    tags = tags ? await filterTextArray(tags) : [];

    // Create study set
    const studySet = await StudySet.create({
      title,
      description,
      is_public: !!is_public,
      tags,
      user_id: userId
    });

    // Add questions if provided
    if (questions && Array.isArray(questions)) {
      const questionsToCreate = await Promise.all(
        questions.map(async (q) => ({
          study_set_id: studySet.id,
          question_text: await filterContent(q.question_text),
          correct_answer: await filterContent(q.correct_answer),
          wrong_answers: await Promise.all(
            q.wrong_answers.map(ans => filterContent(ans))
          )
        }))
      );

      await Question.bulkCreate(questionsToCreate);
    }

    // Fetch the complete study set with questions
    const completeStudySet = await StudySet.findByPk(studySet.id, {
      include: [
        {
          model: Question,
          as: 'questions'
        }
      ]
    });

    res.status(201).json({
      message: 'Study set created successfully',
      studySet: completeStudySet
    });

  } catch (error) {
    console.error('Create study set error:', error);
    res.status(500).json({
      error: 'Failed to create study set'
    });
  }
};

// Update study set
const updateStudySet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let { title, description, is_public, tags } = req.body;

    // Find study set
    const studySet = await StudySet.findByPk(id);
    
    if (!studySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    // Check ownership
    if (studySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Filter content
    const updateData = {};
    if (title !== undefined) updateData.title = await filterContent(title);
    if (description !== undefined) updateData.description = description ? await filterContent(description) : null;
    if (is_public !== undefined) updateData.is_public = !!is_public;
    if (tags !== undefined) updateData.tags = await filterTextArray(tags);

    // Update study set
    await StudySet.update(updateData, {
      where: { id }
    });

    // Fetch updated study set
    const updatedStudySet = await StudySet.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions'
        }
      ]
    });

    res.json({
      message: 'Study set updated successfully',
      studySet: updatedStudySet
    });

  } catch (error) {
    console.error('Update study set error:', error);
    res.status(500).json({
      error: 'Failed to update study set'
    });
  }
};

// Delete study set
const deleteStudySet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const studySet = await StudySet.findByPk(id);
    
    if (!studySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    // Check ownership
    if (studySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Delete study set (cascade will handle questions and progress)
    await StudySet.destroy({
      where: { id }
    });

    res.json({
      message: 'Study set deleted successfully'
    });

  } catch (error) {
    console.error('Delete study set error:', error);
    res.status(500).json({
      error: 'Failed to delete study set'
    });
  }
};

// Fork a public study set
const forkStudySet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find original study set
    const originalStudySet = await StudySet.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions'
        }
      ]
    });

    if (!originalStudySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    // Check if it's public or owned by user
    if (!originalStudySet.is_public && originalStudySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Cannot fork private study set'
      });
    }

    // Create new study set
    const forkedStudySet = await StudySet.create({
      title: `${originalStudySet.title} (Fork)`,
      description: originalStudySet.description,
      is_public: false, // Forks are private by default
      tags: originalStudySet.tags,
      user_id: userId,
      forked_from_id: originalStudySet.id
    });

    // Copy questions
    if (originalStudySet.questions?.length > 0) {
      const questionsToCreate = originalStudySet.questions.map(q => ({
        study_set_id: forkedStudySet.id,
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        wrong_answers: q.wrong_answers
      }));

      await Question.bulkCreate(questionsToCreate);
    }

    // Increment fork count on original
    await originalStudySet.incrementForkCount();

    // Fetch complete forked study set
    const completeForkedSet = await StudySet.findByPk(forkedStudySet.id, {
      include: [
        {
          model: Question,
          as: 'questions'
        }
      ]
    });

    res.status(201).json({
      message: 'Study set forked successfully',
      studySet: completeForkedSet
    });

  } catch (error) {
    console.error('Fork study set error:', error);
    res.status(500).json({
      error: 'Failed to fork study set'
    });
  }
};

// Upload CSV file to create/update study set
const uploadCSV = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: 'No CSV file uploaded'
      });
    }

    const questions = [];
    const filename = file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
    const title = filename.replace(/_/g, ' '); // Replace underscores with spaces

    // Parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
          const values = Object.values(row);
          
          if (values.length >= 3) {
            const question = values[0]?.trim();
            const correctAnswer = values[1]?.trim();
            const wrongAnswersStr = values[2]?.trim();
            const timesSeen = values[3] ? parseInt(values[3]) || 0 : 0;

            if (question && correctAnswer && wrongAnswersStr) {
              const wrongAnswers = wrongAnswersStr.split('###').map(ans => ans.trim()).filter(ans => ans);
              
              if (wrongAnswers.length === 3) {
                questions.push({
                  question_text: question,
                  correct_answer: correctAnswer,
                  wrong_answers: wrongAnswers,
                  times_seen: timesSeen
                });
              }
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    if (questions.length === 0) {
      return res.status(400).json({
        error: 'No valid questions found in CSV file'
      });
    }

    res.json({
      message: 'CSV parsed successfully',
      title,
      questions,
      questionCount: questions.length
    });

  } catch (error) {
    console.error('Upload CSV error:', error);
    
    // Clean up file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Failed to process CSV file'
    });
  }
};

// Export study set as CSV
const exportCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find study set with questions and progress
    const studySet = await StudySet.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: UserProgress,
              as: 'progress',
              where: { user_id: userId },
              required: false
            }
          ]
        }
      ]
    });

    if (!studySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    // Check access
    if (!studySet.is_public && studySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Generate CSV content
    const csvLines = studySet.questions.map(question => {
      const progress = question.progress?.[0];
      const timesSeen = progress ? progress.times_seen : 0;
      const wrongAnswers = question.wrong_answers.join('###');
      
      return `"${question.question_text}","${question.correct_answer}","${wrongAnswers}",${timesSeen}`;
    });

    const csvContent = csvLines.join('\n');
    const filename = `${studySet.title.replace(/[^a-zA-Z0-9]/g, '_')}_progress.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({
      error: 'Failed to export CSV'
    });
  }
};

// Get progress for a study set
const getStudySetProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify study set exists and user has access
    const studySet = await StudySet.findByPk(id);
    if (!studySet) {
      return res.status(404).json({
        error: 'Study set not found'
      });
    }

    if (!studySet.is_public && studySet.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get progress summary
    const progressSummary = await UserProgress.getStudySetSummary(userId, id);
    
    // Get questions needing practice
    const questionsNeedingPractice = await UserProgress.getQuestionsNeedingPractice(userId, id);

    res.json({
      progress: progressSummary,
      questionsNeedingPractice
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      error: 'Failed to get progress'
    });
  }
};

// Update progress for a specific question
const updateQuestionProgress = async (req, res) => {
  try {
    const { id: studySetId, questionId } = req.params;
    const { isCorrect } = req.body;
    const userId = req.user.id;

    // Verify question belongs to study set
    const question = await Question.findOne({
      where: { 
        id: questionId,
        study_set_id: studySetId
      }
    });

    if (!question) {
      return res.status(404).json({
        error: 'Question not found'
      });
    }

    // Get or create progress entry
    const progress = await UserProgress.getOrCreate(userId, questionId, studySetId);

    // Update progress based on answer correctness
    if (isCorrect) {
      await progress.recordCorrectAnswer();
    } else {
      await progress.recordIncorrectAnswer();
    }

    res.json({
      message: 'Progress updated successfully',
      progress: progress.toJSON()
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      error: 'Failed to update progress'
    });
  }
};

module.exports = {
  getAllStudySets,
  getStudySetById,
  createStudySet,
  updateStudySet,
  deleteStudySet,
  forkStudySet,
  uploadCSV,
  exportCSV,
  getStudySetProgress,
  updateQuestionProgress
};