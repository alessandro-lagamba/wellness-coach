import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AVATAR_PROMPT = `
Convert the provided portrait photo into a clean, modern wellness coach illustration.
Maintain the person's facial features, skin tone, hair shape, and overall likeness.
Use a soft vector style with smooth gradients, smiling expression, and friendly eyes.
Place the character inside a circular purple background (#6b21a8 → #9d4edd gradient) with soft lighting.
Keep clothing simple (eg. teal crew-neck), and remove any busy background elements.
`;

interface GenerateAvatarParams {
  userId: string;
  photoBuffer: Buffer;
  mimeType?: string;
}

export const generateAvatarFromPhoto = async ({ userId, photoBuffer, mimeType = 'image/jpeg' }: GenerateAvatarParams) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  await ensureAvatarBucket();

  const fileName = `source-${Date.now()}.png`;
  const uploadable = await toFile(photoBuffer, fileName, { type: mimeType });

  const editResponse = await openai.images.edit({
    model: 'gpt-image-1',
    prompt: AVATAR_PROMPT,
    image: uploadable,
    size: '512x512',
    background: 'opaque',
    response_format: 'b64_json',
    quality: 'high',
    input_fidelity: 'high',
  });

  const imageData = editResponse.data?.[0]?.b64_json;
  if (!imageData) {
    throw new Error('No image returned from OpenAI');
  }

  const avatarBuffer = Buffer.from(imageData, 'base64');
  const avatarPath = `${userId}/avatar-${Date.now()}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, avatarBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const publicUrl = publicUrlData?.publicUrl;

  if (!publicUrl) {
    throw new Error('Failed to generate public URL for avatar');
  }

  // Update user profile with new avatar URL
  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id');

  if (updateError) {
    throw updateError;
  }

  if (!updatedProfile || updatedProfile.length === 0) {
    const { error: insertError } = await supabaseAdmin
      .from('user_profiles')
      .insert({ id: userId, avatar_url: publicUrl });

    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }
  }

  return {
    avatarUrl: publicUrl,
    storagePath: avatarPath,
    bucket: AVATAR_BUCKET,
  };
};

