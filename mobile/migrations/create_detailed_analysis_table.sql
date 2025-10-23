-- Create detailed_analysis table for storing AI-generated detailed analysis responses
CREATE TABLE IF NOT EXISTS detailed_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('emotion', 'skin')),
  analysis_date DATE NOT NULL,
  analysis_data JSONB NOT NULL DEFAULT '{}',
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per analysis type per day
  UNIQUE(user_id, analysis_type, analysis_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_detailed_analysis_user_type_date 
ON detailed_analysis(user_id, analysis_type, analysis_date);

CREATE INDEX IF NOT EXISTS idx_detailed_analysis_created_at 
ON detailed_analysis(created_at);

-- Enable Row Level Security
ALTER TABLE detailed_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own detailed analysis" ON detailed_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own detailed analysis" ON detailed_analysis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own detailed analysis" ON detailed_analysis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own detailed analysis" ON detailed_analysis
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
CREATE TRIGGER update_detailed_analysis_updated_at 
  BEFORE UPDATE ON detailed_analysis 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE detailed_analysis IS 'Stores AI-generated detailed analysis responses for emotion and skin analysis';

