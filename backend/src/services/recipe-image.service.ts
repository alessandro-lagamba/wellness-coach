import fetch from "node-fetch";
import { supabaseAdmin } from "./supabase.service";

/**
 * Normalize a recipe title to a cache key:
 * - lowercase
 * - trim spaces
 * - collapse multiple spaces
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Enhance prompt using deAPI prompt enhancement endpoint with strict ingredient control
 */
async function enhancePrompt(
  title: string,
  ingredients: string[] | undefined,
  apiKey: string
): Promise<string> {
  const ENHANCE_ENDPOINT = "https://api.deapi.ai/api/v1/client/prompt/image";

  try {
    console.log("[RecipeImage] 🔮 Enhancing prompt:", title);

    // Crea un prompt con istruzioni specifiche per limitare gli ingredienti
    let enhancementPrompt = `Professional food photography prompt for: "${title}".`;

    if (ingredients && ingredients.length > 0) {
      const ingredientsList = ingredients.slice(0, 8).join(", ");
      enhancementPrompt += ` CRITICAL: The dish must contain ONLY these ingredients: ${ingredientsList}. Do not add any other ingredients, garnishes, herbs, or toppings not in this list.`;
    }

    enhancementPrompt += ` Focus on: professional lighting (warm, natural), camera angle (45-degree or overhead), shallow depth of field, appetizing plating, rustic background, high detail, editorial food photography style. Do NOT add parsley, extra herbs, or any ingredients not explicitly listed.`;

    const response = await fetch(ENHANCE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: enhancementPrompt,
      }),
    });

    if (!response.ok) {
      console.warn(
        `[RecipeImage] Prompt enhancement failed: ${response.status} ${response.statusText}`
      );
      return buildFallbackPrompt(title, ingredients);
    }

    const data: any = await response.json();
    const enhancedPrompt = data?.data?.enhanced_prompt;

    if (!enhancedPrompt) {
      console.warn("[RecipeImage] No enhanced_prompt in response, using fallback");
      return buildFallbackPrompt(title, ingredients);
    }

    console.log("[RecipeImage] ✨ Enhanced prompt:", enhancedPrompt);
    return enhancedPrompt;
  } catch (error) {
    console.error("[RecipeImage] Prompt enhancement error:", error);
    return buildFallbackPrompt(title, ingredients);
  }
}

/**
 * Build fallback prompt manually if enhancement fails
 */
function buildFallbackPrompt(title: string, ingredients?: string[]): string {
  let prompt = `Professional food photography of ${title}`;

  if (ingredients && ingredients.length > 0) {
    const ingredientsList = ingredients.slice(0, 8).join(", ");
    prompt += `, made with: ${ingredientsList}`;
  }

  prompt += `, warm natural lighting, 45-degree angle, shallow depth of field, rustic wooden table, appetizing presentation, high detail, michelin star plating, editorial style, 4k quality`;

  console.log("[RecipeImage] 📝 Using fallback prompt:", prompt);
  return prompt;
}

/**
 * Generate (or reuse) a recipe image using deAPI txt2img endpoint.
 * Global cache per titolo nella tabella public.recipe_image_cache.
 *
 * DEAPI is async - it returns a request_id and we need to poll for the result.
 */
const DEAPI_TXT2IMG_ENDPOINT = "https://api.deapi.ai/api/v1/client/txt2img";
const DEAPI_STATUS_ENDPOINT =
  "https://api.deapi.ai/api/v1/client/request-status";

// Polling configuration
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Max 30 attempts = 60 seconds timeout

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll DEAPI for request status until image is ready
 */
