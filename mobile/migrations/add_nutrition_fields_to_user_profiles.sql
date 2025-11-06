-- Add nutrition-related fields to user_profiles table
-- These fields are needed for food analysis functionality

-- Add weight field (in kg)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS weight DECIMAL(5, 2) CHECK (weight > 0 AND weight < 1000);

-- Add height field (in cm)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS height DECIMAL(5, 2) CHECK (height > 0 AND height < 300);

-- Add activity_level field
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS activity_level TEXT CHECK (
  activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')
);

-- Add nutritional_goals field (JSONB to store structured nutritional goals)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS nutritional_goals JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.weight IS 'User weight in kilograms';
COMMENT ON COLUMN user_profiles.height IS 'User height in centimeters';
COMMENT ON COLUMN user_profiles.activity_level IS 'User activity level for BMR/TDEE calculations';
COMMENT ON COLUMN user_profiles.nutritional_goals IS 'User nutritional goals including daily calories and macronutrient percentages';

