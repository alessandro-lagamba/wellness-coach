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
  ParseIngredientsBody,
  ParseIngredientsResp,
  MealDraft,
  Suggestion,
  GeneratedRecipe,
  ParseIngredientsResult,
} from "../types/nutrition.types";
import { systemGuardrails, analyzeImageUserPrompt, suggestMealUserPrompt, recipeFromIngredientsPrompt, parseIngredientsUserPrompt } from "./ai/prompt";
import { analyzeImageSchema, suggestMealSchema, generateRecipeSchema, parseIngredientsSchema } from "./ai/schemas";

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

