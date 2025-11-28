import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingState {
  isCompleted: boolean;
  completedAt?: string;
  wasSkipped: boolean;
  completedSteps: string[];
  lastStepReached: number;
}

export class OnboardingService {
  private static readonly STORAGE_KEYS = {
    COMPLETED: 'onboarding_completed',
    COMPLETED_AT: 'onboarding_completed_at',
    SKIPPED: 'onboarding_skipped',
    STEPS: 'onboarding_completed_steps',
    LAST_STEP: 'onboarding_last_step',
    TUTORIAL_COMPLETED: 'tutorial_completed',
    TUTORIAL_COMPLETED_AT: 'tutorial_completed_at',
    FIRST_EMOTION_ANALYSIS: 'first_emotion_analysis_completed',
    FIRST_SKIN_ANALYSIS: 'first_skin_analysis_completed',
    FIRST_FOOD_ANALYSIS: 'first_food_analysis_completed',
    FIRST_JOURNAL_ENTRY: 'first_journal_entry_completed',
    HOME_WALKTHROUGH_COMPLETED: 'home_walkthrough_completed',
    FOOD_WALKTHROUGH_COMPLETED: 'food_walkthrough_completed',
    CHAT_WALKTHROUGH_COMPLETED: 'chat_walkthrough_completed',
    SKIN_WALKTHROUGH_COMPLETED: 'skin_walkthrough_completed',
  };

