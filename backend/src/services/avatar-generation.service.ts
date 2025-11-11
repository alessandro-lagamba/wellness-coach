import OpenAI from 'openai';
import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';
import * as fs from 'fs';
import * as path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Base prompt for avatar generation - style reference
const AVATAR_PROMPT = `
Create a clean, modern wellness coach avatar illustration in soft vector style matching the reference style exactly:
- Flat design with clean lines and minimal shading
- Soft gradients and smooth lighting
- Circular purple background with gradient from #6b21a8 (darker purple) to #9d4edd (lighter purple)
- Simple teal/turquoise crew-neck t-shirt
- Cartoon-like but professional aesthetic
- Friendly, approachable expression
- Vector illustration quality, modern and clean
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
        text: `Analyze these two images carefully:
1. The FIRST image is a REAL PHOTOGRAPH of a person - this is the PRIMARY REFERENCE for the person's actual appearance
2. The SECOND image is a reference avatar illustration showing the desired artistic STYLE only

CRITICAL INSTRUCTIONS:
- The person's PHYSICAL APPEARANCE must be EXACTLY as shown in the first photo:
  * If the person is BALD (no hair), the avatar MUST be BALD - no hair at all
  * If the person has hair, describe the EXACT hair color, length, and style
  * Describe the EXACT facial features: eye color, skin tone, face shape, any distinctive features
  * Describe the EXACT clothing if visible
  * Be extremely precise about physical characteristics - the avatar must look like the SAME PERSON

- The artistic STYLE must match the second image (reference avatar):
  * Flat vector illustration style
  * Soft gradients and lighting
  * Circular purple background with gradient (#6b21a8 to #9d4edd)
  * Clean, modern, cartoon-like but professional
  * Simple teal crew-neck t-shirt
  * Minimal shading, clean lines

Generate a detailed description that prioritizes the PERSON'S ACTUAL APPEARANCE from the photo, then applies the artistic style from the reference.`
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
    
    // Step 2: Build the enhanced prompt with STRONG emphasis on physical appearance
    const enhancedPrompt = `${AVATAR_PROMPT}

CRITICAL: The person's physical appearance from the photo is the MOST IMPORTANT aspect. Follow these priorities:
1. FIRST: Accurately represent the person's physical features from the photo (especially hair/baldness, facial features, skin tone, eye color)
2. SECOND: Apply the artistic style from the reference avatar

Detailed description from photo analysis:
${combinedDescription}

IMPORTANT REMINDERS:
- If the person is BALD in the photo, the avatar MUST be completely BALD (no hair, no stubble, smooth head)
- If the person has hair, show the EXACT hair color, length, and style from the photo
- Match the EXACT skin tone, eye color, and facial features from the photo
- The person's likeness must be clearly recognizable
- Apply the reference style's color palette, gradients, and illustration technique
- Use the circular purple gradient background as shown in the reference
- Keep the simple teal crew-neck t-shirt style

Generate an avatar that is FIRST AND FOREMOST an accurate representation of the person from the photo, styled in the reference illustration aesthetic.`;
    
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

