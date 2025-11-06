/**
 * Nutrition Controller
 * Handles nutrition analysis and meal suggestions
 */

import { Request, Response } from "express";
import {
  AnalyzeImageBody,
  SuggestMealBody,
  GenerateRecipeBody,
  ParseIngredientsBody,
} from "../types/nutrition.types";
import {
  analyzeImageHook,
  suggestMealHook,
  generateRecipeFromIngredientsHook,
  parseIngredientsHook,
} from "../services/nutrition.service";

/**
 * POST /api/nutrition/analyze-image
 * Analyze food image and extract meal draft
 */
export const analyzeImage = async (req: Request, res: Response) => {
  try {
    const body: AnalyzeImageBody = req.body;

    if (!body.image) {
      return res.status(400).json({
        success: false,
        error: "Image is required",
      });
    }

    const result = await analyzeImageHook(body);

    if (result.success) {
      res.json({
        success: true,
        data: result.meal,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("[Nutrition] ❌ analyzeImage controller error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

/**
 * POST /api/nutrition/suggest-meal
 * Suggest meals to fill nutritional gaps
 */
export const suggestMeal = async (req: Request, res: Response) => {
  try {
    const body: SuggestMealBody = req.body;

    if (
      typeof body.remainingCalories !== "number" ||
      !body.remainingMacros
    ) {
      return res.status(400).json({
        success: false,
        error: "remainingCalories and remainingMacros are required",
      });
    }

    const result = await suggestMealHook(body);

    if (result.success) {
      res.json({
        success: true,
        data: {
          suggestions: result.suggestions,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("[Nutrition] ❌ suggestMeal controller error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

/**
 * POST /api/nutrition/generate-recipe
 * Generate recipe from available ingredients
 */
export const generateRecipe = async (req: Request, res: Response) => {
  try {
    const body: GenerateRecipeBody = req.body;

    if (!body.ingredients || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        error: "ingredients array is required",
      });
    }

    const result = await generateRecipeFromIngredientsHook(body);

    if (result.success) {
      res.json({
        success: true,
        data: result.recipe,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("[Nutrition] ❌ generateRecipe controller error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

/**
 * POST /api/nutrition/parse-ingredients
 * Parse ingredients from voice/text input
 */
export const parseIngredients = async (req: Request, res: Response) => {
  try {
    const body: ParseIngredientsBody = req.body;

    if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "text is required and must be non-empty",
      });
    }

    const result = await parseIngredientsHook(body);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("[Nutrition] ❌ parseIngredients controller error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

