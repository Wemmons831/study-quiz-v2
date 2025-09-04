const StudySet = require('../models');
const Question = require('../models');
const User = require('../models/User');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Get popular public study sets
const getPopularStudySets = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 100); // Max 100
    const offset = (parseInt(page) - 1) * parsedLimit;

    const studySets = await StudySet.findAndCountAll({
      where: { is_public: true },
      limit: parsedLimit,
      offset,
      order: [
        ['play_count', 'DESC'],
        ['fork_count', 'DESC'],
        ['created_at', 'DESC']
      ],
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        },
        {
          model: Question,
          as: 'questions',
          attributes: ['id'],
          separate: true
        }
      ]
    });

    // Add question count to each study set
    const studySetsWithCount = studySets.rows.map(studySet => ({
      ...studySet.toJSON(),
      questionCount: studySet.questions?.length || 0,
      questions: undefined // Remove questions array, keep only count
    }));

    res.json({
      studySets: studySetsWithCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(studySets.count / parsedLimit),
        totalItems: studySets.count,
        itemsPerPage: parsedLimit
      },
      type: 'popular'
    });

  } catch (error) {
    console.error('Get popular study sets error:', error);
    res.status(500).json({
      error: 'Failed to get popular study sets'
    });
  }
};

// Get recently created public study sets
const getRecentStudySets = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 100); // Max 100
    const offset = (parseInt(page) - 1) * parsedLimit;

    const studySets = await StudySet.findAndCountAll({
      where: { is_public: true },
      limit: parsedLimit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        },
        {
          model: Question,
          as: 'questions',
          attributes: ['id'],
          separate: true
        }
      ]
    });

    // Add question count to each study set
    const studySetsWithCount = studySets.rows.map(studySet => ({
      ...studySet.toJSON(),
      questionCount: studySet.questions?.length || 0,
      questions: undefined // Remove questions array, keep only count
    }));

    res.json({
      studySets: studySetsWithCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(studySets.count / parsedLimit),
        totalItems: studySets.count,
        itemsPerPage: parsedLimit
      },
      type: 'recent'
    });

  } catch (error) {
    console.error('Get recent study sets error:', error);
    res.status(500).json({
      error: 'Failed to get recent study sets'
    });
  }
};

// Search public study sets
const searchStudySets = async (req, res) => {
  try {
    const { q, limit = 20, page = 1, sort = 'relevance' } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const searchTerm = q.trim();
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const offset = (parseInt(page) - 1) * parsedLimit;

    // Build order clause based on sort parameter
    let orderClause;
    switch (sort) {
      case 'popular':
        orderClause = [['play_count', 'DESC'], ['fork_count', 'DESC']];
        break;
      case 'recent':
        orderClause = [['created_at', 'DESC']];
        break;
      case 'relevance':
      default:
        // PostgreSQL text search relevance (basic implementation)
        orderClause = [
          [sequelize.literal(`
            CASE 
              WHEN LOWER(title) LIKE LOWER('%${searchTerm}%') THEN 3
              WHEN LOWER(description) LIKE LOWER('%${searchTerm}%') THEN 2
              WHEN array_to_string(tags, ' ') ILIKE '%${searchTerm}%' THEN 1
              ELSE 0
            END
          `), 'DESC'],
          ['play_count', 'DESC']
        ];
        break;
    }

    const studySets = await StudySet.findAndCountAll({
      where: {
        is_public: true,
        [Op.or]: [
          { title: { [Op.iLike]: `%${searchTerm}%` } },
          { description: { [Op.iLike]: `%${searchTerm}%` } },
          { tags: { [Op.contains]: [searchTerm] } }, // Search in tags array
          sequelize.literal(`array_to_string(tags, ' ') ILIKE '%${searchTerm}%'`) // Partial tag match
        ]
      },
      limit: parsedLimit,
      offset,
      order: orderClause,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        },
        {
          model: Question,
          as: 'questions',
          attributes: ['id'],
          separate: true
        }
      ]
    });

    // Add question count and search relevance info
    const studySetsWithCount = studySets.rows.map(studySet => ({
      ...studySet.toJSON(),
      questionCount: studySet.questions?.length || 0,
      questions: undefined,
      searchRelevance: {
        titleMatch: studySet.title.toLowerCase().includes(searchTerm.toLowerCase()),
        descriptionMatch: studySet.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false,
        tagMatch: studySet.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) || false
      }
    }));

    res.json({
      studySets: studySetsWithCount,
      searchQuery: searchTerm,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(studySets.count / parsedLimit),
        totalItems: studySets.count,
        itemsPerPage: parsedLimit
      },
      sort,
      type: 'search'
    });

  } catch (error) {
    console.error('Search study sets error:', error);
    res.status(500).json({
      error: 'Failed to search study sets'
    });
  }
};

// Get study sets by tag
const getStudySetsByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 20, page = 1, sort = 'popular' } = req.query;
    
    if (!tag || tag.trim().length === 0) {
      return res.status(400).json({
        error: 'Tag parameter is required'
      });
    }

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const offset = (parseInt(page) - 1) * parsedLimit;

    // Build order clause
    let orderClause;
    switch (sort) {
      case 'recent':
        orderClause = [['created_at', 'DESC']];
        break;
      case 'popular':
      default:
        orderClause = [['play_count', 'DESC'], ['fork_count', 'DESC'], ['created_at', 'DESC']];
        break;
    }

    const studySets = await StudySet.findAndCountAll({
      where: {
        is_public: true,
        tags: { [Op.contains]: [tag] } // Exact tag match
      },
      limit: parsedLimit,
      offset,
      order: orderClause,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'display_name', 'profile_picture_url']
        },
        {
          model: Question,
          as: 'questions',
          attributes: ['id'],
          separate: true
        }
      ]
    });

    // Add question count
    const studySetsWithCount = studySets.rows.map(studySet => ({
      ...studySet.toJSON(),
      questionCount: studySet.questions?.length || 0,
      questions: undefined
    }));

    res.json({
      studySets: studySetsWithCount,
      tag,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(studySets.count / parsedLimit),
        totalItems: studySets.count,
        itemsPerPage: parsedLimit
      },
      sort,
      type: 'tag'
    });

  } catch (error) {
    console.error('Get study sets by tag error:', error);
    res.status(500).json({
      error: 'Failed to get study sets by tag'
    });
  }
};

