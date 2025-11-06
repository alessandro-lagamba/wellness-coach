/**
 * Coach Service
 * Handles contextual health coaching suggestions from backend
 */

import { getBackendURL } from '../constants/env';

export interface UserState {
  dateISO: string;
  locale?: string;
  remainingCalories: number;
  remainingMacros: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  hydrationMlToday?: number;
  hydrationTargetMl?: number;
  sleepHoursLastNight?: number;
  hrvMorning?: number;
  hrvBaseline?: number;
  stepsToday?: number;
  workoutToday?: boolean;
  prefs?: string[];
  allergies?: string[];
  pantry?: string[];
  upcomingEvents?: Array<{
    start: string;
    end: string;
    title: string;
  }>;
}

export interface CoachSuggestion {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  category: 'nutrition' | 'hydration' | 'recovery' | 'sleep' | 'activity';
  cta?: {
    label: string;
    action:
      | 'SUGGEST_MEAL'
      | 'LOG_WATER'
      | 'START_BREATHING'
      | 'SCHEDULE_MEAL'
      | 'OPEN_RECIPE';
    payload?: any;
  };
  expireAt?: string;
}

export interface CoachResponse {
  success: boolean;
  data?: CoachSuggestion;
  error?: string;
}

class CoachService {
  private static instance: CoachService;

  public static getInstance(): CoachService {
    if (!CoachService.instance) {
      CoachService.instance = new CoachService();
    }
    return CoachService.instance;
  }

  /**
   * Get contextual coaching suggestion based on user state
   */
  async getSuggestion(userState: UserState): Promise<CoachResponse> {
    try {
      const backendURL = await getBackendURL();

      const { safeFetch } = await import('../utils/fetch-with-timeout');
      const result = await safeFetch(`${backendURL}/api/coach/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userState),
        timeout: 30000, // 30 secondi
        retries: 1, // 1 retry
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get coaching suggestion',
        };
      }

      const data = result.data;

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to get coaching suggestion',
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
}

export const CoachService = CoachService.getInstance();

