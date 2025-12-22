-- ================================================================
-- Add is_working column to users table
-- This tracks the current working status of each user
-- ================================================================

-- Add is_working column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_working BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_working ON users(is_working);

-- Add comment
COMMENT ON COLUMN users.is_working IS 'Indica se o utilizador está atualmente a trabalhar (true) ou não (false)';
