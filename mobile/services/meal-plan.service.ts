import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';
import { UserRecipe } from './recipe-library.service';

export type MealPlanMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlanEntry {
  id: string;
  user_id: string;
  plan_date: string;
  meal_type: MealPlanMealType;
  recipe_id?: string | null;
  recipe?: UserRecipe | null;
  custom_recipe?: any;
  servings: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertMealPlanInput {
  plan_date: string;
  meal_type: MealPlanMealType;
  recipe_id?: string;
  custom_recipe?: any;
  servings?: number;
  notes?: string;
}

class MealPlanService {
  private static instance: MealPlanService;

  static getInstance(): MealPlanService {
    if (!MealPlanService.instance) {
      MealPlanService.instance = new MealPlanService();
    }
    return MealPlanService.instance;
  }

  async getEntries(startDate: string, endDate: string): Promise<MealPlanEntry[]> {
    const user = await AuthService.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('meal_plan_entries')
      .select('*, user_recipes (*)')
      .eq('user_id', user.id)
      .gte('plan_date', startDate)
      .lte('plan_date', endDate)
      .order('plan_date', { ascending: true });

    if (error) {
      console.error('[MealPlan] getEntries error', error);
      throw error;
    }

    return (data || []).map((row) => this.mapRow(row));
  }

  async upsertEntry(input: UpsertMealPlanInput): Promise<MealPlanEntry> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const payload = {
      user_id: user.id,
      plan_date: input.plan_date,
      meal_type: input.meal_type,
      recipe_id: input.recipe_id || null,
      custom_recipe: input.custom_recipe || null,
      servings: input.servings ?? 1,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('meal_plan_entries')
      .upsert(payload, { onConflict: 'user_id,plan_date,meal_type' })
      .select('*, user_recipes (*)')
      .single();

    if (error) {
      console.error('[MealPlan] upsertEntry error', error);
      throw error;
    }

    return this.mapRow(data);
  }

  async removeEntry(planDate: string, mealType: MealPlanMealType): Promise<void> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('user_id', user.id)
      .eq('plan_date', planDate)
      .eq('meal_type', mealType);

    if (error) {
      console.error('[MealPlan] removeEntry error', error);
      throw error;
    }
  }

  private mapRow(row: any): MealPlanEntry {
    return {
      id: row.id,
      user_id: row.user_id,
      plan_date: row.plan_date,
      meal_type: row.meal_type,
      recipe_id: row.recipe_id,
      recipe: row.user_recipes ? {
        ...row.user_recipes,
        meal_types: row.user_recipes.meal_types || [],
        tags: row.user_recipes.tags || [],
        ingredients: Array.isArray(row.user_recipes.ingredients) ? row.user_recipes.ingredients : [],
        steps: Array.isArray(row.user_recipes.steps) ? row.user_recipes.steps : [],
        tips: Array.isArray(row.user_recipes.tips) ? row.user_recipes.tips : [],
        macros: row.user_recipes.macros || {},
      } : null,
      custom_recipe: row.custom_recipe,
      servings: row.servings ?? 1,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const mealPlanService = MealPlanService.getInstance();
export default mealPlanService;



