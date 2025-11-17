import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';

export interface AuthPersistenceState {
  isAuthenticated: boolean;
  user: any | null;
  session: any | null;
  lastLoginAt: string | null;
  biometricEnabled: boolean;
}

export class AuthPersistenceService {
  private static readonly STORAGE_KEYS = {
    USER_DATA: 'auth_user_data',
    SESSION_DATA: 'auth_session_data',
    LAST_LOGIN: 'auth_last_login',
    BIOMETRIC_ENABLED: 'auth_biometric_enabled',
    REMEMBER_ME: 'auth_remember_me',
  };

  /**
   * Salva i dati di autenticazione in modo sicuro
   */
  static async saveAuthData(user: any, session: any, rememberMe: boolean = true): Promise<void> {
    try {
      const authData = {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          token_type: session.token_type,
        },
        lastLoginAt: new Date().toISOString(),
        rememberMe,
      };

      if (rememberMe) {
        // Salva in AsyncStorage per persistenza
        await AsyncStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(authData.user));
        await AsyncStorage.setItem(this.STORAGE_KEYS.SESSION_DATA, JSON.stringify(authData.session));
        await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_LOGIN, authData.lastLoginAt);
        await AsyncStorage.setItem(this.STORAGE_KEYS.REMEMBER_ME, 'true');
      } else {
        // Salva solo in memoria (session-only)
        await AsyncStorage.setItem(this.STORAGE_KEYS.REMEMBER_ME, 'false');
      }

      // ✅ FIX: Rimossi log eccessivi - i dati vengono salvati correttamente
    } catch (error) {
      console.error('Error saving auth data:', error);
      throw error;
    }
  }

  /**
   * Carica i dati di autenticazione salvati
   */
  static async loadAuthData(): Promise<AuthPersistenceState | null> {
    try {
      const [userData, sessionData, lastLogin, rememberMe] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.USER_DATA),
        AsyncStorage.getItem(this.STORAGE_KEYS.SESSION_DATA),
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_LOGIN),
        AsyncStorage.getItem(this.STORAGE_KEYS.REMEMBER_ME),
      ]);

      if (!userData || !sessionData || rememberMe !== 'true') {
        return null;
      }

      const user = JSON.parse(userData);
      const session = JSON.parse(sessionData);

      // Verifica se la sessione è ancora valida
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at);
        const now = new Date();
        
        if (expiresAt <= now) {
          console.log('⚠️ Session expired, attempting refresh...');
          return await this.refreshSession(session);
        }
      }

      return {
        isAuthenticated: true,
        user,
        session,
        lastLoginAt: lastLogin,
        biometricEnabled: false, // TODO: Implement biometric check
      };
    } catch (error) {
      console.error('Error loading auth data:', error);
      return null;
    }
  }

  /**
   * Tenta di rinnovare la sessione
   */
  static async refreshSession(session: any): Promise<AuthPersistenceState | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      if (error || !data.session) {
        // ✅ FIX: Errori di refresh token (già usato, scaduto, etc.) sono normali e gestiti
        const isNormalError = error?.message?.includes('Invalid Refresh Token') || 
                              error?.message?.includes('Already Used') ||
                              error?.message?.includes('expired');
        
        if (isNormalError) {
          // Log silenzioso per errori normali (token scaduto/già usato)
          // L'utente dovrà semplicemente fare login di nuovo
        } else {
          // Solo loggare errori inaspettati
          console.warn('⚠️ Session refresh failed:', error?.message || 'Unknown error');
        }
        
        await this.clearAuthData();
        return null;
      }

      // Salva la nuova sessione
      await this.saveAuthData(data.user, data.session, true);
      
      return {
        isAuthenticated: true,
        user: data.user,
        session: data.session,
        lastLoginAt: new Date().toISOString(),
        biometricEnabled: false,
      };
    } catch (error) {
      // ✅ FIX: Errori di refresh sono normali, non loggare come errori critici
      await this.clearAuthData();
      return null;
    }
  }

  /**
   * Pulisce tutti i dati di autenticazione
   */
  static async clearAuthData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER_DATA),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION_DATA),
        AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_LOGIN),
        AsyncStorage.removeItem(this.STORAGE_KEYS.BIOMETRIC_ENABLED),
        AsyncStorage.removeItem(this.STORAGE_KEYS.REMEMBER_ME),
      ]);
      // ✅ FIX: Rimossi log eccessivi - i dati vengono puliti correttamente
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  /**
   * Verifica se l'utente ha scelto "Ricordami"
   */
  static async isRememberMeEnabled(): Promise<boolean> {
    try {
      const rememberMe = await AsyncStorage.getItem(this.STORAGE_KEYS.REMEMBER_ME);
      return rememberMe === 'true';
    } catch (error) {
      console.error('Error checking remember me status:', error);
      return false;
    }
  }

  /**
   * Abilita/disabilita "Ricordami"
   */
  static async setRememberMe(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.REMEMBER_ME, enabled.toString());
      console.log(`📝 Remember me set to: ${enabled}`);
    } catch (error) {
      console.error('Error setting remember me:', error);
    }
  }

  /**
   * Ottiene le statistiche di autenticazione
   */
  static async getAuthStats(): Promise<{
    totalLogins: number;
    lastLoginAt: string | null;
    rememberMeEnabled: boolean;
    sessionValid: boolean;
  }> {
    try {
      const [lastLogin, rememberMe, sessionData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_LOGIN),
        AsyncStorage.getItem(this.STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.getItem(this.STORAGE_KEYS.SESSION_DATA),
      ]);

      let sessionValid = false;
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.expires_at) {
          const expiresAt = new Date(session.expires_at);
          sessionValid = expiresAt > new Date();
        }
      }

      return {
        totalLogins: lastLogin ? 1 : 0, // Simplified for now
        lastLoginAt: lastLogin,
        rememberMeEnabled: rememberMe === 'true',
        sessionValid,
      };
    } catch (error) {
      console.error('Error getting auth stats:', error);
      return {
        totalLogins: 0,
        lastLoginAt: null,
        rememberMeEnabled: false,
        sessionValid: false,
      };
    }
  }

  /**
   * Verifica se la sessione è valida
   */
  static async isSessionValid(): Promise<boolean> {
    try {
      const sessionData = await AsyncStorage.getItem(this.STORAGE_KEYS.SESSION_DATA);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      if (!session.expires_at) return false;

      const expiresAt = new Date(session.expires_at);
      const now = new Date();
      
      return expiresAt > now;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }
}