// Get all available tags from public study sets
const getAvailableTags = async (req, res) => {
  try {
    const { limit = 50, min_count = 1 } = req.query;
    
    // Get all tags from public study sets and count their usage
    const tagsQuery = `
      SELECT 
        tag, 
        COUNT(*) as usage_count,
        COUNT(DISTINCT user_id) as unique_creators
      FROM (
        SELECT 
          unnest(tags) as tag,
          user_id
        FROM study_sets 
        WHERE is_public = true 
        AND tags IS NOT NULL 
        AND array_length(tags, 1) > 0
      ) as tag_data
      WHERE tag IS NOT NULL AND tag != ''
      GROUP BY tag
      HAVING COUNT(*) >= :minCount
      ORDER BY usage_count DESC, tag ASC
      LIMIT :limit
    `;

    const tagsResult = await sequelize.query(tagsQuery, {
      replacements: { 
        minCount: parseInt(min_count),
        limit: parseInt(limit) || 50
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Get total number of unique tags
    const totalTagsQuery = `
      SELECT COUNT(DISTINCT tag) as total_unique_tags
      FROM (
        SELECT unnest(tags) as tag
        FROM study_sets 
        WHERE is_public = true 
        AND tags IS NOT NULL 
        AND array_length(tags, 1) > 0
      ) as all_tags
      WHERE tag IS NOT NULL AND tag != ''
    `;

    const totalTagsResult = await sequelize.query(totalTagsQuery, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      tags: tagsResult.map(tag => ({
        name: tag.tag,
        usageCount: parseInt(tag.usage_count),
        uniqueCreators: parseInt(tag.unique_creators)
      })),
      totalUniqueTags: parseInt(totalTagsResult[0]?.total_unique_tags || 0),
      filters: {
        minCount: parseInt(min_count),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get available tags error:', error);
    res.status(500).json({
      error: 'Failed to get available tags'
    });
  }
};

// Get discovery statistics
const getDiscoverStats = async (req, res) => {
  try {
    // Get general statistics
    const generalStats = await StudySet.findAll({
      where: { is_public: true },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalPublicStudySets'],
        [sequelize.fn('SUM', sequelize.col('play_count')), 'totalPlays'],
        [sequelize.fn('SUM', sequelize.col('fork_count')), 'totalForks'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('user_id'))), 'uniqueCreators']
      ],
      raw: true
    });

    // Get question count
    const questionCountQuery = `
      SELECT COUNT(q.id) as total_questions
      FROM questions q
      JOIN study_sets ss ON q.study_set_id = ss.id
      WHERE ss.is_public = true
    `;

    const questionCountResult = await sequelize.query(questionCountQuery, {
      type: sequelize.QueryTypes.SELECT
    });

    // Get most popular study set
    const mostPopular = await StudySet.findOne({
      where: { is_public: true },
      order: [['play_count', 'DESC']],
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['username', 'display_name']
        }
      ]
    });

    // Get most recent activity (last 24 hours)
    const recentActivity = await StudySet.count({
      where: {
        is_public: true,
        created_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get tag statistics
    const tagStatsQuery = `
      SELECT COUNT(DISTINCT tag) as unique_tags_count
      FROM (
        SELECT unnest(tags) as tag
        FROM study_sets 
        WHERE is_public = true 
        AND tags IS NOT NULL 
        AND array_length(tags, 1) > 0
      ) as tag_data
      WHERE tag IS NOT NULL AND tag != ''
    `;

    const tagStatsResult = await sequelize.query(tagStatsQuery, {
      type: sequelize.QueryTypes.SELECT
    });

    const stats = {
      studySets: {
        total: parseInt(generalStats[0]?.totalPublicStudySets || 0),
        totalPlays: parseInt(generalStats[0]?.totalPlays || 0),
        totalForks: parseInt(generalStats[0]?.totalForks || 0),
        recentlyCreated24h: recentActivity
      },
      questions: {
        total: parseInt(questionCountResult[0]?.total_questions || 0)
      },
      users: {
        uniqueCreators: parseInt(generalStats[0]?.uniqueCreators || 0)
      },
      tags: {
        uniqueTags: parseInt(tagStatsResult[0]?.unique_tags_count || 0)
      },
      mostPopular: mostPopular ? {
        title: mostPopular.title,
        playCount: mostPopular.play_count,
        forkCount: mostPopular.fork_count,
        creator: mostPopular.owner?.display_name || mostPopular.owner?.username
      } : null,
      lastUpdated: new Date().toISOString()
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get discover stats error:', error);
    res.status(500).json({
      error: 'Failed to get discovery statistics'
    });
  }
};

module.exports = {
  getPopularStudySets,
  getRecentStudySets,
  searchStudySets,
  getStudySetsByTag,
  getAvailableTags,
  getDiscoverStats
};