-- Analytics Events Table
-- Stores anonymized analytics events for app usage tracking
-- All data is anonymized and GDPR-compliant

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash TEXT NOT NULL, -- Hashed user ID (not real user_id)
  event_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  app_version TEXT NOT NULL,
  os_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id_hash ON analytics_events(user_id_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_device_type ON analytics_events(device_type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type_date ON analytics_events(user_id_hash, event_type, created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own events (by hash)
-- Note: Since we use hashed user IDs, we need to allow service role to read all
-- for analytics purposes, but users cannot query their own events directly
-- (this is intentional for privacy)

-- Policy for service role (backend/admin can read all)
CREATE POLICY "Service role can read all analytics events"
  ON analytics_events
  FOR SELECT
  TO service_role
  USING (true);

-- Policy for authenticated users (they can't read analytics events directly)
-- This ensures privacy - users cannot query their own analytics
CREATE POLICY "Users cannot read analytics events"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (false);

-- Policy: Anyone can insert (for app to log events)
-- But we validate user_id_hash is not empty
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id_hash IS NOT NULL AND user_id_hash != '');

-- Add comment
COMMENT ON TABLE analytics_events IS 'Stores anonymized analytics events. user_id_hash is a hashed version of user_id for privacy. Users cannot query their own events directly.';
COMMENT ON COLUMN analytics_events.user_id_hash IS 'SHA-256 hash of user_id (first 16 chars). Used for anonymization.';
COMMENT ON COLUMN analytics_events.properties IS 'Event properties (JSONB). No PII allowed.';


