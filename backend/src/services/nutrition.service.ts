/**
 * Nutrition Service
 * AI-powered nutrition analysis and meal suggestions
 */

import OpenAI from "openai";
import {
  AnalyzeImageBody,
  AnalyzeImageResp,
  SuggestMealBody,
  SuggestMealResp,
  GenerateRecipeBody,
  GenerateRecipeResp,
  GenerateRestaurantRecipeBody,
  GenerateRestaurantRecipeResp,
  ParseIngredientsBody,
  ParseIngredientsResp,
  MealDraft,
  Suggestion,
  GeneratedRecipe,
  ParseIngredientsResult,
} from "../types/nutrition.types";
import {
  systemGuardrails,
  analyzeImageUserPrompt,
  suggestMealUserPrompt,
  recipeFromIngredientsPrompt,
  restaurantMealRecipePrompt,
  parseIngredientsUserPrompt,
  analyzeTextUserPrompt,
  calculateNutritionPrompt,
} from "./ai/prompt";
import { analyzeImageSchema, suggestMealSchema, generateRecipeSchema, calculateNutritionSchema } from "./ai/schemas";
import { generateRecipeImageFromTitle } from "./recipe-image.service";

// TS2305 workaround: in alcuni ambienti (ts-node + nodemon) la cache dei tipi non vede ancora parseIngredientsSchema.
// Lo carichiamo dinamicamente per evitare il crash del backend durante il watch mode.
const { parseIngredientsSchema } = (require("./ai/schemas") as {
  parseIngredientsSchema: typeof analyzeImageSchema;
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Analyze food image and extract meal draft
 */
export async function analyzeImageHook(
  body: AnalyzeImageBody
): Promise<AnalyzeImageResp> {
  try {
    console.log("[Nutrition] 🔍 Analyzing food image...");

    // Extract base64 data if it's a data URL
    let imageData = body.image;
    if (imageData.startsWith("data:image")) {
      const base64Match = imageData.match(/base64,(.+)/);
      if (base64Match) {
        imageData = base64Match[1];
      }
    }

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini", // vision-capable
      response_format: {
        type: "json_schema",
        json_schema: analyzeImageSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        {
          role: "user",
          content: [
            { type: "text", text: analyzeImageUserPrompt(body) },
            {
              type: "image_url",
              image_url: {
                url: body.image.startsWith("data:") ? body.image : `data:image/jpeg;base64,${imageData}`,
              },
            },
          ] as any,
        },
      ],
      temperature: 0.2,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as {
      mealType?: string;
      items: any[];
      macrosEstimate?: any;
      caloriesEstimate?: number;
      qualityTags?: string[];
      confidence: number;
      suggestions?: string[];
    };

    const meal: MealDraft = {
      mealType: (data.mealType as any) ?? body.mealType,
      items: data.items,
      macrosEstimate: data.macrosEstimate,
      caloriesEstimate: data.caloriesEstimate,
      qualityTags: data.qualityTags,
      confidence: data.confidence,
      suggestions: data.suggestions,
    };

    console.log("[Nutrition] ✅ Image analysis complete:", {
      items: meal.items.length,
      confidence: meal.confidence,
    });

    return { success: true, meal };
  } catch (e: any) {
    console.error("[Nutrition] ❌ analyzeImage failed:", e);
    return {
      success: false,
      error: e.message ?? "analyzeImage failed",
    };
  }
}

/**
 * Analyze food description and extract meal draft
 */
export async function analyzeTextHook(
  body: { text: string; mealType?: string; prefs?: string[]; allergies?: string[]; locale?: string }
): Promise<AnalyzeImageResp> {
  try {
    console.log("[Nutrition] 📝 Analyzing food description...");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: analyzeImageSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: analyzeTextUserPrompt(body) },
      ],
      temperature: 0.2,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as {
      mealType?: string;
      items: any[];
      macrosEstimate?: any;
      caloriesEstimate?: number;
      qualityTags?: string[];
      confidence: number;
      suggestions?: string[];
    };

    const meal: MealDraft = {
      mealType: (data.mealType as any) ?? (body.mealType as any),
      items: data.items,
      macrosEstimate: data.macrosEstimate,
      caloriesEstimate: data.caloriesEstimate,
      qualityTags: data.qualityTags,
      confidence: data.confidence,
      suggestions: data.suggestions,
    };

    // Generate illustrative image for the meal using deAPI
    try {
      const ingredientNames = meal.items.map(i => i.name);
      // Use the provided text description as the title/prompt base
      const imageUrl = await generateRecipeImageFromTitle(body.text, ingredientNames);
      if (imageUrl) {
        meal.image = imageUrl;
      }
    } catch (imgError) {
      console.warn("[Nutrition] ⚠️ Failed to generate image for text analysis:", imgError);
    }

    console.log("[Nutrition] ✅ Text analysis complete:", {
      items: meal.items.length,
      confidence: meal.confidence,
      hasImage: !!meal.image
    });

    return { success: true, meal };
  } catch (e: any) {
    console.error("[Nutrition] ❌ analyzeText failed:", e);
    return {
      success: false,
      error: e.message ?? "analyzeText failed",
    };
  }
}


/**
 * Suggest meals to fill nutritional gaps
 */
export async function suggestMealHook(
  body: SuggestMealBody
): Promise<SuggestMealResp> {
  try {
    console.log("[Nutrition] 💡 Generating meal suggestions...", {
      remainingCalories: body.remainingCalories,
      remainingMacros: body.remainingMacros,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: suggestMealSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: suggestMealUserPrompt(body) },
      ],
      temperature: 0.4,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content);
    const suggestions: Suggestion[] = data.suggestions;

    console.log("[Nutrition] ✅ Generated suggestions:", {
      count: suggestions.length,
    });

    return { success: true, suggestions };
  } catch (e: any) {
    console.error("[Nutrition] ❌ suggestMeal failed:", e);
    return {
      success: false,
      error: e.message ?? "suggestMeal failed",
    };
  }
}

