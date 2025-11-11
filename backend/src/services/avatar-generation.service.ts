import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import Replicate from 'replicate';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

// Prompt di stile (testuale) — niente più Vision step
const AVATAR_STYLE_PROMPT = `
Create a clean, modern wellness coach avatar illustration in a soft vector style:

- Flat design with clean lines and minimal shading
- Soft gradients and smooth lighting
- Circular purple background (gradient from #6b21a8 to #9d4edd)
- Simple teal/turquoise crew-neck t-shirt
- Friendly, approachable expression
- Professional, modern, cartoon-like
- Vector-like quality, smooth shapes, minimal noise

IMPORTANT:

- Preserve the person's identity and facial features from the input photo (same face, skin tone, eye color, hair/baldness, beard/mustache if present).
- Preserve facial geometry and distinctive features (eye spacing, nose shape, jawline, beard density if present).
- Avoid over-smoothing facial structure.
- Keep proportions realistic but in a clean, simplified vector aesthetic.
- The result MUST clearly look like the same person, just stylized.
- Match the person's perceived gender expression as in the photo.
`;

interface GenerateAvatarParams {
  userId: string;
  photoBuffer: Buffer;
  mimeType?: string;
}

type ReplicateOutput = string | Uint8Array | { url: () => string } | Array<string | { url: () => string }>;

interface AvatarGenerationResult {
  avatarUrl: string;
  storagePath: string;
  bucket: string;
  model: string;
  seed: number;
  size: string;
}

