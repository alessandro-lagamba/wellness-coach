/**
 * Nutrition Routes
 */

import { Router } from "express";
import {
  analyzeImage,
  suggestMeal,
  generateRecipe,
  parseIngredients,
} from "../controllers/nutrition.controller";

const router: Router = Router();

// POST /api/nutrition/analyze-image - Analyze food image
router.post("/analyze-image", analyzeImage);

// POST /api/nutrition/suggest-meal - Suggest meals to fill gaps
router.post("/suggest-meal", suggestMeal);

// POST /api/nutrition/generate-recipe - Generate recipe from ingredients
router.post("/generate-recipe", generateRecipe);

// POST /api/nutrition/parse-ingredients - Parse ingredients from voice/text
router.post("/parse-ingredients", parseIngredients);

export default router;