/**
 * Generate recipe from available ingredients
 */
export async function generateRecipeFromIngredientsHook(
  body: GenerateRecipeBody
): Promise<GenerateRecipeResp> {
  try {
    console.log("[Nutrition] 🍳 Generating recipe from ingredients...", {
      ingredientsCount: body.ingredients.length,
      servings: body.servings,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: generateRecipeSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: recipeFromIngredientsPrompt(body) },
      ],
      temperature: 0.5,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as GeneratedRecipe;

    // Generate illustrative image for the recipe title using deAPI (best-effort).
    try {
      const ingredientNames = data.ingredients.map(i => i.name);
      // We don't have a concise description, but we can pass ingredients
      const imageUrl = await generateRecipeImageFromTitle(data.title, ingredientNames);
      if (imageUrl) {
        data.image = imageUrl;
      }
    } catch (imgError) {
      console.warn("[Nutrition] ⚠️ Failed to generate image for recipe:", imgError);
    }

    console.log("[Nutrition] ✅ Recipe generated:", {
      title: data.title,
      servings: data.servings,
      readyInMinutes: data.readyInMinutes,
    });

    return { success: true, recipe: data };
  } catch (e: any) {
    console.error("[Nutrition] ❌ generateRecipe failed:", e);
    return {
      success: false,
      error: e.message ?? "generateRecipe failed",
    };
  }
}

/**
 * Generate home recipe starting from a restaurant meal description
 */
export async function generateRestaurantRecipeHook(
  body: GenerateRestaurantRecipeBody
): Promise<GenerateRestaurantRecipeResp> {
  try {
    console.log("[Nutrition] 🍽 Generating restaurant-style recipe...", {
      dishName: body.dishName,
      identifiedFoods: body.identifiedFoods?.length ?? 0,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: generateRecipeSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        {
          role: "user",
          content: restaurantMealRecipePrompt({
            dishName: body.dishName,
            identifiedFoods: body.identifiedFoods,
            macrosEstimate: body.macrosEstimate,
            contextNotes: body.contextNotes,
            prefs: body.prefs as any,
            allergies: body.allergies as any,
          }),
        },
      ],
      temperature: 0.5,
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as GeneratedRecipe;

    // Generate image from restaurant dish name/title (best-effort).
    try {
      const ingredientNames = data.ingredients.map(i => i.name);
      const imageUrl = await generateRecipeImageFromTitle(data.title, ingredientNames);
      if (imageUrl) {
        data.image = imageUrl;
      }
    } catch (imgError) {
      console.warn("[Nutrition] ⚠️ Failed to generate image for restaurant recipe:", imgError);
    }

    console.log("[Nutrition] ✅ Restaurant recipe generated:", {
      title: data.title,
      servings: data.servings,
      readyInMinutes: data.readyInMinutes,
    });

    return { success: true, recipe: data };
  } catch (e: any) {
    console.error("[Nutrition] ❌ generateRestaurantRecipe failed:", e);
    return {
      success: false,
      error: e.message ?? "generateRestaurantRecipe failed",
    };
  }
}

/**
 * Parse ingredients from voice/text input
 * Extracts normalized ingredients, quantities, units, expiry dates, and voice commands
 */
export async function parseIngredientsHook(
  body: ParseIngredientsBody
): Promise<ParseIngredientsResp> {
  try {
    console.log("[Nutrition] 🎤 Parsing ingredients from text...", {
      textLength: body.text.length,
      locale: body.locale,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: parseIngredientsSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: parseIngredientsUserPrompt(body) },
      ],
      temperature: 0.2, // Low temperature for consistent parsing
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content) as ParseIngredientsResult;

    console.log("[Nutrition] ✅ Ingredients parsed:", {
      ingredientsCount: data.ingredients.length,
      commandsCount: data.commands?.length ?? 0,
      confidence: data.confidence,
    });

    return { success: true, data };
  } catch (e: any) {
    console.error("[Nutrition] ❌ parseIngredients failed:", e);
    return {
      success: false,
      error: e.message ?? "parseIngredients failed",
    };
  }
}

/**
 * Calculate nutrition values (macronutrients and calories) from ingredients list
 */
export async function calculateNutritionHook(
  body: {
    ingredients: string[];
    servings?: number;
  }
): Promise<{
  success: boolean;
  data?: {
    macrosPerServing: {
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
    };
    caloriesPerServing: number;
    confidence: number;
  };
  error?: string;
}> {
  try {
    console.log("[Nutrition] 🧮 Calculating nutrition from ingredients...", {
      ingredientsCount: body.ingredients.length,
      servings: body.servings ?? 1,
    });

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: {
        type: "json_schema",
        json_schema: calculateNutritionSchema as any,
      },
      messages: [
        { role: "system", content: systemGuardrails },
        { role: "user", content: calculateNutritionPrompt(body) },
      ],
      temperature: 0.2, // Low temperature for consistent calculations
    });

    const content = res.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const data = JSON.parse(content);

    console.log("[Nutrition] ✅ Nutrition calculated:", {
      caloriesPerServing: data.caloriesPerServing,
      confidence: data.confidence,
    });

    return { success: true, data };
  } catch (e: any) {
    console.error("[Nutrition] ❌ calculateNutrition failed:", e);
    return {
      success: false,
      error: e.message ?? "calculateNutrition failed",
    };
  }
}