export const generateAvatarFromPhoto = async ({
  userId,
  photoBuffer,
  mimeType = 'image/jpeg',
}: GenerateAvatarParams) => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  await ensureAvatarBucket();

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN!,
  });

  const startTime = Date.now();
  let tempInputPath: string | null = null;

  try {
    // 1) Preprocessing: rilevamento MIME e square crop + resize
    const type = await fileTypeFromBuffer(photoBuffer);
    const safeMime = type?.mime ?? mimeType ?? 'image/jpeg';
    
    console.log('[Avatar] Processing image:', { 
      detectedMime: type?.mime, 
      providedMime: mimeType, 
      finalMime: safeMime,
      bufferSize: photoBuffer.length 
    });

    // Square crop + resize 1024x1024 con attention (centra il volto)
    const processedBuffer = await sharp(photoBuffer)
      .resize(1024, 1024, { fit: 'cover', position: 'attention' })
      .toFormat('png')
      .toBuffer();

    console.log('[Avatar] Image processed:', { 
      originalSize: photoBuffer.length, 
      processedSize: processedBuffer.length 
    });

    // 2) Idempotenza: hash del buffer per naming
    const digest = createHash('sha256').update(processedBuffer).digest('hex').slice(0, 16);
    const filename = `photo-${Date.now()}.png`;

    // 3) (Facoltativo) se troviamo il file "avatar-icon.png" lo usiamo per arricchire il prompt
    const possiblePaths = [
      path.join(__dirname, '../../mobile/assets/avatar-icon.png'),
      path.join(__dirname, '../assets/avatar-icon.png'),
      path.join(process.cwd(), 'mobile/assets/avatar-icon.png'),
      path.join(process.cwd(), 'assets/avatar-icon.png'),
    ];

    let hasLocalStyleRef = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        hasLocalStyleRef = true;
        break;
      }
    }

    const styleRefHint = hasLocalStyleRef
      ? `Match the style of the internal reference icon (clean vector look, soft gradients, circular purple background, teal t-shirt).`
      : `Use the described style precisely (clean vector look, soft gradients, circular purple background, teal t-shirt).`;

    // 4) Carica la foto dell'utente su Replicate come file (SDK recente)
    // Type assertion per files.upload che può non essere nel tipo ma esiste nell'SDK
    const replicateWithFiles = replicate as any;
    let uploadedInput: string | null = null;

    try {
      uploadedInput = await replicateWithFiles.files?.upload?.(processedBuffer, {
        filename,
        contentType: 'image/png',
      });
    } catch (uploadError) {
      console.warn('[Avatar] Replicate files.upload failed, using fallback:', uploadError);
    }

    // 5) Fallback: se files.upload non esiste, carica temporaneamente su Supabase
    if (!uploadedInput) {
      console.log('[Avatar] Using Supabase fallback for input image');
      tempInputPath = `${userId}/inputs/${Date.now()}-input.png`;
      
      const { error: tempUploadError } = await supabaseAdmin.storage
        .from(AVATAR_BUCKET)
        .upload(tempInputPath, processedBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (tempUploadError) {
        throw new Error(`Failed to upload temp input to Supabase: ${tempUploadError.message}`);
      }

      const { data: tempUrlData } = supabaseAdmin.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(tempInputPath);
      
      uploadedInput = tempUrlData?.publicUrl || null;
      
      if (!uploadedInput) {
        throw new Error('Failed to get public URL for temp input');
      }
      
      console.log('[Avatar] Temp input uploaded to Supabase:', tempInputPath);
    }

    // 6) Costruisci l'input del modello
    //    FLUX Kontext Pro è un img2img/stylizer: diamo un prompt "descrittivo dello stile" e la foto come conditioning
    const input = {
      prompt: `${AVATAR_STYLE_PROMPT}

${styleRefHint}

Preserve facial geometry and distinctive features (eye spacing, nose shape, jawline, beard density if present).
Avoid over-smoothing facial structure. Use a clean vector look with soft gradients.
Background: circular purple gradient. Shirt: simple teal crew-neck.`,
      input_image: uploadedInput, // URL gestito da Replicate o Supabase
      // Opzioni utili: dipendono dal modello
      output_format: 'png',
      width: 1024,
      height: 1024,
      // Seed per riproducibilità
      seed: 42,
    };

    console.log('[Avatar] Running Replicate model: black-forest-labs/flux-kontext-pro');
    const modelStartTime = Date.now();

    // 7) Esecuzione del modello con timeout
    const modelPromise = replicate.run('black-forest-labs/flux-kontext-pro', { input });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Replicate model timeout after 120s')), 120_000)
    );

    const output = await Promise.race([modelPromise, timeoutPromise]) as ReplicateOutput;
    const modelDuration = Date.now() - modelStartTime;
    console.log('[Avatar] Model completed:', { duration: `${modelDuration}ms` });

    // 8) Normalizzazione output -> otteniamo un Buffer PNG
    let avatarBuffer: Buffer | null = null;
    let imageUrl: string | null = null;

    // Case A: SDK nuovo con helper .url()
    if (output && typeof (output as any).url === 'function') {
      imageUrl = (output as any).url();
    }

    // Case B: output = string URL
    if (!imageUrl && typeof output === 'string') {
      const outputStr = output as string;
      if (outputStr.startsWith('http')) {
        imageUrl = outputStr;
      }
    }

    // Case C: output = array di URL/string/oggetti
    if (!imageUrl && Array.isArray(output) && output.length > 0) {
      const first = output[0];
      if (typeof first === 'string' && first.startsWith('http')) {
        imageUrl = first;
      } else if (first && typeof (first as any).url === 'function') {
        imageUrl = (first as any).url();
      }
    }

    // Case D: alcuni wrapper ritornano direttamente bytes (Uint8Array)
    if (!imageUrl && output instanceof Uint8Array) {
      avatarBuffer = Buffer.from(output);
    }

    // Se abbiamo un URL: scarichiamo con timeout
    if (!avatarBuffer && imageUrl) {
      console.log('[Avatar] Downloading image from:', imageUrl.substring(0, 50) + '...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      
      try {
        const res = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!res.ok) {
          throw new Error(`Failed to download image from Replicate: ${res.status} ${res.statusText}`);
        }
        
        const arr = await res.arrayBuffer();
        avatarBuffer = Buffer.from(arr);
        console.log('[Avatar] Image downloaded:', { size: avatarBuffer.length });
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Download timeout after 30s');
        }
        throw fetchError;
      }
    }

    if (!avatarBuffer) {
      throw new Error('No image produced by Replicate (missing URL or bytes).');
    }

    // 9) Naming idempotente con hash
    const avatarPath = `${userId}/avatar-${Date.now()}-${digest}.png`;

    // 10) Upload su Supabase con cacheControl aumentato
    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath, avatarBuffer, {
        contentType: 'image/png',
        cacheControl: '86400', // 24 ore invece di 1 ora
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

    // 11) Update user profile with new avatar URL
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id');

    if (updateError) {
      // Se l'update fallisce, logga ma non blocca (l'avatar è comunque salvato)
      console.error('[Avatar] Failed to update user profile:', updateError);
    }

    if (!updatedProfile || updatedProfile.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({ id: userId, avatar_url: publicUrl });

      if (insertError && insertError.code !== '23505') {
        console.error('[Avatar] Failed to insert user profile:', insertError);
      }
    }

    // 12) Pulizia input temporaneo se usato
    if (tempInputPath) {
      try {
        await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([tempInputPath]);
        console.log('[Avatar] Temp input cleaned up:', tempInputPath);
      } catch (cleanupError) {
        console.warn('[Avatar] Failed to cleanup temp input (non-critical):', cleanupError);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log('[Avatar] Generation completed:', {
      userId,
      duration: `${totalDuration}ms`,
      model: 'black-forest-labs/flux-kontext-pro',
      seed: 42,
      size: '1024x1024',
    });

    // 13) Restituisci metadati utili
    const result: AvatarGenerationResult = {
      avatarUrl: publicUrl,
      storagePath: avatarPath,
      bucket: AVATAR_BUCKET,
      model: 'black-forest-labs/flux-kontext-pro',
      seed: 42,
      size: '1024x1024',
    };

    return result;
  } catch (error) {
    // Pulizia input temporaneo anche in caso di errore
    if (tempInputPath) {
      try {
        await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([tempInputPath]);
        console.log('[Avatar] Temp input cleaned up after error:', tempInputPath);
      } catch (cleanupError) {
        console.warn('[Avatar] Failed to cleanup temp input after error (non-critical):', cleanupError);
      }
    }

    console.error('[Avatar] Error in generateAvatarFromPhoto:', error);
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Avatar generation failed: ${error.message}`);
    }
    throw error;
  }
};

