import { ensureAvatarBucket, supabaseAdmin, AVATAR_BUCKET } from './supabase.service';

// Bucket separato per input temporanei (privato, con signed URL)
const INPUT_BUCKET = process.env.AVATAR_INPUT_BUCKET || AVATAR_BUCKET;
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
    const seed = Number(process.env.AVATAR_SEED ?? 42);
    const input = {
      prompt: `${AVATAR_STYLE_PROMPT}

${styleRefHint}

Preserve facial geometry and distinctive features (eye spacing, nose shape, jawline, beard density if present).
Avoid over-smoothing facial structure. Use a clean vector look with soft gradients.
Background: circular purple gradient. Shirt: simple teal crew-neck.
No accessories not present in the input photo. Keep a clean, uncluttered composition.
Compose as a head-and-shoulders portrait centered within the circular background.`,
      input_image: uploadedInput, // URL gestito da Replicate o Supabase (signed se fallback)
      // Opzioni utili: dipendono dal modello
      output_format: 'png',
      width: 1024,
      height: 1024,
      // Seed per riproducibilità (configurabile via ENV)
      seed,
      // Nota: strength/guidance potrebbero essere supportati dal modello, ma non li forziamo
      // per compatibilità. Se necessario, aggiungere dopo test.
    };

    console.log('[Avatar] Running Replicate model: black-forest-labs/flux-kontext-pro', { seed });
    const modelStartTime = Date.now();

    // 7) Esecuzione del modello con timeout e retry logic
    const modelPromise = withRetry(
      () => replicate.run('black-forest-labs/flux-kontext-pro', { input }),
      2 // 2 retry attempts (totale 3 tentativi)
    );
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Replicate model timeout after 120s')), 120_000)
    );

    const output = await Promise.race([modelPromise, timeoutPromise]) as ReplicateOutput;
    const modelDuration = Date.now() - modelStartTime;
    console.log('[Avatar] Model completed:', { duration: `${modelDuration}ms`, seed });

    // 8) Normalizzazione output -> otteniamo un Buffer PNG
    let avatarBuffer: Buffer | null = null;
    let imageUrl: string | null = null;

    // Case A: SDK nuovo con helper .url() (controllo più robusto)
    if (output && typeof output === 'object' && 'url' in (output as any)) {
      const urlProp = (output as any).url;
      if (typeof urlProp === 'function') {
        imageUrl = urlProp();
      } else if (typeof urlProp === 'string' && urlProp.startsWith('http')) {
        imageUrl = urlProp;
      }
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
      } else if (first && typeof first === 'object' && 'url' in first) {
        const urlProp = (first as any).url;
        if (typeof urlProp === 'function') {
          imageUrl = urlProp();
        } else if (typeof urlProp === 'string' && urlProp.startsWith('http')) {
          imageUrl = urlProp;
        }
      }
    }

    // Case D: alcuni wrapper ritornano direttamente bytes (Uint8Array o ArrayBuffer)
    if (!imageUrl && output instanceof Uint8Array) {
      avatarBuffer = Buffer.from(output);
    } else if (!imageUrl && output instanceof ArrayBuffer) {
      avatarBuffer = Buffer.from(output);
    }

    // Se abbiamo un URL: scarichiamo con timeout
    if (!avatarBuffer && imageUrl) {
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

    // 10) Upload su Supabase con cacheControl aumentato e contentDisposition
    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath, avatarBuffer, {
        contentType: 'image/png',
        cacheControl: '86400', // 24 ore invece di 1 ora
        contentDisposition: 'inline', // Utile per UI web/mobile
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

