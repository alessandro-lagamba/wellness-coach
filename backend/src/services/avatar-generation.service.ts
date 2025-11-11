import OpenAI from 'openai';
import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';
import * as fs from 'fs';
import * as path from 'path';

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
    // Step 0: Load the reference avatar-icon.png for style reference
    // Try multiple possible paths (development and production)
    const possiblePaths = [
      path.join(__dirname, '../../mobile/assets/avatar-icon.png'),
      path.join(__dirname, '../assets/avatar-icon.png'),
      path.join(process.cwd(), 'mobile/assets/avatar-icon.png'),
      path.join(process.cwd(), 'assets/avatar-icon.png'),
    ];
    
    let avatarIconBase64: string | null = null;
    let avatarIconPath: string | null = null;
    
    // Find the avatar icon file
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        avatarIconPath = testPath;
        const avatarIconBuffer = fs.readFileSync(testPath);
        avatarIconBase64 = avatarIconBuffer.toString('base64');
        break;
      }
    }
    
    // Step 1: Analyze BOTH images together with GPT-4 Vision
    // - The user's photo for facial features
    // - The avatar-icon.png for style reference
    const photoBase64 = photoBuffer.toString('base64');
    const photoMimeType = mimeType || 'image/jpeg';
    
    const content: any[] = [
      {
        type: 'text',
        text: `Analyze these two images:
1. The first image is a portrait photo of a person
2. The second image is a reference avatar illustration showing the desired artistic style

Describe how to generate an avatar that:
- Maintains the person's facial features, skin tone, hair color and style, eye color, and overall likeness from the portrait photo
- Matches the exact artistic style, color palette, illustration technique, lighting, and aesthetic of the reference avatar

Be very specific about both the person's appearance and the style characteristics.`
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${photoMimeType};base64,${photoBase64}`,
          detail: 'high'
        }
      }
    ];
    
    // Add reference style image if available
    if (avatarIconBase64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${avatarIconBase64}`,
          detail: 'high'
        }
      });
      console.log('[Avatar] Using avatar-icon.png as style reference');
    } else {
      console.warn('[Avatar] Reference avatar-icon.png not found, generating without style reference');
    }
    
    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content
        }
      ],
      max_tokens: 400
    });
    
    const combinedDescription = visionResponse.choices[0]?.message?.content || '';
    
    // Step 2: Build the enhanced prompt with the combined description
    const enhancedPrompt = `${AVATAR_PROMPT}\n\n${combinedDescription}\n\nGenerate an avatar that exactly matches these specifications.`;
    
    // Step 3: Generate the avatar using DALL-E 3 (doesn't require billing/verification)
    const generateResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      quality: 'standard',
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

