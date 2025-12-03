import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoalMap = {
  steps?: number;        // passi/giorno
  hydration?: number;    // bicchieri/giorno
  meditation?: number;   // minuti/giorno
  sleep?: number;        // ore/notte
  calories?: number;     // kcal/giorno
};

const STORAGE_KEY = 'widgetGoals';

class WidgetGoalsService {
  async getGoals(): Promise<GoalMap> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async setGoal(widgetId: keyof GoalMap, value: number) {
    const current = await this.getGoals();
    const next = { ...current, [widgetId]: value };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async getGoalFor(widgetId: keyof GoalMap): Promise<number | undefined> {
    const g = await this.getGoals();
    return g[widgetId];
  }
}

export const widgetGoalsService = new WidgetGoalsService();
