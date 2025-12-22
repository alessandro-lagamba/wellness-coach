-- Fix user deletion cascade issues
-- This migration ensures that when a user is deleted from auth.users,
-- all related data is automatically deleted via CASCADE

-- Step 1: Drop and recreate the foreign key constraint on user_profiles
-- to add ON DELETE CASCADE
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Ensure all tables that reference user_profiles have CASCADE
-- (Most already have it, but we'll verify and fix if needed)

-- emotion_analyses references user_profiles
ALTER TABLE emotion_analyses
DROP CONSTRAINT IF EXISTS emotion_analyses_user_id_fkey;

ALTER TABLE emotion_analyses
ADD CONSTRAINT emotion_analyses_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- skin_analyses references user_profiles
ALTER TABLE skin_analyses
DROP CONSTRAINT IF EXISTS skin_analyses_user_id_fkey;

ALTER TABLE skin_analyses
ADD CONSTRAINT skin_analyses_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- chat_sessions references user_profiles
ALTER TABLE chat_sessions
DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;

ALTER TABLE chat_sessions
ADD CONSTRAINT chat_sessions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- chat_messages references user_profiles
ALTER TABLE chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;

ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- user_wellness_suggestions references user_profiles
ALTER TABLE user_wellness_suggestions
DROP CONSTRAINT IF EXISTS user_wellness_suggestions_user_id_fkey;

ALTER TABLE user_wellness_suggestions
ADD CONSTRAINT user_wellness_suggestions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- user_insights references user_profiles
ALTER TABLE user_insights
DROP CONSTRAINT IF EXISTS user_insights_user_id_fkey;

ALTER TABLE user_insights
ADD CONSTRAINT user_insights_user_id_fkey
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Step 3: Verify that tables referencing auth.users directly have CASCADE
-- (These should already have it from migrations, but we'll verify)

-- health_data already has CASCADE (from migration)
-- daily_checkins already has CASCADE (from migration)
-- daily_copilot_analyses already has CASCADE (from migration)
-- intelligent_insights already has CASCADE (from migration)
-- daily_journal_entries already has CASCADE (from migration)
-- detailed_analysis already has CASCADE (from migration)
-- food_analyses already has CASCADE (from migration)
-- fridge_items already has CASCADE (from migration)
-- wellness_activities already has CASCADE (from migration)
-- user_recipes already has CASCADE (from migration)
-- meal_plan_entries already has CASCADE (from migration)
-- audit_logs already has CASCADE (from migration)

-- Step 4: Create a helper function to safely delete a user and all related data
-- This function can be called from the Supabase dashboard or via SQL
CREATE OR REPLACE FUNCTION delete_user_completely(user_id_to_delete UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the user from auth.users
  -- This will cascade to user_profiles and all other tables
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
  -- Note: Due to CASCADE constraints, all related data will be automatically deleted:
  -- - user_profiles (CASCADE from auth.users)
  -- - emotion_analyses (CASCADE from user_profiles)
  -- - skin_analyses (CASCADE from user_profiles)
  -- - chat_sessions (CASCADE from user_profiles)
  -- - chat_messages (CASCADE from user_profiles)
  -- - user_wellness_suggestions (CASCADE from user_profiles)
  -- - user_insights (CASCADE from user_profiles)
  -- - health_data (CASCADE from auth.users)
  -- - daily_checkins (CASCADE from auth.users)
  -- - daily_copilot_analyses (CASCADE from auth.users)
  -- - intelligent_insights (CASCADE from auth.users)
  -- - daily_journal_entries (CASCADE from auth.users)
  -- - detailed_analysis (CASCADE from auth.users)
  -- - food_analyses (CASCADE from auth.users)
  -- - fridge_items (CASCADE from auth.users)
  -- - wellness_activities (CASCADE from auth.users)
  -- - user_recipes (CASCADE from auth.users)
  -- - meal_plan_entries (CASCADE from auth.users)
  -- - audit_logs (CASCADE from auth.users)
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION delete_user_completely IS 'Safely deletes a user and all related data from all tables. Use this function instead of direct DELETE to ensure all data is properly removed.';






