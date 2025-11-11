import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';
import sharp from 'sharp';

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

  // Convert image to PNG if needed (OpenAI images.edit requires PNG format)
  let processedImageBuffer: Buffer;
  let processedMimeType: string;
  
  if (mimeType && mimeType !== 'image/png') {
    // Convert to PNG using sharp
    processedImageBuffer = await sharp(photoBuffer)
      .png()
      .toBuffer();
    processedMimeType = 'image/png';
  } else {
    processedImageBuffer = photoBuffer;
    processedMimeType = mimeType || 'image/png';
  }

  const fileName = `source-${Date.now()}.png`;
  const uploadable = await toFile(processedImageBuffer, fileName, { type: processedMimeType });

  try {
    // Use images.edit with a white mask to edit the entire image
    // A white mask means "edit this area", so a fully white mask edits the whole image
    // We'll create a white PNG mask of the same size as the image
    
    // Get image dimensions to create matching mask
    const imageMetadata = await sharp(processedImageBuffer).metadata();
    const width = imageMetadata.width || 512;
    const height = imageMetadata.height || 512;
    
    // Create a white (fully editable) mask
    const whiteMaskBuffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .png()
    .toBuffer();
    
    const maskFile = await toFile(whiteMaskBuffer, `mask-${Date.now()}.png`, { type: 'image/png' });
    
    // Now use images.edit with the white mask to edit the entire image
    const editResponse = await openai.images.edit({
      image: uploadable,
      mask: maskFile,
      prompt: AVATAR_PROMPT,
      n: 1,
      size: '512x512',
      response_format: 'b64_json',
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
  } catch (error) {
    console.error('[Avatar] Error in generateAvatarFromPhoto:', error);
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Avatar generation failed: ${error.message}`);
    }
    throw error;
  }
};

