-- Create daily_copilot_analyses table
CREATE TABLE IF NOT EXISTS daily_copilot_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  mood INTEGER NOT NULL CHECK (mood >= 1 AND mood <= 5),
  sleep_hours DECIMAL(3,1) NOT NULL CHECK (sleep_hours >= 0 AND sleep_hours <= 24),
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality >= 0 AND sleep_quality <= 100),
  health_metrics JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]',
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per day
  UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_copilot_analyses_user_id ON daily_copilot_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_copilot_analyses_date ON daily_copilot_analyses(date);
CREATE INDEX IF NOT EXISTS idx_daily_copilot_analyses_user_date ON daily_copilot_analyses(user_id, date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_copilot_analyses_updated_at 
    BEFORE UPDATE ON daily_copilot_analyses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE daily_copilot_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own daily copilot analyses" ON daily_copilot_analyses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily copilot analyses" ON daily_copilot_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily copilot analyses" ON daily_copilot_analyses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily copilot analyses" ON daily_copilot_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE daily_copilot_analyses IS 'Stores daily AI copilot analyses for each user';
COMMENT ON COLUMN daily_copilot_analyses.overall_score IS 'Overall wellness score from 0-100';
COMMENT ON COLUMN daily_copilot_analyses.mood IS 'User mood rating from 1-5';
COMMENT ON COLUMN daily_copilot_analyses.sleep_hours IS 'Hours of sleep (0-24)';
COMMENT ON COLUMN daily_copilot_analyses.sleep_quality IS 'Sleep quality percentage (0-100)';
COMMENT ON COLUMN daily_copilot_analyses.health_metrics IS 'JSON object containing health metrics (steps, HRV, hydration, etc.)';
COMMENT ON COLUMN daily_copilot_analyses.recommendations IS 'JSON array of personalized recommendations';
COMMENT ON COLUMN daily_copilot_analyses.summary IS 'JSON object containing daily focus and status summary';

