/**
 * Nutrition Routes
 */

import { Router } from "express";
import {
  analyzeImage,
  analyzeText,
  suggestMeal,
  generateRecipe,
  generateRestaurantRecipe,
  parseIngredients,
  calculateNutrition,
  generateRecipeImage,
} from "../controllers/nutrition.controller";
import { strictRateLimiter } from "../middleware/rate-limiter";

const router: Router = Router();

// POST /api/nutrition/analyze-image - Analyze food image
router.post("/analyze-image", analyzeImage);

// POST /api/nutrition/analyze-text - Analyze food description
router.post("/analyze-text", analyzeText);

// POST /api/nutrition/suggest-meal - Suggest meals to fill gaps
router.post("/suggest-meal", suggestMeal);

// POST /api/nutrition/generate-recipe - Generate recipe from ingredients
// Rate limit strict: generazione ricette è costosa e può essere abusata
router.post("/generate-recipe", strictRateLimiter, generateRecipe);

// POST /api/nutrition/generate-restaurant-recipe - Generate recipe from restaurant meal
// Rate limit strict: generazione ricette è costosa e può essere abusata
router.post("/generate-restaurant-recipe", strictRateLimiter, generateRestaurantRecipe);

// POST /api/nutrition/parse-ingredients - Parse ingredients from voice/text
router.post("/parse-ingredients", parseIngredients);

// POST /api/nutrition/calculate-nutrition - Calculate nutrition from ingredients
router.post("/calculate-nutrition", calculateNutrition);

// POST /api/nutrition/generate-image - Generate illustrative image for a recipe title
router.post("/generate-image", generateRecipeImage);

export default router;

