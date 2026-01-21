import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';
import { UserRecipe } from './recipe-library.service';
import { encryptText, decryptText } from './encryption.service';

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

    const entries = (data || []).map((row) => this.mapRow(row));

    // Decifra le note se presenti
    for (const entry of entries) {
      if (entry.notes) {
        const decrypted = await decryptText(entry.notes, user.id);
        if (decrypted !== null) {
          entry.notes = decrypted;
        }
      }
    }

    return entries;
  }

  async upsertEntry(input: UpsertMealPlanInput): Promise<MealPlanEntry> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Cifra le note prima di salvare
    let encryptedNotes: string | null = null;
    if (input.notes) {
      try {
        encryptedNotes = await encryptText(input.notes, user.id);
      } catch (encError) {
        console.warn('[MealPlan] ⚠️ Encryption failed, saving as plaintext (fallback):', encError);
        encryptedNotes = input.notes; // Fallback
      }
    }

    const payload = {
      user_id: user.id,
      plan_date: input.plan_date,
      meal_type: input.meal_type,
      recipe_id: input.recipe_id || null,
      custom_recipe: input.custom_recipe || null,
      servings: input.servings ?? 1,
      notes: encryptedNotes,
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

    const entry = this.mapRow(data);

    // Decifra le note prima di restituire
    if (entry.notes) {
      const decrypted = await decryptText(entry.notes, user.id);
      if (decrypted !== null) {
        entry.notes = decrypted;
      }
    }

    return entry;
  }

  async addEntry(input: UpsertMealPlanInput): Promise<MealPlanEntry> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Controlla se esiste già un'entrata per questo utente, data e tipo di pasto
    const { data: existingEntry, error: fetchError } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', input.plan_date)
      .eq('meal_type', input.meal_type)
      .maybeSingle();

    if (fetchError) {
      console.error('[MealPlan] Error fetching existing entry:', fetchError);
    }

    // Cifra le note prima di salvare
    let encryptedNotes: string | null = null;
    const newNote = input.notes || '';

    if (existingEntry && existingEntry.notes) {
      // Se esiste già un'entrata, decifra la vecchia nota e appendi la nuova
      try {
        const oldNote = await decryptText(existingEntry.notes, user.id);
        const combinedNotes = oldNote ? `${oldNote}\n${newNote}` : newNote;
        encryptedNotes = await encryptText(combinedNotes, user.id);
      } catch (e) {
        encryptedNotes = await encryptText(newNote, user.id);
      }
    } else if (newNote) {
      encryptedNotes = await encryptText(newNote, user.id);
    }

    let payload: any = {
      user_id: user.id,
      plan_date: input.plan_date,
      meal_type: input.meal_type,
      recipe_id: input.recipe_id || (existingEntry?.recipe_id || null),
      servings: input.servings ?? (existingEntry?.servings || 1),
      notes: encryptedNotes,
      updated_at: new Date().toISOString(),
    };

    // Gestione custom_recipe (Merge se esiste già)
    if (existingEntry && existingEntry.custom_recipe && input.custom_recipe) {
      const oldRecipe = existingEntry.custom_recipe;
      const newRecipe = input.custom_recipe;

      payload.custom_recipe = {
        ...oldRecipe,
        title: `${oldRecipe.title}, ${newRecipe.title}`,
        calories: (oldRecipe.calories || 0) + (newRecipe.calories || 0),
        macros: {
          protein: (oldRecipe.macros?.protein || 0) + (newRecipe.macros?.protein || 0),
          carbs: (oldRecipe.macros?.carbs || 0) + (newRecipe.macros?.carbs || 0),
          fat: (oldRecipe.macros?.fat || 0) + (newRecipe.macros?.fat || 0),
          fiber: (oldRecipe.macros?.fiber || 0) + (newRecipe.macros?.fiber || 0),
        },
        identified_foods: [
          ...(oldRecipe.identified_foods || []),
          ...(newRecipe.identified_foods || [])
        ],
        health_score: Math.round(((oldRecipe.health_score || 70) + (newRecipe.health_score || 70)) / 2),
        image_url: newRecipe.image_url || oldRecipe.image_url, // Usa l'ultima immagine
      };
    } else {
      payload.custom_recipe = input.custom_recipe || (existingEntry?.custom_recipe || null);
    }

    let result;
    if (existingEntry) {
      // Update
      const { data, error } = await supabase
        .from('meal_plan_entries')
        .update(payload)
        .eq('id', existingEntry.id)
        .select('*, user_recipes (*)')
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('meal_plan_entries')
        .insert(payload)
        .select('*, user_recipes (*)')
        .single();

      if (error) throw error;
      result = data;
    }

    const entry = this.mapRow(result);

    // Decifra le note prima di restituire
    if (entry.notes) {
      const decrypted = await decryptText(entry.notes, user.id);
      if (decrypted !== null) {
        entry.notes = decrypted;
      }
    }

    return entry;
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
