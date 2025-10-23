-- Create intelligent_insights table for storing AI-generated insights
CREATE TABLE IF NOT EXISTS intelligent_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('emotion', 'skin')),
  insights JSONB NOT NULL DEFAULT '[]',
  trend_summary TEXT,
  overall_score INTEGER,
  focus TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per category per day
  UNIQUE(user_id, category, analysis_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intelligent_insights_user_category_date 
ON intelligent_insights(user_id, category, analysis_date);

CREATE INDEX IF NOT EXISTS idx_intelligent_insights_created_at 
ON intelligent_insights(created_at);

-- Enable Row Level Security
ALTER TABLE intelligent_insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own intelligent insights" ON intelligent_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own intelligent insights" ON intelligent_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intelligent insights" ON intelligent_insights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intelligent insights" ON intelligent_insights
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_intelligent_insights_updated_at 
  BEFORE UPDATE ON intelligent_insights 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE intelligent_insights IS 'Stores AI-generated intelligent insights for emotion and skin analysis';
COMMENT ON COLUMN intelligent_insights.user_id IS 'Reference to the user who owns these insights';
COMMENT ON COLUMN intelligent_insights.analysis_date IS 'Date when the insights were generated (YYYY-MM-DD)';
COMMENT ON COLUMN intelligent_insights.category IS 'Type of analysis: emotion or skin';
COMMENT ON COLUMN intelligent_insights.insights IS 'JSON array of insight objects with title, description, actionType, etc.';
COMMENT ON COLUMN intelligent_insights.trend_summary IS 'AI-generated summary of trends in the data';
COMMENT ON COLUMN intelligent_insights.overall_score IS 'Overall wellness score (0-100)';
COMMENT ON COLUMN intelligent_insights.focus IS 'Main focus area for improvement';

