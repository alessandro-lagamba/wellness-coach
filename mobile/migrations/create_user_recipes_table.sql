-- Create table for storing user saved recipes
CREATE TABLE IF NOT EXISTS user_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cuisine TEXT,
  meal_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  servings INTEGER DEFAULT 1,
  ready_in_minutes INTEGER,
  total_minutes INTEGER,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  ingredients JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  tips JSONB DEFAULT '[]'::jsonb,
  calories_per_serving NUMERIC,
  macros JSONB,
  favorite BOOLEAN DEFAULT false,
  source TEXT,
  notes TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recipes_user_id ON user_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recipes_favorite ON user_recipes(user_id, favorite) WHERE favorite = true;
CREATE INDEX IF NOT EXISTS idx_user_recipes_updated_at ON user_recipes(user_id, updated_at DESC);

ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their recipes" ON user_recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their recipes" ON user_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their recipes" ON user_recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their recipes" ON user_recipes
  FOR DELETE USING (auth.uid() = user_id);



