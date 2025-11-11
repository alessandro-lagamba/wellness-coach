-- Create food_analyses table for storing food analysis results
CREATE TABLE IF NOT EXISTS food_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  identified_foods TEXT[] NOT NULL DEFAULT '{}',
  calories DECIMAL(10, 2) NOT NULL CHECK (calories >= 0),
  carbohydrates DECIMAL(10, 2) NOT NULL CHECK (carbohydrates >= 0),
  proteins DECIMAL(10, 2) NOT NULL CHECK (proteins >= 0),
  fats DECIMAL(10, 2) NOT NULL CHECK (fats >= 0),
  fiber DECIMAL(10, 2) CHECK (fiber >= 0),
  vitamins JSONB DEFAULT '{}',
  minerals JSONB DEFAULT '{}',
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  observations TEXT[] NOT NULL DEFAULT '{}',
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  analysis_data JSONB DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_food_analyses_user_id ON food_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_food_analyses_created_at ON food_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_food_analyses_user_created ON food_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_analyses_meal_type ON food_analyses(meal_type);

-- Enable Row Level Security
ALTER TABLE food_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own food analyses" ON food_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food analyses" ON food_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food analyses" ON food_analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food analyses" ON food_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_food_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_food_analyses_updated_at 
  BEFORE UPDATE ON food_analyses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_food_analyses_updated_at();

-- Add comments for documentation
COMMENT ON TABLE food_analyses IS 'Stores food analysis results including macronutrients, vitamins, minerals, and health scores';



