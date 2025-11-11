import OpenAI from 'openai';
import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced prompt for gpt-image-1-mini generation
// Since gpt-image-1-mini generates from scratch, we'll use a detailed description
const AVATAR_PROMPT = `
A clean, modern wellness coach illustration in soft vector style.
The character has a smiling expression and friendly eyes.
The illustration uses smooth gradients and soft lighting.
The character is placed inside a circular purple background with gradient from #6b21a8 to #9d4edd.
The clothing is simple, like a teal crew-neck.
The style is cartoon-like, modern, and professional.
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

  try {
    // Use gpt-image-1-mini with images.generate (not images.edit)
    // This model generates images from scratch based on a prompt
    // We'll use the photo as a reference by analyzing it first with GPT-4 Vision
    // to extract features, then generate the avatar with those features
    
    // Step 1: Analyze the photo with GPT-4 Vision to extract facial features
    const photoBase64 = photoBuffer.toString('base64');
    const photoMimeType = mimeType || 'image/jpeg';
    
    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this portrait photo and describe the person's facial features, skin tone, hair color and style, eye color, and overall appearance. Be specific about these details as they will be used to generate a stylized avatar that maintains the person's likeness.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${photoMimeType};base64,${photoBase64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 200
    });
    
    const personDescription = visionResponse.choices[0]?.message?.content || '';
    
    // Step 2: Combine the person description with the avatar style prompt
    const enhancedPrompt = `${AVATAR_PROMPT}\n\nBased on this person's appearance: ${personDescription}\n\nGenerate an avatar that maintains their facial features, skin tone, hair, and overall likeness while applying the described illustration style.`;
    
    // Step 3: Generate the avatar using gpt-image-1-mini with quality medium
    // Note: gpt-image-1-mini doesn't support response_format parameter
    // It returns URLs by default, so we'll download the image from the URL
    const generateResponse = await openai.images.generate({
      model: 'gpt-image-1-mini',
      prompt: enhancedPrompt,
      quality: 'medium',
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = generateResponse.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    // Download the image from the URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image from OpenAI: ${imageResponse.statusText}`);
    }

    const avatarBuffer = Buffer.from(await imageResponse.arrayBuffer());
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

