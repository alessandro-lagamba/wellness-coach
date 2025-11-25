import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface RecipeIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  optional?: boolean;
}

export interface UserRecipe {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  cuisine?: string;
  meal_types: string[];
  tags: string[];
  servings: number;
  ready_in_minutes?: number | null;
  total_minutes?: number | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  ingredients: RecipeIngredient[];
  steps: string[];
  tips?: string[];
  calories_per_serving?: number | null;
  macros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  } | null;
  favorite: boolean;
  notes?: string | null;
  source?: string | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveRecipeInput {
  title: string;
  description?: string;
  cuisine?: string;
  meal_types?: string[];
  tags?: string[];
  servings?: number;
  ready_in_minutes?: number;
  total_minutes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  ingredients?: RecipeIngredient[];
  steps?: string[];
  tips?: string[];
  calories_per_serving?: number;
  macros?: UserRecipe['macros'];
  favorite?: boolean;
  notes?: string;
  source?: string;
}

class RecipeLibraryService {
  private static instance: RecipeLibraryService;

  static getInstance(): RecipeLibraryService {
    if (!RecipeLibraryService.instance) {
      RecipeLibraryService.instance = new RecipeLibraryService();
    }
    return RecipeLibraryService.instance;
  }

  async list(): Promise<UserRecipe[]> {
    const user = await AuthService.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[RecipeLibrary] list error', error);
      throw error;
    }

    return (data || []).map((row) => this.mapRow(row));
  }

  async save(input: SaveRecipeInput): Promise<UserRecipe> {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const payload = this.serializePayload(input, user.id);
    const { data, error } = await supabase
        .from('user_recipes')
        .insert(payload)
        .select()
        .single();

    if (error) {
      console.error('[RecipeLibrary] save error', error);
      throw error;
    }

    return this.mapRow(data);
  }

  async update(id: string, updates: Partial<SaveRecipeInput>): Promise<UserRecipe> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const payload = {
      ...this.serializePayload(updates, user.id, true),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_recipes')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[RecipeLibrary] update error', error);
      throw error;
    }

    return this.mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[RecipeLibrary] delete error', error);
      throw error;
    }
  }

  async toggleFavorite(id: string, favorite: boolean): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_recipes')
      .update({ favorite, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[RecipeLibrary] toggleFavorite error', error);
      throw error;
    }
  }

  async recordUsage(id: string): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) return;
    await supabase
      .from('user_recipes')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  async saveGeneratedRecipe(
    generated: any,
    options: {
      title?: string;
      cuisine?: string;
      meal_types?: string[];
      tags?: string[];
      favorite?: boolean;
      notes?: string;
    } = {},
  ): Promise<UserRecipe> {
    const payload: SaveRecipeInput = {
      title: options.title || generated?.title || 'Ricetta personalizzata',
      description: generated?.description,
      cuisine: options.cuisine,
      meal_types: options.meal_types || [],
      tags: options.tags,
      servings: generated?.servings ?? 1,
      ready_in_minutes: generated?.readyInMinutes,
      total_minutes: generated?.readyInMinutes,
      ingredients: generated?.ingredients || [],
      steps: generated?.steps || [],
      tips: generated?.tips || [],
      calories_per_serving: generated?.caloriesPerServing,
      macros: generated?.macrosPerServing
        ? {
            protein: generated.macrosPerServing.protein,
            carbs: generated.macrosPerServing.carbs,
            fat: generated.macrosPerServing.fat,
            fiber: generated.macrosPerServing.fiber,
            sugar: generated.macrosPerServing.sugar,
          }
        : undefined,
      favorite: options.favorite,
      notes: options.notes,
      source: 'generated',
    };

    return this.save(payload);
  }

  private serializePayload(
    input: Partial<SaveRecipeInput>,
    userId: string,
    isPartial = false,
  ) {
    const base: Record<string, any> = isPartial ? {} : { user_id: userId };
    const assignIfDefined = (key: string, value: any) => {
      if (typeof value !== 'undefined') {
        base[key] = value;
      }
    };

    assignIfDefined('title', input.title);
    assignIfDefined('description', input.description);
    assignIfDefined('cuisine', input.cuisine);
    assignIfDefined('meal_types', input.meal_types);
    assignIfDefined('tags', input.tags);
    assignIfDefined('servings', input.servings);
    assignIfDefined('ready_in_minutes', input.ready_in_minutes);
    assignIfDefined('total_minutes', input.total_minutes);
    assignIfDefined('difficulty', input.difficulty);
    assignIfDefined('ingredients', input.ingredients ? JSON.parse(JSON.stringify(input.ingredients)) : undefined);
    assignIfDefined('steps', input.steps ? JSON.parse(JSON.stringify(input.steps)) : undefined);
    assignIfDefined('tips', input.tips ? JSON.parse(JSON.stringify(input.tips)) : undefined);
    assignIfDefined('calories_per_serving', input.calories_per_serving);
    assignIfDefined('macros', input.macros ? JSON.parse(JSON.stringify(input.macros)) : undefined);
    assignIfDefined('favorite', input.favorite);
    assignIfDefined('notes', input.notes);
    assignIfDefined('source', input.source);

    return base;
  }

  private mapRow(row: any): UserRecipe {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description ?? undefined,
      cuisine: row.cuisine ?? undefined,
      meal_types: row.meal_types || [],
      tags: row.tags || [],
      servings: row.servings ?? 1,
      ready_in_minutes: row.ready_in_minutes,
      total_minutes: row.total_minutes,
      difficulty: row.difficulty ?? 'medium',
      ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
      steps: Array.isArray(row.steps) ? row.steps : [],
      tips: Array.isArray(row.tips) ? row.tips : [],
      calories_per_serving: row.calories_per_serving,
      macros: row.macros || {},
      favorite: !!row.favorite,
      notes: row.notes ?? undefined,
      source: row.source ?? undefined,
      last_used_at: row.last_used_at ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const recipeLibraryService = RecipeLibraryService.getInstance();
export default recipeLibraryService;



