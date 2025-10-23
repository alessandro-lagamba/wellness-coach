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
}