  /**
   * Verifica se l'onboarding è stato completato
   */
  static async isOnboardingCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.COMPLETED);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Ottiene lo stato completo dell'onboarding
   */
  static async getOnboardingState(): Promise<OnboardingState> {
    try {
      const [completed, completedAt, skipped, steps, lastStep] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.COMPLETED),
        AsyncStorage.getItem(this.STORAGE_KEYS.COMPLETED_AT),
        AsyncStorage.getItem(this.STORAGE_KEYS.SKIPPED),
        AsyncStorage.getItem(this.STORAGE_KEYS.STEPS),
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_STEP),
      ]);

      return {
        isCompleted: completed === 'true',
        completedAt: completedAt || undefined,
        wasSkipped: skipped === 'true',
        completedSteps: steps ? JSON.parse(steps) : [],
        lastStepReached: lastStep ? parseInt(lastStep) : 0,
      };
    } catch (error) {
      console.error('Error getting onboarding state:', error);
      return {
        isCompleted: false,
        wasSkipped: false,
        completedSteps: [],
        lastStepReached: 0,
      };
    }
  }

  /**
   * Marca l'onboarding come completato
   */
  static async completeOnboarding(completedSteps: string[] = []): Promise<void> {
    try {
      const now = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.COMPLETED, 'true'),
        AsyncStorage.setItem(this.STORAGE_KEYS.COMPLETED_AT, now),
        AsyncStorage.setItem(this.STORAGE_KEYS.STEPS, JSON.stringify(completedSteps)),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SKIPPED), // Clear skip flag
      ]);
      console.log('✅ Onboarding completed successfully');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  }

  /**
   * Marca l'onboarding come saltato
   */
  static async skipOnboarding(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.COMPLETED, 'true'),
        AsyncStorage.setItem(this.STORAGE_KEYS.SKIPPED, 'true'),
        AsyncStorage.setItem(this.STORAGE_KEYS.COMPLETED_AT, new Date().toISOString()),
      ]);
      console.log('⚠️ Onboarding skipped by user');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      throw error;
    }
  }

  /**
   * Salva il progresso dell'onboarding
   */
  static async saveProgress(stepId: string, stepIndex: number): Promise<void> {
    try {
      const currentState = await this.getOnboardingState();
      const updatedSteps = [...currentState.completedSteps, stepId];

      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.STEPS, JSON.stringify(updatedSteps)),
        AsyncStorage.setItem(this.STORAGE_KEYS.LAST_STEP, stepIndex.toString()),
      ]);
      console.log(`📝 Onboarding progress saved: step ${stepIndex} (${stepId})`);
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
    }
  }

  /**
   * Verifica se il tutorial interattivo è stato completato
   */
  static async isTutorialCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED);
      return completed === 'true';
    } catch (error) {
      console.error('Error checking tutorial status:', error);
      return false;
    }
  }

  /**
   * Marca il tutorial come completato
   */
  static async completeTutorial(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED, 'true'),
        AsyncStorage.setItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED_AT, now),
      ]);
      console.log('✅ Tutorial completed successfully');
    } catch (error) {
      console.error('Error completing tutorial:', error);
      throw error;
    }
  }

  /**
   * Resetta l'onboarding (per testing o reset utente)
   */
  static async resetOnboarding(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.COMPLETED_AT),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SKIPPED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.STEPS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_STEP),
        AsyncStorage.removeItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.TUTORIAL_COMPLETED_AT),
      ]);
      console.log('🔄 Onboarding reset successfully');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  }

  /**
   * Verifica se l'utente ha saltato l'onboarding
   */
  static async wasOnboardingSkipped(): Promise<boolean> {
    try {
      const skipped = await AsyncStorage.getItem(this.STORAGE_KEYS.SKIPPED);
      return skipped === 'true';
    } catch (error) {
      console.error('Error checking if onboarding was skipped:', error);
      return false;
    }
  }

  /**
   * Ottiene le statistiche dell'onboarding
   */
  static async getOnboardingStats(): Promise<{
    completionRate: number;
    averageTimeToComplete: number | null;
    mostSkippedStep: string | null;
  }> {
    try {
      const state = await this.getOnboardingState();

      // Calcola completion rate
      const completionRate = state.isCompleted ? 100 : 0;

      // Calcola tempo medio (se disponibile)
      let averageTimeToComplete: number | null = null;
      if (state.completedAt) {
        const completedAt = new Date(state.completedAt);
        const now = new Date();
        averageTimeToComplete = now.getTime() - completedAt.getTime();
      }

      return {
        completionRate,
        averageTimeToComplete,
        mostSkippedStep: state.wasSkipped ? 'onboarding' : null,
      };
    } catch (error) {
      console.error('Error getting onboarding stats:', error);
      return {
        completionRate: 0,
        averageTimeToComplete: null,
        mostSkippedStep: null,
      };
    }
  }

  /**
   * Verifica se è la prima volta che l'utente completa un'azione
   */
  static async isFirstTime(feature: 'emotion' | 'skin' | 'food' | 'journal'): Promise<boolean> {
    try {
      const key = this.STORAGE_KEYS[`FIRST_${feature.toUpperCase()}_ANALYSIS` as keyof typeof this.STORAGE_KEYS] ||
        this.STORAGE_KEYS[`FIRST_${feature.toUpperCase()}_ENTRY` as keyof typeof this.STORAGE_KEYS];
      if (!key) return false;

      const completed = await AsyncStorage.getItem(key);
      return completed !== 'true';
    } catch (error) {
      console.error(`Error checking first time for ${feature}:`, error);
      return false;
    }
  }

  /**
   * Marca una feature come completata per la prima volta
   */
  static async markFirstTimeCompleted(feature: 'emotion' | 'skin' | 'food' | 'journal'): Promise<void> {
    try {
      const key = this.STORAGE_KEYS[`FIRST_${feature.toUpperCase()}_ANALYSIS` as keyof typeof this.STORAGE_KEYS] ||
        this.STORAGE_KEYS[`FIRST_${feature.toUpperCase()}_ENTRY` as keyof typeof this.STORAGE_KEYS];
      if (!key) return;

      await AsyncStorage.setItem(key, 'true');
      console.log(`✅ First ${feature} analysis/entry marked as completed`);
    } catch (error) {
      console.error(`Error marking first time for ${feature}:`, error);
    }
  }

  /**
   * Resetta il tracking del primo utilizzo (per testing)
   */
  static async resetFirstTimeTracking(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.FIRST_EMOTION_ANALYSIS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.FIRST_SKIN_ANALYSIS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.FIRST_FOOD_ANALYSIS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.FIRST_JOURNAL_ENTRY),
        AsyncStorage.removeItem(this.STORAGE_KEYS.HOME_WALKTHROUGH_COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.FOOD_WALKTHROUGH_COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.CHAT_WALKTHROUGH_COMPLETED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SKIN_WALKTHROUGH_COMPLETED),
      ]);
      console.log('🔄 First time tracking reset successfully');
    } catch (error) {
      console.error('Error resetting first time tracking:', error);
    }
  }

  /**
   * Verifica se il walkthrough della Home è stato completato
   */
  static async isHomeWalkthroughCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.HOME_WALKTHROUGH_COMPLETED);
      return completed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Marca il walkthrough della Home come completato
   */
  static async completeHomeWalkthrough(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.HOME_WALKTHROUGH_COMPLETED, 'true');
    } catch (error) {
      console.error('Error completing home walkthrough:', error);
    }
  }

  /**
   * Verifica se il walkthrough del Food è stato completato
   */
  static async isFoodWalkthroughCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.FOOD_WALKTHROUGH_COMPLETED);
      return completed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Marca il walkthrough del Food come completato
   */
  static async completeFoodWalkthrough(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.FOOD_WALKTHROUGH_COMPLETED, 'true');
    } catch (error) {
      console.error('Error completing food walkthrough:', error);
    }
  }

  /**
   * Verifica se il walkthrough della Chat è stato completato
   */
  static async isChatWalkthroughCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.CHAT_WALKTHROUGH_COMPLETED);
      return completed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Marca il walkthrough della Chat come completato
   */
  static async completeChatWalkthrough(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CHAT_WALKTHROUGH_COMPLETED, 'true');
    } catch (error) {
      console.error('Error completing chat walkthrough:', error);
    }
  }

  /**
   * Verifica se il walkthrough della Skin è stato completato
   */
  static async isSkinWalkthroughCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.SKIN_WALKTHROUGH_COMPLETED);
      return completed === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Marca il walkthrough della Skin come completato
   */
  static async completeSkinWalkthrough(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SKIN_WALKTHROUGH_COMPLETED, 'true');
    } catch (error) {
      console.error('Error completing skin walkthrough:', error);
    }
  }
}

