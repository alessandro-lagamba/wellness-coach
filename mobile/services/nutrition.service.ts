/**
 * Nutrition Service
 * Handles nutrition-related API calls to backend
 */

import { getBackendURL } from '../constants/env';

export interface SuggestMealRequest {
  remainingCalories: number;
  remainingMacros: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  prefs?: string[];
  allergies?: string[];
  pantry?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  maxReadyInMinutes?: number;
  wantType?: 'snack' | 'meal' | 'auto';
}

export interface SuggestMealResponse {
  success: boolean;
  data?: {
    suggestions: Array<{
      title: string;
      type: 'snack' | 'meal';
      readyInMinutes: number;
      reason?: string;
      macros: {
        protein: number;
        carbs: number;
        fat: number;
        fiber?: number;
        sugar?: number;
      };
      calories: number;
      ingredients: Array<{
        name: string;
        quantity: number;
        unit: string;
      }>;
      steps?: string[];
    }>;
  };
  error?: string;
}

export interface GenerateRecipeRequest {
  ingredients: string[];
  targetMacros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  targetCaloriesPerServing?: number;
  servings?: number;
  prefs?: string[];
  allergies?: string[];
  cuisineHint?: string;
  cuisinePreference?: string;
  favoriteIngredients?: string[];
  avoidIngredients?: string[];
  maxReadyInMinutes?: number;
}

export interface GenerateRecipeResponse {
  success: boolean;
  data?: {
    title: string;
    servings: number;
    readyInMinutes: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      optional?: boolean;
    }>;
    steps: string[];
    tips?: string[];
    macrosPerServing: {
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
    };
    caloriesPerServing: number;
    shoppingGaps?: string[];
  };
  error?: string;
}

export class NutritionServiceClass {
  private static instance: NutritionServiceClass;

  public static getInstance(): NutritionServiceClass {
    if (!NutritionServiceClass.instance) {
      NutritionServiceClass.instance = new NutritionServiceClass();
    }
    return NutritionServiceClass.instance;
  }

  /**
   * Suggest meals to fill nutritional gaps
   */
  async suggestMeal(request: SuggestMealRequest): Promise<SuggestMealResponse> {
    try {
      const backendURL = await getBackendURL();

      const response = await fetch(`${backendURL}/api/nutrition/suggest-meal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Backend request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to get meal suggestions',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      // Error logging handled by backend
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate recipe from available ingredients
   */
  async generateRecipe(request: GenerateRecipeRequest): Promise<GenerateRecipeResponse> {
    try {
      const backendURL = await getBackendURL();

      const response = await fetch(`${backendURL}/api/nutrition/generate-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Backend request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to generate recipe',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      // Error logging handled by backend
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate home recipe from a restaurant-style meal (photo analysis)
   */
  async generateRestaurantRecipe(request: {
    dishName?: string;
    identifiedFoods: string[];
    macrosEstimate?: {
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      sugar?: number;
      calories?: number;
    };
    contextNotes?: string;
    prefs?: string[];
    allergies?: string[];
  }): Promise<GenerateRecipeResponse> {
    try {
      const backendURL = await getBackendURL();

      const response = await fetch(
        `${backendURL}/api/nutrition/generate-restaurant-recipe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Backend request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to generate restaurant recipe',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
  /**
   * Parse ingredients from voice/text input
   */
  async parseIngredients(text: string, locale?: string): Promise<{
    success: boolean;
    data?: {
      ingredients: Array<{
        name: string;
        quantity?: number;
        unit?: 'g' | 'ml' | 'pcs' | 'serving';
        expiry?: string;
        confidence: number;
        notes?: string;
      }>;
      commands?: Array<{
        type: 'add' | 'remove' | 'update_expiry' | 'mark_finished';
        ingredientName?: string;
        expiry?: string;
      }>;
      confidence: number;
      ambiguous?: Array<{
        text: string;
        suggestions: string[];
      }>;
    };
    error?: string;
  }> {
    try {
      const backendURL = await getBackendURL();

      const response = await fetch(`${backendURL}/api/nutrition/parse-ingredients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, locale }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Backend request failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to parse ingredients',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const NutritionService = NutritionServiceClass.getInstance();

