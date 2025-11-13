-- Add avatar_url field to user_profiles table
-- This field stores the URL of the AI-generated avatar image

-- Add avatar_url field (TEXT to store the Supabase Storage public URL)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.avatar_url IS 'URL of the AI-generated avatar image stored in Supabase Storage';


