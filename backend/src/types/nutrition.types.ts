/**
 * Nutrition Domain Types
 * Shared types for nutrition analysis and meal suggestions
 */

export type DietPref =
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "keto"
  | "low-carb"
  | "high-protein"
  | "gluten-free"
  | "dairy-free"
  | "halal"
  | "kosher";

export type Allergy =
  | "nuts"
  | "peanuts"
  | "gluten"
  | "dairy"
  | "soy"
  | "eggs"
  | "shellfish";

export type MacroKeys = "protein" | "carbs" | "fat" | "fiber" | "sugar";

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export interface MealItemDraft {
  name: string; // e.g., "grilled chicken breast"
  quantity: number; // numeric
  unit: "g" | "ml" | "serving"; // unit
  confidence: number; // 0..1
  notes?: string;
}

export interface MealDraft {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  items: MealItemDraft[];
  macrosEstimate?: Macros; // total estimate (optional if delegated to resolver)
  caloriesEstimate?: number;
  qualityTags?: string[]; // e.g., ["high_protein", "ultra_processed"]
  confidence: number;
  suggestions?: string[];
}

export interface Suggestion {
  title: string; // "Greek yogurt + blueberries"
  type: "snack" | "meal";
  readyInMinutes: number;
  reason?: string; // why it fits your gap
  macros: Macros;
  calories: number;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps?: string[]; // optional for meals
}

export interface GeneratedRecipe {
  title: string;
  servings: number;
  readyInMinutes: number;
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    optional?: boolean;
  }[];
  steps: string[];
  tips?: string[];
  macrosPerServing: Macros;
  caloriesPerServing: number;
  shoppingGaps?: string[]; // missing ingredients
  image?: string; // optional image URL generated via deAPI
}

// API Request/Response Types

export interface AnalyzeImageBody {
  image: string; // dataURL/base64
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  prefs?: DietPref[];
  allergies?: Allergy[];
  locale?: string; // "it-IT"
}

export type AnalyzeImageResp =
  | { success: true; meal: MealDraft }
  | { success: false; error: string };

export interface SuggestMealBody {
  remainingCalories: number;
  remainingMacros: Partial<Macros>; // e.g., { protein: 20, carbs: 40 }
  prefs?: DietPref[];
  allergies?: Allergy[];
  pantry?: string[]; // available ingredients
  timeOfDay?: "morning" | "afternoon" | "evening";
  maxReadyInMinutes?: number;
  wantType?: "snack" | "meal" | "auto";
}

export type SuggestMealResp =
  | { success: true; suggestions: Suggestion[] }
  | { success: false; error: string };

export interface GenerateRecipeBody {
  ingredients: string[]; // available
  targetMacros?: Partial<Macros>;
  targetCaloriesPerServing?: number;
  servings?: number;
  prefs?: DietPref[];
  allergies?: Allergy[];
  cuisineHint?: string; // "Italian", "Mediterranean", ...
  cuisinePreference?: string; // Preferenza cucina esplicita
  favoriteIngredients?: string[]; // Ingredienti preferiti
  avoidIngredients?: string[]; // Ingredienti da evitare
  maxReadyInMinutes?: number;
}

export type GenerateRecipeResp =
  | { success: true; recipe: GeneratedRecipe }
  | { success: false; error: string };

// Restaurant meal → home recipe generation
export interface GenerateRestaurantRecipeBody {
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
  prefs?: DietPref[];
  allergies?: Allergy[];
}

export type GenerateRestaurantRecipeResp = GenerateRecipeResp;

// Parse Ingredients Types
export interface ParsedIngredient {
  name: string;
  quantity?: number;
  unit?: "g" | "ml" | "pcs" | "serving";
  expiry?: string; // YYYY-MM-DD
  category?: "meat" | "fish" | "vegetables" | "fruits" | "dairy" | "grains" | "legumes" | "spices" | "beverages" | "other";
  confidence: number; // 0..1
  notes?: string; // e.g., "low_confidence", "ambiguous"
}

export interface ParsedCommand {
  type: "add" | "remove" | "update_expiry" | "mark_finished";
  ingredientName?: string;
  expiry?: string;
}

export interface ParseIngredientsBody {
  text: string; // raw transcribed text from voice or manual input
  locale?: string; // "it-IT"
}

export interface ParseIngredientsResult {
  ingredients: ParsedIngredient[];
  commands?: ParsedCommand[]; // e.g., "rimuovi tonno", "scadenza latte domani"
  confidence: number; // overall confidence 0..1
  ambiguous?: Array<{
    text: string;
    suggestions: string[]; // e.g., ["quark (formaggio)", "quark (fisica)"]
  }>;
}

export type ParseIngredientsResp =
  | { success: true; data: ParseIngredientsResult }
  | { success: false; error: string };

// Coach Types

export interface UserState {
  dateISO: string;
  locale?: string;
  remainingCalories: number;
  remainingMacros: Partial<Macros>;
  hydrationMlToday?: number;
  hydrationTargetMl?: number;
  sleepHoursLastNight?: number;
  hrvMorning?: number;
  hrvBaseline?: number;
  stepsToday?: number;
  workoutToday?: boolean;
  prefs?: DietPref[];
  allergies?: Allergy[];
  pantry?: string[];
  upcomingEvents?: { start: string; end: string; title: string }[];
}

export interface CoachSuggestion {
  title: string; // "You're missing protein: try a snack"
  message: string; // brief coaching text
  priority: "low" | "medium" | "high";
  category: "nutrition" | "hydration" | "recovery" | "sleep" | "activity";
  cta?: {
    label: string; // "Suggest me a snack"
    action:
      | "SUGGEST_MEAL"
      | "LOG_WATER"
      | "START_BREATHING"
      | "SCHEDULE_MEAL"
      | "OPEN_RECIPE";
    payload?: any; // e.g., { wantType:"snack", remainingMacros, pantry }
  };
  expireAt?: string; // for dedup
}

export type CoachResp =
  | { success: true; suggestion: CoachSuggestion }
  | { success: false; error: string };