async function pollForResult(
  requestId: string,
  apiKey: string
): Promise<string | null> {
  console.log(`[RecipeImage] 🔄 Polling for request: ${requestId}`);

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const statusResponse = await fetch(
        `${DEAPI_STATUS_ENDPOINT}/${requestId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!statusResponse.ok) {
        console.warn(
          `[RecipeImage] Status poll error: ${statusResponse.status} ${statusResponse.statusText}`
        );
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const statusData: any = await statusResponse.json();
      console.log(
        `[RecipeImage] 📊 Poll attempt ${attempt}:`,
        JSON.stringify(statusData, null, 2)
      );

      // Check for completion status
      const status = statusData?.data?.status || statusData?.status;

      if (status === "completed" || status === "success" || status === "done") {
        const imageUrl =
          statusData?.data?.result_url ||
          statusData?.data?.output?.images?.[0]?.url ||
          statusData?.data?.output?.images?.[0] ||
          statusData?.data?.images?.[0]?.url ||
          statusData?.data?.images?.[0] ||
          statusData?.data?.image_url ||
          statusData?.data?.result?.images?.[0]?.url ||
          statusData?.data?.result?.url ||
          statusData?.output?.images?.[0]?.url ||
          statusData?.output?.images?.[0] ||
          statusData?.images?.[0]?.url ||
          statusData?.images?.[0] ||
          statusData?.image_url ||
          statusData?.result_url ||
          statusData?.result?.url ||
          null;

        if (imageUrl && typeof imageUrl === "string") {
          console.log(
            `[RecipeImage] ✅ Image ready after ${attempt} polls:`,
            imageUrl.substring(0, 100) + "..."
          );
          return imageUrl;
        } else {
          console.warn(
            "[RecipeImage] Status=completed but no image URL found. Keys:",
            Object.keys(statusData?.data || statusData || {})
          );
          return null;
        }
      }

      if (status === "failed" || status === "error") {
        console.error(
          "[RecipeImage] ❌ Request failed:",
          statusData?.data?.error || statusData?.error || "Unknown error"
        );
        return null;
      }

      // Status is still processing, wait and retry
      if (attempt < MAX_POLL_ATTEMPTS) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error(`[RecipeImage] Poll error on attempt ${attempt}:`, error);
      if (attempt < MAX_POLL_ATTEMPTS) {
        await sleep(POLL_INTERVAL_MS);
      }
    }
  }

  console.warn(
    `[RecipeImage] ⏰ Timeout: Max poll attempts (${MAX_POLL_ATTEMPTS}) reached for ${requestId}`
  );
  return null;
}

export async function generateRecipeImageFromTitle(
  title: string,
  ingredients?: string[],
  usePromptEnhancement: boolean = true
): Promise<string | null> {
  console.log("[RecipeImage] 🚀 generateRecipeImageFromTitle called for:", title);
  const apiKey = process.env.DEAPI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[RecipeImage] DEAPI_API_KEY not configured, skipping image generation"
    );
    return null;
  }

  const normalized = normalizeTitle(title);

  try {
    // 1) Prova a recuperare dalla cache globale
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from("recipe_image_cache")
      .select("image_url")
      .eq("title_normalized", normalized)
      .maybeSingle();

    if (cacheError) {
      console.warn("[RecipeImage] Cache lookup error:", cacheError.message);
    }

    if (cached?.image_url) {
      console.log("[RecipeImage] ✅ Using cached image for title:", normalized);
      return cached.image_url as string;
    }

    // 2) Build or enhance prompt
    let finalPrompt: string;

    if (usePromptEnhancement) {
      finalPrompt = await enhancePrompt(title, ingredients, apiKey);
    } else {
      finalPrompt = buildFallbackPrompt(title, ingredients);
    }

    // 3) Build negative prompt with strict ingredient control
    let negativePrompt =
      "blurry, text, watermark, low quality, distorted, ugly, bad anatomy, deformed";

    if (ingredients && ingredients.length > 0) {
      negativePrompt +=
        ", extra ingredients, parsley garnish, herbs not listed, wrong ingredients, additional toppings, decorative elements not in recipe";
    } else {
      negativePrompt += ", excessive garnish, unrealistic presentation";
    }

    // 4) Chiama deAPI per generare l'immagine
    console.log("[RecipeImage] 🎨 Generating image with prompt:", finalPrompt);

    const response = await fetch(DEAPI_TXT2IMG_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        model: "ZImageTurbo_INT8",
        width: 512,
        height: 512,
        steps: 4,
        guidance: 3.5,
        negative_prompt: negativePrompt,
        seed: Math.floor(Math.random() * 4294967295),
      }),
    });

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "Unable to read error body");
      console.error(
        "[RecipeImage] txt2img error:",
        response.status,
        response.statusText,
        "Body:",
        errorBody
      );
      return null;
    }

    const data: any = await response.json();
    console.log(
      "[RecipeImage] 📥 Initial DEAPI response:",
      JSON.stringify(data, null, 2)
    );

    // Extract request_id for polling
    const requestId = data?.data?.request_id || data?.request_id;

    if (!requestId) {
      // Maybe the API returned the image directly (sync mode)
      const directImageUrl =
        data?.data?.images?.[0]?.url ||
        data?.data?.image_url ||
        data?.images?.[0]?.url ||
        data?.image_url ||
        null;

      if (directImageUrl) {
        console.log(
          "[RecipeImage] ✅ Got direct image URL (sync):",
          directImageUrl.substring(0, 100) + "..."
        );
        await cacheImageUrl(normalized, directImageUrl);
        return directImageUrl;
      }

      console.warn(
        "[RecipeImage] No request_id and no direct image URL in response"
      );
      return null;
    }

    // 5) Poll for the result
    const imageUrl = await pollForResult(requestId, apiKey);

    if (!imageUrl) {
      return null;
    }

    // 6) Cache the result
    await cacheImageUrl(normalized, imageUrl);

    console.log("[RecipeImage] ✅ Generated and cached image for:", normalized);
    return imageUrl;
  } catch (error) {
    console.error("[RecipeImage] Failed to generate image with deAPI:", error);
    return null;
  }
}

/**
 * Cache image URL in Supabase
 */
async function cacheImageUrl(
  normalized: string,
  imageUrl: string
): Promise<void> {
  const { error: insertError } = await supabaseAdmin
    .from("recipe_image_cache")
    .insert({
      title_normalized: normalized,
      image_url: imageUrl,
    });

  if (insertError && !insertError.message.includes("duplicate key")) {
    console.warn(
      "[RecipeImage] Failed to insert cache row:",
      insertError.message
    );
  }
}