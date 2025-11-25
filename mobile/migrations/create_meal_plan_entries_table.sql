-- Create table for weekly meal planning
CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id UUID REFERENCES user_recipes(id) ON DELETE SET NULL,
  custom_recipe JSONB,
  servings INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, plan_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_user_date ON meal_plan_entries(user_id, plan_date);

ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY.

CREATE POLICY "Users can select their meal plans" ON meal_plan_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their meal plans" ON meal_plan_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their meal plans" ON meal_plan_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their meal plans" ON meal_plan_entries
  FOR DELETE USING (auth.uid() = user_id);



