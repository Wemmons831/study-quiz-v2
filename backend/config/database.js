const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'studyquiz',
  process.env.DB_USER || 'studyquiz',
  process.env.DB_PASS || 'studyquiz123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      // Enable SSL in production if needed
      ...(process.env.NODE_ENV === 'production' && {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      })
    }
  }
);

// Test database connection
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    
    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized');
    }
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    throw error;
  }
}

// Run SQL migrations
async function runMigrations() {
  try {
    const migrationsPath = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const sqlContent = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
      await sequelize.query(sqlContent);
      console.log(`✅ Migration ${file} completed`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Close database connection gracefully
async function closeDB() {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}

module.exports = {
  sequelize,
  connectDB,
  runMigrations,
  closeDB
};