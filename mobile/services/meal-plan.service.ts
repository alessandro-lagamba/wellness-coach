import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';
import { UserRecipe } from './recipe-library.service';
import { FoodAnalysisService } from './food-analysis.service';
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
      if (error.message?.includes('Network request failed')) {
        console.warn('[MealPlan] Network request failed (offline?)');
        return [];
      }
      console.error('[MealPlan] getEntries error', error);
      throw error;
    }

    const entries = (data || []).map((row) => this.mapRow(row));

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

    let encryptedNotes: string | null = null;
    if (input.notes) {
      try {
        encryptedNotes = await encryptText(input.notes, user.id);
      } catch (encError) {
        console.warn('[MealPlan] ⚠️ Encryption failed, saving as plaintext (fallback):', encError);
        encryptedNotes = input.notes;
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

    // 🔥 Sincronizzazione Gauges: Se spostiamo un pasto esistente, aggiorniamo la data dell'analisi associata
    const custom: any = data.custom_recipe;
    const analysisIds = custom?.analysis_ids || (custom?.analysis_id ? [custom.analysis_id] : []);
    if (analysisIds.length > 0) {
      try {
        await FoodAnalysisService.updateFoodAnalysesDate(user.id, analysisIds, input.plan_date);
      } catch (e) {
        console.warn('[MealPlan] Failed to sync analysis dates:', e);
      }
    }

    const entry = this.mapRow(data);
    if (entry.notes) {
      const decrypted = await decryptText(entry.notes, user.id);
      if (decrypted !== null) entry.notes = decrypted;
    }
    return entry;
  }

  async addEntry(input: UpsertMealPlanInput, merge: boolean = true): Promise<MealPlanEntry> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Recupera l'entry esistente solo se siamo in modalità merge
    let existingEntry: any = null;
    if (merge) {
      const { data, error: fetchError } = await supabase
        .from('meal_plan_entries')
        .select('*, user_recipes (*)')
        .eq('user_id', user.id)
        .eq('plan_date', input.plan_date)
        .eq('meal_type', input.meal_type)
        .maybeSingle();

      if (fetchError) {
        console.error('[MealPlan] Error fetching existing entry:', fetchError);
      }
      existingEntry = data;
    }

    // 2. Calcoliamo la nota finale (appendiamo solo se merge=true)
    let encryptedNotes: string | null = null;
    const newNote = input.notes || '';
    if (merge && existingEntry && existingEntry.notes) {
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

    // 3. Prepariamo i dati del pasto attuale (solo se merge=true)
    let baseData: any = null;
    if (merge && existingEntry) {
      if (existingEntry.custom_recipe) {
        baseData = existingEntry.custom_recipe;
      } else if (existingEntry.user_recipes) {
        const r = existingEntry.user_recipes;
        baseData = {
          title: r.title,
          calories: r.calories_per_serving,
          macros: r.macros || {},
          identified_foods: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => i.name) : [r.title],
          image_url: r.image,
          source: 'recipe_library'
        };
      }
    }

    // 4. Prepariamo i dati del nuovo pasto da aggiungere
    let incomingData = input.custom_recipe;

    // Se l'input ha un recipe_id ma non un custom_recipe, carichiamo la ricetta e CREIAMO un'analisi shadow
    if (input.recipe_id && !incomingData) {
      const { data: r } = await supabase.from('user_recipes').select('*').eq('id', input.recipe_id).single();
      if (r) {
        // 🔥 Creiamo un'analisi per far apparire la ricetta nei Gauges
        const savedAnalysis = await FoodAnalysisService.saveFoodAnalysis(user.id, {
          mealType: input.meal_type as any,
          identifiedFoods: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => i.name) : [r.title],
          calories: r.calories_per_serving || 0,
          carbohydrates: r.macros?.carbs || r.macros?.carbohydrates || 0,
          proteins: r.macros?.protein || r.macros?.proteins || 0,
          fats: r.macros?.fat || r.macros?.fats || 0,
          fiber: r.macros?.fiber || 0,
          recommendations: [],
          observations: [],
          confidence: 1,
          date: input.plan_date,
          imageUrl: r.image
        });

        incomingData = {
          title: r.title,
          calories: r.calories_per_serving,
          macros: r.macros || {},
          identified_foods: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => i.name) : [r.title],
          image_url: r.image,
          source: 'recipe_library',
          analysis_id: savedAnalysis?.id,
          analysis_ids: savedAnalysis ? [savedAnalysis.id] : []
        };
      }
    }

    // 5. Costruiamo il payload
    const payload: any = {
      user_id: user.id,
      plan_date: input.plan_date,
      meal_type: input.meal_type,
      servings: input.servings ?? (existingEntry?.servings || 1),
      notes: encryptedNotes,
      updated_at: new Date().toISOString(),
      recipe_id: null,
    };

    if (baseData && incomingData) {
      const oldItems = baseData.sub_items || [baseData];
      const newItems = incomingData.sub_items || [incomingData];
      const combinedItems = [...oldItems, ...newItems].map(item => ({
        ...item,
        title: item.title,
        calories: item.calories || 0,
        macros: item.macros || {},
        analysis_id: item.analysis_id || null,
        analysis_ids: item.analysis_ids || (item.analysis_id ? [item.analysis_id] : [])
      }));

      const mergedAnalysisIds = [...new Set(combinedItems.flatMap(i => i.analysis_ids))].filter(Boolean);

      payload.custom_recipe = {
        title: combinedItems.map(i => i.title).join(', '),
        calories: combinedItems.reduce((acc, i) => acc + (i.calories || 0), 0),
        macros: {
          protein: combinedItems.reduce((acc, i) => acc + (i.macros?.protein || i.macros?.proteins || 0), 0),
          carbs: combinedItems.reduce((acc, i) => acc + (i.macros?.carbohydrates || i.macros?.carbs || 0), 0),
          fat: combinedItems.reduce((acc, i) => acc + (i.macros?.fats || i.macros?.fat || 0), 0),
          fiber: combinedItems.reduce((acc, i) => acc + (i.macros?.fiber || 0), 0),
        },
        identified_foods: [...new Set(combinedItems.flatMap(i => i.identified_foods || []))],
        sub_items: combinedItems,
        analysis_ids: mergedAnalysisIds,
        analysis_id: mergedAnalysisIds[mergedAnalysisIds.length - 1] || null,
        health_score: Math.round(combinedItems.reduce((acc, i) => acc + (i.health_score || 70), 0) / combinedItems.length),
        image_url: incomingData.image_url || baseData.image_url,
        source: 'composite'
      };
    } else {
      payload.custom_recipe = incomingData || baseData;
      if (!baseData && input.recipe_id) {
        payload.recipe_id = input.recipe_id;
        payload.custom_recipe = null;
      }
    }

    const { data: result, error: saveError } = await supabase
      .from('meal_plan_entries')
      .upsert(payload, { onConflict: 'user_id,plan_date,meal_type' })
      .select('*, user_recipes (*)')
      .single();

    if (saveError) throw saveError;

    const entry = this.mapRow(result);
    if (entry.notes) {
      const decrypted = await decryptText(entry.notes, user.id);
      if (decrypted !== null) entry.notes = decrypted;
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
