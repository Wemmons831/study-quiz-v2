const Filter = require('bad-words');

// Initialize the profanity filter
const filter = new Filter();

// Add custom inappropriate words if needed
const customBadWords = [
  // Add any additional words you want to filter
  'spam',
  'test123',
  // Add more as needed
];

filter.addWords(...customBadWords);

/**
 * Filter inappropriate content from text
 * @param {string} text - Text to filter
 * @returns {string} - Filtered text (replaces bad words with asterisks)
 */
const filterContent = async (text) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    // Use bad-words library to filter content
    return filter.clean(text);
  } catch (error) {
    console.error('Content filtering error:', error);
    // Return original text if filtering fails
    return text;
  }
};

/**
 * Check if text contains inappropriate content
 * @param {string} text - Text to check
 * @returns {boolean} - True if text contains inappropriate content
 */
const containsInappropriateContent = async (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  try {
    return filter.isProfane(text);
  } catch (error) {
    console.error('Content checking error:', error);
    return false;
  }
};

/**
 * Middleware to filter request body fields
 * @param {Array} fields - Array of field names to filter
 */
const filterRequestFields = (fields = []) => {
  return async (req, res, next) => {
    try {
      for (const field of fields) {
        if (req.body[field]) {
          const originalValue = req.body[field];
          const filteredValue = await filterContent(originalValue);
          
          // If content was filtered (changed), reject the request
          if (filteredValue !== originalValue) {
            return res.status(400).json({
              error: `Field '${field}' contains inappropriate content`,
              field: field
            });
          }
          
          req.body[field] = filteredValue;
        }
      }
      next();
    } catch (error) {
      console.error('Filter middleware error:', error);
      res.status(500).json({
        error: 'Content filtering failed'
      });
    }
  };
};

/**
 * Validate image content (basic check for inappropriate filenames)
 * @param {string} filename - Image filename to check
 * @returns {boolean} - True if filename is appropriate
 */
const validateImageContent = async (filename) => {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Remove file extension and check the name part
  const nameWithoutExt = filename.split('.')[0];
  
  try {
    return !filter.isProfane(nameWithoutExt);
  } catch (error) {
    console.error('Image validation error:', error);
    return true; // Allow if validation fails
  }
};

/**
 * Middleware for file upload content filtering
 */
const filterUploadedFiles = async (req, res, next) => {
  try {
    if (req.files) {
      // Check if any uploaded files have inappropriate names
      for (const fileField in req.files) {
        const files = Array.isArray(req.files[fileField]) 
          ? req.files[fileField] 
          : [req.files[fileField]];
        
        for (const file of files) {
          const isAppropriate = await validateImageContent(file.originalname);
          if (!isAppropriate) {
            return res.status(400).json({
              error: 'Uploaded file contains inappropriate content in filename',
              filename: file.originalname
            });
          }
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('File filtering error:', error);
    res.status(500).json({
      error: 'File content filtering failed'
    });
  }
};

/**
 * Clean array of strings (for tags, etc.)
 * @param {Array} textArray - Array of strings to filter
 * @returns {Array} - Array of filtered strings
 */
const filterTextArray = async (textArray) => {
  if (!Array.isArray(textArray)) {
    return textArray;
  }

  try {
    const filteredArray = [];
    for (const text of textArray) {
      if (typeof text === 'string') {
        const filtered = await filterContent(text);
        // Only include if no inappropriate content was found
        if (filtered === text) {
          filteredArray.push(filtered);
        }
      }
    }
    return filteredArray;
  } catch (error) {
    console.error('Array filtering error:', error);
    return textArray;
  }
};

module.exports = {
  filterContent,
  containsInappropriateContent,
  filterRequestFields,
  validateImageContent,
  filterUploadedFiles,
  filterTextArray
};