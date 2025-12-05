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
 * Generate (or reuse) a recipe image using deAPI txt2img endpoint.
 * Global cache per titolo nella tabella public.recipe_image_cache.
 * Usa DEAPI_API_KEY dall'ambiente.
 */
const DEAPI_ENDPOINT = "https://api.deapi.ai/api/v1/client/txt2img";

export async function generateRecipeImageFromTitle(
  title: string
): Promise<string | null> {
  const apiKey = process.env.DEAPI_API_KEY;
  if (!apiKey) {
    console.warn("[RecipeImage] DEAPI_API_KEY not configured, skipping image generation");
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

    // 2) Nessuna cache: chiama deAPI per generare l'immagine
    console.log("[RecipeImage] 🎨 Generating image for:", title);

    const response = await fetch(DEAPI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: title,
        model: "Flux1schnell",
        width: 512,
        height: 512,
        steps: 4,
        negative_prompt: "",
        seed: Math.floor(Math.random() * 4294967295), // Random seed between 0 and 2^32-1
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unable to read error body");
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

    // Log full response to debug URL extraction
    console.log("[RecipeImage] 📥 DEAPI response:", JSON.stringify(data, null, 2));

    // Try multiple possible paths for image URL in the response
    const imageUrl =
      data?.images?.[0]?.url ||
      data?.images?.[0] ||
      data?.image_url ||
      data?.url ||
      data?.data?.images?.[0]?.url ||
      data?.data?.image_url ||
      data?.output?.images?.[0]?.url ||
      data?.result?.url ||
      null;

    if (!imageUrl) {
      console.warn("[RecipeImage] No image URL found in response. Full response keys:", Object.keys(data || {}));
      return null;
    }

    // 3) Salva in cache per futuri utenti / richieste
    const { error: insertError } = await supabaseAdmin
      .from("recipe_image_cache")
      .insert({
        title_normalized: normalized,
        image_url: imageUrl,
      });

    if (insertError && !insertError.message.includes("duplicate key")) {
      console.warn("[RecipeImage] Failed to insert cache row:", insertError.message);
    }

    console.log("[RecipeImage] ✅ Generated and cached image for:", normalized);
    return imageUrl as string;
  } catch (error) {
    console.error("[RecipeImage] Failed to generate image with deAPI:", error);
    return null;
  }
}


