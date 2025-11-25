import AsyncStorage from '@react-native-async-storage/async-storage';

export type CuisinePreference =
  | 'italian'
  | 'mediterranean'
  | 'asian'
  | 'latin'
  | 'middle-eastern'
  | 'american'
  | 'vegetarian'
  | 'none';

export interface NutritionPreferences {
  cuisinePreference: CuisinePreference;
  favoriteIngredients: string[];
  allergies: string[];
  updatedAt: string;
}

const STORAGE_KEY = '@wellness:nutrition-preferences';

class NutritionPreferencesService {
  private static instance: NutritionPreferencesService;

  static getInstance(): NutritionPreferencesService {
    if (!NutritionPreferencesService.instance) {
      NutritionPreferencesService.instance = new NutritionPreferencesService();
    }
    return NutritionPreferencesService.instance;
  }

  async getPreferences(): Promise<NutritionPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: NutritionPreferences = JSON.parse(raw);
        return parsed;
      }
    } catch (error) {
      console.warn('[NutritionPreferences] Failed to read preferences', error);
    }
    return {
      cuisinePreference: 'none',
      favoriteIngredients: [],
      allergies: [],
      updatedAt: new Date().toISOString(),
    };
  }

  async savePreferences(
    updater:
      | NutritionPreferences
      | ((prev: NutritionPreferences) => NutritionPreferences),
  ): Promise<NutritionPreferences> {
    const current = await this.getPreferences();
    const next =
      typeof updater === 'function'
        ? (updater as (prev: NutritionPreferences) => NutritionPreferences)(current)
        : updater;
    const payload: NutritionPreferences = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  }
}

export const nutritionPreferencesService = NutritionPreferencesService.getInstance();



