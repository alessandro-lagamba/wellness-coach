-- Add mood_note and sleep_note fields to daily_copilot_analyses table
-- These fields store user notes for mood and sleep check-ins

-- Add mood_note field (TEXT to store user notes about their mood)
ALTER TABLE daily_copilot_analyses 
ADD COLUMN IF NOT EXISTS mood_note TEXT;

-- Add sleep_note field (TEXT to store user notes about their sleep)
ALTER TABLE daily_copilot_analyses 
ADD COLUMN IF NOT EXISTS sleep_note TEXT;

-- Add comments for documentation
COMMENT ON COLUMN daily_copilot_analyses.mood_note IS 'User notes about their mood for the day';
COMMENT ON COLUMN daily_copilot_analyses.sleep_note IS 'User notes about their sleep/rest for the day';


