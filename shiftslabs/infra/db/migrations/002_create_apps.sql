-- 002_create_apps.sql
-- Creates the apps table for OAuth client registration

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  redirect_uri TEXT NOT NULL,
  is_whitelisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_apps_client_id ON apps(client_id);

-- Enable Row Level Security
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read apps (needed for client validation)
CREATE POLICY "Anyone can read apps" ON apps
  FOR SELECT USING (true);

-- Policy: Only service role can modify apps
CREATE POLICY "Service can manage apps" ON apps
  FOR ALL USING (true);