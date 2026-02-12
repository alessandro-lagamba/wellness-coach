import { supabase, Tables, UserProfile } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { AuthPersistenceService } from './auth-persistence.service';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export class AuthService {
  private static readonly APP_SCHEME = 'yachai';

  private static getRedirectUri(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return `${this.APP_SCHEME}://${normalizedPath}`;
  }

  private static parseAuthCallbackParams(url: string): URLSearchParams {
    const [beforeHash, hashPart = ''] = url.split('#');
    const queryPart = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
    const merged = [queryPart, hashPart].filter(Boolean).join('&');
    return new URLSearchParams(merged);
  }

  /**
   * Gestisce callback OAuth da deep link e imposta la sessione Supabase.
   * Supporta sia access_token/refresh_token che code flow.
   */
  static async handleOAuthCallback(url: string): Promise<{ user: User | null; error: any; cancelled?: boolean }> {
    try {
      const params = this.parseAuthCallbackParams(url);
      const oauthError = params.get('error_description') || params.get('error');
      if (oauthError) {
        return { user: null, error: new Error(oauthError) };
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          return { user: null, error };
        }

        if (data.user && data.session) {
          await AuthPersistenceService.saveAuthData(data.user, data.session, true);
          return { user: data.user, error: null };
        }
      }

      const authAny = supabase.auth as any;
      const code = params.get('code');
      if (code && typeof authAny.exchangeCodeForSession === 'function') {
        const { data, error } = await authAny.exchangeCodeForSession(code);
        if (error) {
          return { user: null, error };
        }
        if (data?.user && data?.session) {
          await AuthPersistenceService.saveAuthData(data.user, data.session, true);
          return { user: data.user, error: null };
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await AuthPersistenceService.saveAuthData(session.user, session, true);
        return { user: session.user, error: null };
      }

      return { user: null, error: new Error('OAuth callback non contiene token/sessione valida') };
    } catch (error) {
      return { user: null, error };
    }
  }

  /**
   * Ottiene l'utente corrente
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      // 🔥 FIX: Rimossi log eccessivi - manteniamo solo errori critici

      // 🔥 PRIMA: Ripristina la sessione (importante per React Native)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        return session.user;
      }

      // Se non c'è sessione, prova a ottenere l'utente direttamente
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        // ✅ FIX: Distingui tra errori normali (session missing) e errori critici
        const isNormalError = error.message?.includes('Auth session missing') ||
          error.message?.includes('Invalid Refresh Token') ||
          error.message?.includes('Already Used') ||
          error.message?.includes('Network request failed') ||
          error.message?.includes('AuthRetryableFetchError');

        if (!isNormalError) {
          // Solo loggare errori inaspettati
          console.warn('⚠️ Error getting user:', error.message);
        }

        // Se fallisce, controlla la persistenza locale
        const authState = await AuthPersistenceService.loadAuthData();
        if (authState?.user && authState?.session) {
          // Tenta di ripristinare la sessione
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: authState.session.access_token,
              refresh_token: authState.session.refresh_token,
            });

            if (!sessionError && sessionData.session?.user) {
              return sessionData.session.user;
            }

            // ✅ FIX: Se setSession fallisce con errori normali, non loggare come errore
            if (sessionError) {
              const isNormalSessionError = sessionError.message?.includes('Invalid Refresh Token') ||
                sessionError.message?.includes('Already Used') ||
                sessionError.message?.includes('expired');
              if (!isNormalSessionError) {
                console.warn('⚠️ Error restoring session:', sessionError.message);
              }
            }
          } catch (restoreError: any) {
            // ✅ FIX: Errori di restore sono gestiti, non loggare come critici
            const isNormalRestoreError = restoreError?.message?.includes('Invalid Refresh Token') ||
              restoreError?.message?.includes('Already Used');
            if (!isNormalRestoreError) {
              console.warn('⚠️ Error restoring session:', restoreError?.message || restoreError);
            }
          }
        }
        return null;
      }

      return user;
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
  }

  /**
   * Ottiene la sessione corrente
   */
  static async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  /**
   * Registra un nuovo utente (legacy - usa signUpWithMetadata per nuove registrazioni)
   */
  static async signUp(email: string, password: string, fullName?: string): Promise<{ user: User | null; error: any }> {
    return this.signUpWithMetadata(email, password, { full_name: fullName });
  }

  /**
   * 🔥 NEW: Registra un nuovo utente con tutti i metadata
   * Questo metodo salva TUTTI i dati utente direttamente nella chiamata signUp,
   * garantendo che siano disponibili nei user_metadata dopo la conferma email.
   */
  static async signUpWithMetadata(
    email: string,
    password: string,
    metadata: {
      full_name?: string;
      first_name?: string;
      last_name?: string;
      age?: number;
      gender?: string;
      birth_date?: string;
      terms_consent_accepted?: boolean;
      terms_consent_accepted_at?: string;
      terms_consent_ip?: string | null;
      health_consent_accepted?: boolean;
      health_consent_accepted_at?: string;
      health_consent_ip?: string | null;
      consent_version?: string;
    }
  ): Promise<{ user: User | null; error: any }> {
    // 🆕 Track signup attempt
    try {
      const { AnalyticsService } = require('./analytics.service');
      await AnalyticsService.trackEvent('onboarding_started', { feature: 'signup' });
    } catch (error) {
      // Analytics not available, ignore
    }
    try {
      console.log('📝 SignUp with metadata:', {
        email,
        first_name: metadata.first_name,
        last_name: metadata.last_name,
        age: metadata.age,
        gender: metadata.gender,
        birth_date: metadata.birth_date,
        terms_consent_accepted: metadata.terms_consent_accepted,
        terms_consent_accepted_at: metadata.terms_consent_accepted_at,
        terms_consent_ip: metadata.terms_consent_ip,
        health_consent_accepted: metadata.health_consent_accepted,
        health_consent_accepted_at: metadata.health_consent_accepted_at,
        health_consent_ip: metadata.health_consent_ip,
        consent_version: metadata.consent_version,
      });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // 🔥 CRITICAL: Include ALL user data in the signup call
            // This ensures metadata is saved even before email verification
            full_name: metadata.full_name,
            first_name: metadata.first_name,
            last_name: metadata.last_name,
            age: metadata.age,
            gender: metadata.gender,
            birth_date: metadata.birth_date,
            terms_consent_accepted: metadata.terms_consent_accepted,
            terms_consent_accepted_at: metadata.terms_consent_accepted_at,
            terms_consent_ip: metadata.terms_consent_ip,
            health_consent_accepted: metadata.health_consent_accepted,
            health_consent_accepted_at: metadata.health_consent_accepted_at,
            health_consent_ip: metadata.health_consent_ip,
            consent_version: metadata.consent_version,
          },
          // ✅ Configurazione redirect URL per conferma email
          // Usa lo schema deep link dell'app invece di localhost
          emailRedirectTo: this.getRedirectUri('auth/confirm'),
        }
      });

      if (error) {
        console.error('❌ Error signing up:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return { user: null, error };
      }

      // 🔥 FIX: Non creiamo il profilo durante la registrazione
      // Il profilo verrà creato automaticamente quando l'utente verifica l'email
      // Questo evita di avere profili per utenti che non completano la verifica

      console.log('✅ Signup successful!');
      console.log('📧 User email:', data.user?.email);
      console.log('📧 Email confirmed:', data.user?.email_confirmed_at);
      console.log('📧 User metadata:', data.user?.user_metadata);
      console.log('📧 Confirmation email should be sent to:', email);

      if (data.user) {
        // Inizializza la chiave di cifratura E2E per il nuovo utente
        // (solo se l'email è già verificata, altrimenti verrà fatto dopo la verifica)
        if (data.user.email_confirmed_at) {
          try {
            const { initializeEncryptionKey } = await import('./encryption.service');
            await initializeEncryptionKey(data.user.id, password);
            console.log('[Auth] ✅ Encryption key initialized for new user');
          } catch (encError) {
            console.warn('[Auth] ⚠️ Failed to initialize encryption key (non-critical):', encError);
            // Non blocchiamo la registrazione se la cifratura fallisce
          }

          // 🆕 Gestisci multi-device login
          try {
            const { MultiDeviceAuthService } = await import('./multi-device-auth.service');
            await MultiDeviceAuthService.handleLogin();
          } catch (error) {
            // Non critico, ignora
          }
        }
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error in signUpWithMetadata:', error);
      return { user: null, error };
    }
  }

  /**
   * Effettua il login con provider OAuth (Google, Apple)
   */
  static async signInWithOAuth(provider: 'google' | 'apple'): Promise<{ error: any; data: any }> {
    try {
      // 🆕 Track login attempt
      try {
        const { AnalyticsService } = require('./analytics.service');
        await AnalyticsService.trackEvent('screen_viewed', { feature: 'social_login', provider });
      } catch (error) {
        // Analytics not available, ignore
      }

      const redirectTo = this.getRedirectUri('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: provider === 'apple' ? 'name email' : 'email profile',
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined,
        },
      });

      if (error) {
        console.error(`Error signing in with ${provider}:`, error);
        return { error, data: null };
      }

      if (!data?.url) {
        return { error: new Error('OAuth URL mancante nella risposta Supabase'), data: null };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        return {
          data: { cancelled: true, type: result.type },
          error: null,
        };
      }

      const callback = await this.handleOAuthCallback(result.url);
      if (callback.error) {
        return { error: callback.error, data: null };
      }

      // 🆕 Gestisci multi-device login anche per OAuth
      try {
        const { MultiDeviceAuthService } = await import('./multi-device-auth.service');
        await MultiDeviceAuthService.handleLogin();
      } catch {
        // Non critico
      }

      return { data: { user: callback.user, type: result.type }, error: null };
    } catch (error) {
      console.error(`Error in signInWithOAuth (${provider}):`, error);
      return { error, data: null };
    }
  }

  /**
   * Recupera il public IP dell'utente (best effort) per audit GDPR.
   * Non blocca la registrazione in caso di errore/rete assente.
   */
  static async getPublicIpAddress(): Promise<string | null> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 2500);
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return typeof body?.ip === 'string' ? body.ip : null;
    } catch {
      return null;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  /**
   * Effettua il login
   */
  static async signIn(email: string, password: string, rememberMe: boolean = true): Promise<{ user: User | null; error: any }> {
    // 🆕 Track login attempt
    try {
      const { AnalyticsService } = require('./analytics.service');
      await AnalyticsService.trackEvent('screen_viewed', { feature: 'login' });
    } catch (error) {
      // Analytics not available, ignore
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Error signing in:', error);
        return { user: null, error };
      }

      // Salva i dati di autenticazione per la persistenza
      if (data.user && data.session) {
        await AuthPersistenceService.saveAuthData(data.user, data.session, rememberMe);

        // Inizializza la chiave di cifratura E2E per questo utente
        // La chiave viene derivata dalla password e salvata in SecureStore
        try {
          const { initializeEncryptionKey } = await import('./encryption.service');
          await initializeEncryptionKey(data.user.id, password);
          console.log('[Auth] ✅ Encryption key initialized for user');
        } catch (encError) {
          console.warn('[Auth] ⚠️ Failed to initialize encryption key (non-critical):', encError);
          // Non blocchiamo il login se la cifratura fallisce
        }

        // 🆕 Gestisci multi-device login
        try {
          const { MultiDeviceAuthService } = await import('./multi-device-auth.service');
          await MultiDeviceAuthService.handleLogin();
        } catch (error) {
          // Non critico, ignora
        }
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { user: null, error };
    }
  }

  /**
   * Effettua il logout
   */
  static async signOut(): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error);
        return { error };
      }

      // Pulisce i dati di persistenza
      await AuthPersistenceService.clearAuthData();

      // Cancella la chiave di cifratura dalla sessione
      try {
        const { clearEncryptionKey } = await import('./encryption.service');
        const currentUser = await this.getCurrentUser();
        if (currentUser) {
          await clearEncryptionKey(currentUser.id);
          console.log('[Auth] ✅ Encryption key cleared');
        }
      } catch (encError) {
        console.warn('[Auth] ⚠️ Failed to clear encryption key (non-critical):', encError);
      }

      // 🆕 Update analytics user context (clear user)
      try {
        const { AnalyticsService } = require('./analytics.service');
        AnalyticsService.updateUserContext();
      } catch (error) {
        // Analytics not available, ignore
      }

      // 🆕 Clear Sentry user context
      try {
        const { clearUserContext } = require('./sentry.service');
        clearUserContext();
      } catch (error) {
        // Sentry not available, ignore
      }

      // 🆕 Clear multi-device info
      try {
        const { MultiDeviceAuthService } = require('./multi-device-auth.service');
        await MultiDeviceAuthService.clearDeviceInfo();
      } catch (error) {
        // Multi-device service not available, ignore
      }

      return { error: null };
    } catch (error) {
      console.error('Error in signOut:', error);
      return { error };
    }
  }

  /**
   * Pianifica la cancellazione account a +60 giorni (server-side RPC).
   * Il backend revoca subito l'accesso impostando banned_until.
   */
  static async requestAccountDeletion(
    confirmationText: string = 'ELIMINA'
  ): Promise<{ scheduledFor: string | null; error: any }> {
    try {
      const publicIp = await this.getPublicIpAddress();
      const { data, error } = await supabase.rpc('request_account_deletion', {
        p_confirmation_text: confirmationText,
        p_source: 'mobile_settings',
        p_ip: publicIp,
      });

      if (error) {
        return { scheduledFor: null, error };
      }

      return {
        scheduledFor: typeof data === 'string' ? data : null,
        error: null,
      };
    } catch (error) {
      return { scheduledFor: null, error };
    }
  }

  /**
   * Cancella immediatamente l'utente autenticato corrente.
   * Usato per enforcement hard (es. blocco under-16 post social login).
   */
  static async deleteCurrentUserCompletely(): Promise<{ error: any }> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser?.id) {
        return { error: new Error('AUTH_REQUIRED') };
      }

      const { error } = await supabase.rpc('delete_user_completely', {
        user_id_to_delete: currentUser.id,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Crea un profilo utente
   */
  static async createUserProfile(
    userId: string,
    email: string,
    fullName?: string,
    firstName?: string,
    lastName?: string,
    age?: number,
    gender?: string,
    options?: {
      birthDate?: string;
      termsAccepted?: boolean;
      termsAcceptedAt?: string;
      termsConsentIp?: string | null;
      healthConsentAccepted?: boolean;
      healthConsentAcceptedAt?: string;
      healthConsentIp?: string | null;
      consentVersion?: string;
    }
  ): Promise<UserProfile | null> {
    try {
      // Ottieni l'utente autenticato corrente
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // ✅ FIX: Non loggare errori normali (session missing è normale quando l'utente non è loggato)
        const isNormalError = authError?.message?.includes('Auth session missing') ||
          authError?.message?.includes('Invalid Refresh Token') ||
          authError?.message?.includes('Already Used') ||
          authError?.message?.includes('Network request failed') ||
          authError?.message?.includes('AuthRetryableFetchError');

        if (!isNormalError && authError) {
          console.error('Error getting authenticated user:', authError);
        }
        return null;
      }

      // 🔥 FIX: Usa firstName/lastName passati come parametri, altrimenti parse da fullName
      let finalFirstName: string | undefined = firstName;
      let finalLastName: string | undefined = lastName;

      if (!finalFirstName && !finalLastName && fullName && fullName.trim()) {
        const nameParts = fullName.trim().split(' ');
        finalFirstName = nameParts[0];
        finalLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
      }

      const { data, error } = await supabase
        .from(Tables.USER_PROFILES)
        .insert({
          id: user.id, // Usa l'ID dell'utente autenticato
          email,
          full_name: fullName, // Keep for backward compatibility
          first_name: finalFirstName,
          last_name: finalLastName,
          age: age !== undefined && age !== null ? age : null,
          gender: gender || null,
          birth_date: options?.birthDate || null,
          terms_accepted: options?.termsAccepted || false,
          terms_accepted_at: options?.termsAcceptedAt || null,
          terms_consent_ip: options?.termsConsentIp || null,
          health_consent_accepted: options?.healthConsentAccepted || false,
          health_consent_accepted_at: options?.healthConsentAcceptedAt || null,
          health_consent_ip: options?.healthConsentIp || null,
          consent_version: options?.consentVersion || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      return null;
    }
  }

  /**
   * Ottiene il nome da usare nella chat (first_name o fallback a full_name)
   */
  static getDisplayName(profile: UserProfile | null): string {
    if (!profile) return 'User';

    if (profile.first_name) {
      return profile.first_name;
    }

    if (profile.full_name) {
      // Extract first name from full_name as fallback
      const nameParts = profile.full_name.trim().split(' ');
      return nameParts[0];
    }

    return 'User';
  }

  /**
   * Ottiene il nome completo per contesti formali
   */
  static getFullDisplayName(profile: UserProfile | null): string {
    if (!profile) return 'User';

    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }

    if (profile.full_name) {
      return profile.full_name;
    }

    return 'User';
  }

  /**
   * Ottiene il profilo utente
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Ottieni l'utente autenticato corrente
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // ✅ FIX: Non loggare errori normali (session missing è normale quando l'utente non è loggato)
        const isNormalError = authError?.message?.includes('Auth session missing') ||
          authError?.message?.includes('Invalid Refresh Token') ||
          authError?.message?.includes('Already Used') ||
          authError?.message?.includes('Network request failed') ||
          authError?.message?.includes('AuthRetryableFetchError');

        if (!isNormalError && authError) {
          console.error('Error getting authenticated user:', authError);
        }
        return null;
      }

      const { data, error } = await supabase
        .from(Tables.USER_PROFILES)
        .select('*')
        .eq('id', user.id) // Usa l'ID dell'utente autenticato
        .single();

      if (error) {
        console.error('Error getting user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Aggiorna il profilo utente
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<UserProfile | null> {
    try {
      // Ottieni l'utente autenticato corrente
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // ✅ FIX: Non loggare errori normali (session missing è normale quando l'utente non è loggato)
        const isNormalError = authError?.message?.includes('Auth session missing') ||
          authError?.message?.includes('Invalid Refresh Token') ||
          authError?.message?.includes('Already Used') ||
          authError?.message?.includes('Network request failed') ||
          authError?.message?.includes('AuthRetryableFetchError');

        if (!isNormalError && authError) {
          console.error('Error getting authenticated user:', authError);
        }
        return null;
      }

      const { data, error } = await supabase
        .from(Tables.USER_PROFILES)
        .update(updates)
        .eq('id', user.id) // Usa l'ID dell'utente autenticato
        .select()
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      return null;
    }
  }

  /**
   * Salva o aggiorna il push token dell'utente nelle preferenze
   */
  static async savePushToken(
    token: string,
    metadata?: { deviceType?: string; appVersion?: string; osVersion?: string }
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        return;
      }

      const profile = await this.getUserProfile(user.id);

      const existingPreferences = (profile?.preferences || {}) as Record<string, any>;
      const updatedPreferences = {
        ...existingPreferences,
        notifications: {
          ...(existingPreferences.notifications || {}),
          pushToken: token,
          pushTokenUpdatedAt: new Date().toISOString(),
          deviceType: metadata?.deviceType,
          appVersion: metadata?.appVersion,
          osVersion: metadata?.osVersion,
        },
      };

      await supabase
        .from(Tables.USER_PROFILES)
        .update({ preferences: updatedPreferences })
        .eq('id', user.id);
    } catch (error) {
      console.error('[Auth] Error saving push token:', error);
    }
  }

  /**
   * Reinvia l'email di conferma
   */
  static async resendConfirmationEmail(email: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: this.getRedirectUri('auth/confirm'),
        },
      });

      if (error) {
        console.error('Error resending confirmation email:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in resendConfirmationEmail:', error);
      return { error };
    }
  }

  /**
   * Resetta la password
   */
  static async resetPassword(email: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: this.getRedirectUri('reset-password'),
      });

      if (error) {
        console.error('Error resetting password:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in resetPassword:', error);
      return { error };
    }
  }

  /**
   * Aggiorna la password
   */
  static async updatePassword(newPassword: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Error updating password:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in updatePassword:', error);
      return { error };
    }
  }

  /**
   * Aggiorna i metadata dell'utente autenticato corrente.
   */
  static async updateCurrentUserMetadata(metadata: Record<string, any>): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        console.error('Error updating user metadata:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in updateCurrentUserMetadata:', error);
      return { error };
    }
  }

  /**
   * Ascolta i cambiamenti di autenticazione
   */
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Verifica se l'utente è autenticato
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      // 🔥 PRIMA: Ripristina la sessione Supabase (importante per React Native)
      // Supabase potrebbe non aver ancora ripristinato la sessione all'avvio
      const { data: { session: restoredSession } } = await supabase.auth.getSession();

      if (restoredSession?.user) {
        return true;
      }

      // Se non c'è sessione Supabase, controlla la persistenza locale
      const authState = await AuthPersistenceService.loadAuthData();
      if (authState?.isAuthenticated && authState.session) {
        // Tenta di ripristinare la sessione Supabase usando i token salvati
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: authState.session.access_token,
            refresh_token: authState.session.refresh_token,
          });

          if (error) {
            // ✅ FIX: Distingui tra errori normali e critici
            const isNormalError = error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('Already Used') ||
              error.message?.includes('expired') ||
              error.message?.includes('Auth session missing');

            if (!isNormalError) {
              // Solo loggare errori inaspettati
              console.warn('⚠️ Failed to restore session from persisted data:', error.message);
            }

            // Tenta di rinnovare la sessione se necessario
            const refreshedState = await AuthPersistenceService.refreshSession(authState.session);
            return refreshedState?.isAuthenticated || false;
          }

          if (data.session?.user) {
            // Salva nuovamente i dati aggiornati
            await AuthPersistenceService.saveAuthData(data.session.user, data.session, true);
            return true;
          }
        } catch (restoreError: any) {
          // ✅ FIX: Errori di restore sono gestiti, non loggare come critici
          const isNormalRestoreError = restoreError?.message?.includes('Invalid Refresh Token') ||
            restoreError?.message?.includes('Already Used') ||
            restoreError?.message?.includes('expired');
          if (!isNormalRestoreError) {
            console.warn('⚠️ Error restoring session:', restoreError?.message || restoreError);
          }

          // Tenta di rinnovare la sessione se necessario
          const refreshedState = await AuthPersistenceService.refreshSession(authState.session);
          return refreshedState?.isAuthenticated || false;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
}
