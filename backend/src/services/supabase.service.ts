import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let avatarBucketInitialized = false;

export const ensureAvatarBucket = async (): Promise<string> => {
  if (avatarBucketInitialized) {
    return AVATAR_BUCKET;
  }

  // Check if bucket exists
  const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(AVATAR_BUCKET);

  if (!bucket || bucketError) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });

    if (createError && !createError.message.includes('already exists')) {
      throw createError;
    }
  }

  avatarBucketInitialized = true;
  return AVATAR_BUCKET;
};

