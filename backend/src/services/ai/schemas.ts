/**
 * JSON Schemas for AI Function Calling
 * OpenAI-compatible JSON schemas for structured outputs
 */

export const analyzeImageSchema = {
  name: "meal_draft",
  schema: {
    type: "object",
    additionalProperties: false, // ✅ Ripristinato: necessario con strict: true
    properties: {
      mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string", enum: ["g", "ml", "serving"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["name", "quantity", "unit", "confidence"],
        },
      },
      macrosEstimate: {
        type: "object",
        additionalProperties: false,
        properties: {
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fiber: { type: "number" },
          sugar: { type: "number" },
        },
        required: ["protein", "carbs", "fat", "fiber", "sugar"],
      },
      caloriesEstimate: { type: "number" },
      qualityTags: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      suggestions: { type: "array", items: { type: "string" } },
    },
    // ✅ Solo proprietà obbligatorie in required
    // mealType, caloriesEstimate, qualityTags, suggestions sono opzionali
    required: ["items", "confidence"],
  },
  // ✅ Rimosso strict per permettere proprietà opzionali con additionalProperties: false
  // Il codice gestisce già le proprietà opzionali (vedi nutrition.service.ts)
} as const;

export const suggestMealSchema = {
  name: "meal_suggestions",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["snack", "meal"] },
            readyInMinutes: { type: "number" },
            reason: { type: "string" },
            calories: { type: "number" },
            macros: {
              type: "object",
              additionalProperties: false,
              properties: {
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
                fiber: { type: "number" },
                sugar: { type: "number" },
              },
              required: ["protein", "carbs", "fat"],
            },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                },
                required: ["name", "quantity", "unit"],
              },
            },
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["title", "type", "readyInMinutes", "calories", "macros", "ingredients"],
        },
      },
    },
    required: ["suggestions"],
  },
} as const;

export const generateRecipeSchema = {
  name: "generated_recipe",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      servings: { type: "number" },
      readyInMinutes: { type: "number" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string", enum: ["g", "ml", "pcs", "serving"] },
            optional: { type: "boolean" },
          },
          required: ["name", "quantity", "unit"],
        },
      },
      steps: { type: "array", items: { type: "string" } },
      tips: { type: "array", items: { type: "string" } },
      macrosPerServing: {
        type: "object",
        additionalProperties: false,
        properties: {
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fiber: { type: "number" },
          sugar: { type: "number" },
        },
        required: ["protein", "carbs", "fat"],
      },
      caloriesPerServing: { type: "number" },
      shoppingGaps: { type: "array", items: { type: "string" } },
    },
    required: ["title", "servings", "readyInMinutes", "ingredients", "steps", "macrosPerServing", "caloriesPerServing"],
  },
} as const;

// 🆕 Schema per calcolare solo i macronutrienti dagli ingredienti
export const calculateNutritionSchema = {
  name: "nutrition_calculation",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      macrosPerServing: {
        type: "object",
        additionalProperties: false,
        properties: {
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fiber: { type: "number" },
          sugar: { type: "number" },
        },
        required: ["protein", "carbs", "fat"],
      },
      caloriesPerServing: { type: "number" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["macrosPerServing", "caloriesPerServing", "confidence"],
  },
} as const;

// 🆕 Schema per le raccomandazioni del coach
export const coachSchema = {
  name: "coach_suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      message: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      category: { type: "string", enum: ["nutrition", "hydration", "recovery", "sleep", "activity"] },
      cta: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          action: {
            type: "string",
            enum: ["SUGGEST_MEAL", "LOG_WATER", "START_BREATHING", "SCHEDULE_MEAL", "OPEN_RECIPE"],
          },
          payload: { type: "object" }, // Opzionale, può essere qualsiasi oggetto
        },
        required: ["label", "action"],
      },
      expireAt: { type: "string" }, // ISO date string, opzionale
    },
    required: ["title", "message", "priority", "category"],
  },
} as const;

// 🆕 Schema per il parsing degli ingredienti da voce/testo
export const parseIngredientsSchema = {
  name: "parsed_ingredients",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            expiryDate: { type: "string" },
          },
          required: ["name"],
        },
      },
      commands: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: { type: "string", enum: ["add", "remove", "update", "clear"] },
            target: { type: "string" },
          },
          required: ["action"],
        },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["ingredients", "confidence"],
  },
} as const;
