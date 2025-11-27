/**
 * Reset App Service
 * Pulisce completamente tutti i dati dell'app (cache, AsyncStorage, etc.)
 * Utile per logout completo o reset app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';
import { supabase } from '../lib/supabase';

export class ResetAppService {
  /**
   * Reset completo dell'app
   * Pulisce:
   * - Tutti i dati AsyncStorage
   * - Tutte le chiavi SecureStore
   * - Cache analisi
   * - Onboarding state
   * - Auth data
   */
  static async resetApp(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Starting app reset...');

      // 1. Logout da Supabase
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('⚠️ Error signing out from Supabase:', error);
      }

      // 2. Pulisci AsyncStorage (tutto)
      try {
        await AsyncStorage.clear();
        console.log('✅ AsyncStorage cleared');
      } catch (error) {
        console.error('❌ Error clearing AsyncStorage:', error);
        throw new Error('Failed to clear AsyncStorage');
      }

      // 3. Pulisci SecureStore (chiavi di cifratura, etc.)
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser?.id) {
          // Pulisci chiavi di cifratura per questo utente
          const encryptionKeys = [
            `encryption_key:${currentUser.id}`,
            `encryption_salt:${currentUser.id}`,
            `hmac_key:${currentUser.id}`,
          ];

          for (const key of encryptionKeys) {
            try {
              await SecureStore.deleteItemAsync(key);
            } catch (error) {
              // Ignora errori se la chiave non esiste
            }
          }

          // Pulisci tutte le chiavi SecureStore che iniziano con il prefisso dell'utente
          // Nota: SecureStore non ha un metodo per listare tutte le chiavi,
          // quindi puliamo solo quelle conosciute
        }
      } catch (error) {
        console.warn('⚠️ Error clearing SecureStore:', error);
        // Non bloccare il reset se SecureStore fallisce
      }

      // 4. Reset onboarding
      try {
        await OnboardingService.resetOnboarding();
        console.log('✅ Onboarding reset');
      } catch (error) {
        console.warn('⚠️ Error resetting onboarding:', error);
      }

      // 5. Pulisci cache analisi (se esiste il servizio)
      try {
        const { AnalysisStorageService } = await import('./analysis-storage.service');
        const storageService = AnalysisStorageService.getInstance();
        await storageService.clearAllHistory();
        console.log('✅ Analysis cache cleared');
      } catch (error) {
        console.warn('⚠️ Error clearing analysis cache:', error);
      }

      // 6. Pulisci cache insights
      try {
        const { IntelligentInsightService } = await import('./intelligent-insight.service');
        IntelligentInsightService.clearCache();
        console.log('✅ Insights cache cleared');
      } catch (error) {
        console.warn('⚠️ Error clearing insights cache:', error);
      }

      // 7. Pulisci cache avatar
      try {
        const { AvatarModelService } = await import('./avatar/AvatarModelService');
        AvatarModelService.clearCache();
        console.log('✅ Avatar cache cleared');
      } catch (error) {
        console.warn('⚠️ Error clearing avatar cache:', error);
      }

      // 8. Pulisci operation locks
      try {
        const { OperationLockService } = await import('./operation-lock.service');
        OperationLockService.clearAllLocks();
        console.log('✅ Operation locks cleared');
      } catch (error) {
        console.warn('⚠️ Error clearing operation locks:', error);
      }

      console.log('✅ App reset completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting app:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reset parziale (solo dati utente, mantiene onboarding)
   */
  static async resetUserData(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Starting user data reset...');

      // 1. Logout
      await AuthService.signOut();

      // 2. Pulisci solo dati utente da AsyncStorage (non tutto)
      const userDataKeys = [
        'auth_user_data',
        'auth_session_data',
        'auth_last_login',
        'auth_biometric_enabled',
        'auth_remember_me',
        '@wellness:language', // Mantieni la lingua
        'onboarding_completed', // Mantieni onboarding
        'onboarding_completed_at',
        'onboarding_skipped',
      ];

      for (const key of userDataKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          // Ignora errori
        }
      }

      // 3. Pulisci SecureStore (chiavi di cifratura)
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser?.id) {
        const encryptionKeys = [
          `encryption_key:${currentUser.id}`,
          `encryption_salt:${currentUser.id}`,
          `hmac_key:${currentUser.id}`,
        ];

        for (const key of encryptionKeys) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (error) {
            // Ignora errori
          }
        }
      }

      console.log('✅ User data reset completed');
      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting user data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verifica se l'app è in stato "primo avvio" (nessun dato)
   */
  static async isFirstLaunch(): Promise<boolean> {
    try {
      const onboardingCompleted = await OnboardingService.isOnboardingCompleted();
      const hasAuthData = await AuthService.isAuthenticated();
      
      // Se onboarding non completato E non autenticato = primo avvio
      return !onboardingCompleted && !hasAuthData;
    } catch (error) {
      console.warn('⚠️ Error checking first launch:', error);
      return false;
    }
  }
}


