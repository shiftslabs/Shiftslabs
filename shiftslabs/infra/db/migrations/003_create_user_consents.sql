-- 003_create_user_consents.sql
-- Creates the user_consents table for tracking app permissions

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, app_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_app_id ON user_consents(app_id);

-- Enable Row Level Security
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own consents
CREATE POLICY "Users can read own consents" ON user_consents
  FOR SELECT USING (true);

-- Policy: Users can insert their own consents
CREATE POLICY "Users can manage own consents" ON user_consents
  FOR ALL USING (true);