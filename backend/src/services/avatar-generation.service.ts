import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import Replicate from 'replicate';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

// Bucket separato per input temporanei (privato, con signed URL)
const INPUT_BUCKET = process.env.AVATAR_INPUT_BUCKET || AVATAR_BUCKET;

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

type ReplicateOutput = string | Uint8Array | ArrayBuffer | { url: () => string } | Array<string | { url: () => string }>;

interface AvatarGenerationResult {
  avatarUrl: string;
  storagePath: string;
  bucket: string;
  model: string;
  seed: number;
  size: string;
  inferenceMs?: number;
  totalMs?: number;
}

// Retry utility con exponential backoff per errori transient
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  retryableStatuses = [429, 500, 502, 503, 504]
): Promise<T> {
  let lastErr: unknown;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status ?? e?.statusCode;
      
      // Se non è un errore retryable, break immediatamente
      if (status && !retryableStatuses.includes(status)) {
        break;
      }
      
      // Se è l'ultimo tentativo, throw
      if (i === retries) {
        break;
      }
      
      // Exponential backoff: 800ms, 1600ms, 2400ms...
      const delay = 800 * (i + 1);
      console.log(`[Avatar] Retry attempt ${i + 1}/${retries} after ${delay}ms (status: ${status})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastErr;
}

export const generateAvatarFromPhoto = async ({
  userId,
  photoBuffer,
  mimeType = 'image/jpeg',
}: GenerateAvatarParams): Promise<AvatarGenerationResult> => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  await ensureAvatarBucket();

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN!,
  });

  const startTime = Date.now();
  let tempInputPath: string | null = null;
  let needCleanup = false;

  try {
    // 1) Preprocessing: rilevamento MIME e square crop + resize
    const type = await fileTypeFromBuffer(photoBuffer);
    const detectedMime = type?.mime ?? mimeType ?? 'image/jpeg';
    
    // Validazione: solo immagini supportate
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]);
    
    if (!allowedMimeTypes.has(detectedMime)) {
      throw new Error(`Unsupported image type: ${detectedMime}. Supported types: JPEG, PNG, WebP, HEIC, HEIF`);
    }
    
    console.log('[Avatar] Processing image:', { 
      detectedMime: type?.mime, 
      providedMime: mimeType, 
      finalMime: detectedMime,
      bufferSize: photoBuffer.length 
    });

    // Resize conservativo: non taglia, aggiunge padding neutro
    const processedBuffer = await sharp(photoBuffer)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    console.log('[Avatar] Image processed:', { 
      originalSize: photoBuffer.length, 
      processedSize: processedBuffer.length 
    });

    // 2) Idempotenza: hash del buffer per naming
    const digest = createHash('sha256').update(processedBuffer).digest('hex').slice(0, 16);
    const filename = `photo-${Date.now()}.png`;

    // 4) Carica la foto dell'utente su Replicate come file (SDK recente)
    // Type assertion per files.upload che può non essere nel tipo ma esiste nell'SDK
    const replicateWithFiles = replicate as any;
    let uploadedInput: string | null = null;

    // Log SDK version per debugging
    const sdkVersion = (replicate as any).version || 'unknown';
    console.log('[Avatar] Replicate SDK version:', sdkVersion);

    try {
      uploadedInput = await replicateWithFiles.files?.upload?.(processedBuffer, {
        filename,
        contentType: 'image/png',
      });
      if (uploadedInput) {
        console.log('[Avatar] Image uploaded via Replicate files.upload');
      }
    } catch (uploadError) {
      console.warn('[Avatar] Replicate files.upload failed, using Supabase fallback:', uploadError);
      console.warn('[Avatar] Tip: Update Replicate SDK to @latest if this persists');
    }

    // 5) Fallback: se files.upload non esiste, carica temporaneamente su Supabase con SIGNED URL
    // Usa signed URL per privacy (TTL 15 minuti) invece di public URL
    // Usa bucket separato per input se configurato (AVATAR_INPUT_BUCKET)
    if (!uploadedInput) {
      console.log('[Avatar] Using Supabase fallback with signed URL for input image', { bucket: INPUT_BUCKET });
      tempInputPath = `${userId}/inputs/${Date.now()}-input.png`;
      needCleanup = true;
      
      const { error: tempUploadError } = await supabaseAdmin.storage
        .from(INPUT_BUCKET)
        .upload(tempInputPath, processedBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (tempUploadError) {
        throw new Error(`Failed to upload temp input to Supabase: ${tempUploadError.message}`);
      }

      // Crea signed URL con TTL di 15 minuti (900 secondi) per privacy
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from(INPUT_BUCKET)
        .createSignedUrl(tempInputPath, 15 * 60); // 15 minuti
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed URL for temp input: ${signedUrlError?.message || 'unknown error'}`);
      }
      
      uploadedInput = signedUrlData.signedUrl;
      console.log('[Avatar] Temp input uploaded to Supabase with signed URL (TTL: 15min):', tempInputPath);
    }

    // 6) Costruisci l'input del modello
    //    FLUX Kontext Pro è un img2img/stylizer: diamo un prompt "descrittivo dello stile" e la foto come conditioning
    //    Usiamo seed random per evitare risultati simili tra generazioni
    const seed = process.env.AVATAR_SEED 
      ? Number(process.env.AVATAR_SEED) 
      : Math.floor(Math.random() * 1000000);
    
    // Prompt semplificato per stile 90s cartoon
    // Mantiene l'identità della persona ma applica lo stile cartoon degli anni 90
    const identityPrompt = `Make this a 90s cartoon`;

    // Input del modello: solo parametri supportati da flux-kontext-pro
    const input: any = {
      prompt: identityPrompt,
      input_image: uploadedInput,
      aspect_ratio: 'match_input_image',
      output_format: 'png',
      safety_tolerance: 2,
      seed,
      // opzionale: spesso meglio OFF per non alterare il testo
      // prompt_upsampling: false,
    };

    console.log('[Avatar] Running Replicate model: black-forest-labs/flux-kontext-pro', { seed });
    const modelStartTime = Date.now();

    // 7) Esecuzione del modello con predictions API per audit e migliore controllo
    // Nota: Replicate gestisce i timeout internamente, non possiamo specificare un timeout personalizzato
    const prediction = await withRetry(
      () => (replicate as any).predictions.create({
        model: 'black-forest-labs/flux-kontext-pro',
        input,
        wait: true,
      }),
      2 // 2 retry attempts (totale 3 tentativi)
    ) as any;

    const modelDuration = Date.now() - modelStartTime;
    console.log('[Avatar] Model completed:', { 
      duration: `${modelDuration}ms`, 
      seed,
      predictTime: prediction.metrics?.predict_time ? `${Math.round(prediction.metrics.predict_time * 1000)}ms` : 'unknown'
    });

    // Estrai l'URL dell'immagine generata
    let imageUrl: string | undefined;
    if (typeof prediction.output === 'string') {
      imageUrl = prediction.output;
    } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
      imageUrl = typeof prediction.output[0] === 'string' ? prediction.output[0] : undefined;
    }

    if (!imageUrl) {
      throw new Error('No image URL in prediction output');
    }

    // (Facoltativo) Log per audit - possiamo persistere in DB se necessario
    console.log('[Avatar] Prediction details:', {
      inputImageUrl: prediction.input?.input_image ? prediction.input.input_image.substring(0, 50) + '...' : 'unknown',
      promptLength: prediction.input?.prompt?.length || 0,
      outputUrl: imageUrl.substring(0, 50) + '...',
    });

    // 8) Download dell'immagine generata da Replicate
    let avatarBuffer: Buffer | null = null;

    // Scarichiamo l'immagine dall'URL fornito da Replicate
    if (imageUrl && imageUrl.startsWith('http')) {
      console.log('[Avatar] Downloading image from:', imageUrl.substring(0, 50) + '...');
      
      // Fallback fetch per Node <18 (lazy import)
      let doFetch: typeof fetch;
      if (typeof globalThis.fetch === 'function') {
        doFetch = globalThis.fetch;
      } else {
        console.warn('[Avatar] fetch not available globally, using node-fetch fallback');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeFetch = require('node-fetch');
        doFetch = nodeFetch as unknown as typeof fetch;
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      
      try {
        const res = await doFetch(imageUrl, { signal: controller.signal });
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
    // Nota: contentDisposition non è supportato direttamente in FileOptions di Supabase
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

    const totalDuration = Date.now() - startTime;
    const modelName = 'black-forest-labs/flux-kontext-pro';
    console.log('[Avatar] Generation completed:', {
      userId: userId.substring(0, 8) + '...', // Log parziale per privacy
      duration: `${totalDuration}ms`,
      inferenceMs: modelDuration,
      model: modelName,
      seed,
      size: '1024x1024',
    });

    // 13) Restituisci metadati utili con telemetria
    const result: AvatarGenerationResult = {
      avatarUrl: publicUrl,
      storagePath: avatarPath,
      bucket: AVATAR_BUCKET,
      model: modelName,
      seed,
      size: '1024x1024',
      inferenceMs: modelDuration,
      totalMs: totalDuration,
    };

    return result;
  } catch (error) {
    console.error('[Avatar] Error in generateAvatarFromPhoto:', error);
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Avatar generation failed: ${error.message}`);
    }
    throw error;
  } finally {
    // 12) Pulizia input temporaneo se usato (con delay per evitare race condition)
    // Aspettiamo 5 secondi dopo il download per assicurarci che Replicate abbia finito di leggere
    if (tempInputPath && needCleanup) {
      // Delay per evitare race condition: Replicate potrebbe ancora star leggendo l'URL
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        await supabaseAdmin.storage.from(INPUT_BUCKET).remove([tempInputPath]);
        console.log('[Avatar] Temp input cleaned up:', tempInputPath);
      } catch (cleanupError) {
        console.warn('[Avatar] Failed to cleanup temp input (non-critical):', cleanupError);
        // Nota: Il signed URL scadrà comunque dopo 15 minuti, quindi non è critico
      }
    }
  }
};

