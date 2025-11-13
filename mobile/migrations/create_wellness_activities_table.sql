-- Create wellness_activities table for storing user-scheduled wellness activities
CREATE TABLE IF NOT EXISTS wellness_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('mindfulness', 'movement', 'nutrition', 'recovery')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  completed BOOLEAN DEFAULT false,
  reminder_id TEXT,
  calendar_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wellness_activities_user_id ON wellness_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_activities_date ON wellness_activities(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_wellness_activities_user_date ON wellness_activities(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_wellness_activities_completed ON wellness_activities(completed);

-- Enable Row Level Security
ALTER TABLE wellness_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own wellness activities" ON wellness_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wellness activities" ON wellness_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wellness activities" ON wellness_activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wellness activities" ON wellness_activities
  FOR DELETE USING (auth.uid() = user_id);

