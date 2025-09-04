-- Initial database schema for Study Quiz v2
-- This file will be automatically executed on first run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    profile_picture_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Study sets table
CREATE TABLE IF NOT EXISTS study_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[], -- Array of tag strings
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    forked_from_id UUID REFERENCES study_sets(id) ON DELETE SET NULL,
    fork_count INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    wrong_answers TEXT[] NOT NULL, -- Array of wrong answer strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User progress table (tracks individual question progress)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    correct_count INTEGER DEFAULT 0,
    times_seen INTEGER DEFAULT 0,
    last_answered_at TIMESTAMP WITH TIME ZONE,
    is_mastered BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id)
);

-- Study sessions table (for tracking active study time)
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly leaderboards table
CREATE TABLE IF NOT EXISTS weekly_leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    questions_mastered INTEGER DEFAULT 0,
    study_time_seconds INTEGER DEFAULT 0,
    rank_questions INTEGER,
    rank_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, week_start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_study_sets_user_id ON study_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sets_is_public ON study_sets(is_public);
CREATE INDEX IF NOT EXISTS idx_study_sets_created_at ON study_sets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sets_play_count ON study_sets(play_count DESC);

CREATE INDEX IF NOT EXISTS idx_questions_study_set_id ON questions(study_set_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_study_set_id ON user_progress(study_set_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_is_mastered ON user_progress(is_mastered);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_is_active ON study_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_study_sessions_start_time ON study_sessions(start_time);

CREATE INDEX IF NOT EXISTS idx_weekly_leaderboards_week_start ON weekly_leaderboards(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_leaderboards_questions ON weekly_leaderboards(questions_mastered DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_leaderboards_time ON weekly_leaderboards(study_time_seconds DESC);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_sets_updated_at BEFORE UPDATE ON study_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON study_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_leaderboards_updated_at BEFORE UPDATE ON weekly_leaderboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();