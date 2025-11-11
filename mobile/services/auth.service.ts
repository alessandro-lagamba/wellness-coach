import { supabase, Tables, UserProfile } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { AuthPersistenceService } from './auth-persistence.service';

export class AuthService {
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
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error getting user:', error.message);
        // Se fallisce, controlla la persistenza locale
        const authState = await AuthPersistenceService.loadAuthData();
        if (authState?.user) {
          // Tenta di ripristinare la sessione
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: authState.session.access_token,
              refresh_token: authState.session.refresh_token,
            });
            
            if (!sessionError && sessionData.session?.user) {
              return sessionData.session.user;
            }
          } catch (restoreError) {
            console.error('❌ Error restoring session:', restoreError);
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
   * Registra un nuovo utente
   */
  static async signUp(email: string, password: string, fullName?: string): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        console.error('Error signing up:', error);
        return { user: null, error };
      }

      // Crea il profilo utente
      if (data.user) {
        await this.createUserProfile(data.user.id, email, fullName);
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { user: null, error };
    }
  }

  /**
   * Effettua il login
   */
  static async signIn(email: string, password: string, rememberMe: boolean = true): Promise<{ user: User | null; error: any }> {
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

      return { error: null };
    } catch (error) {
      console.error('Error in signOut:', error);
      return { error };
    }
  }

  /**
   * Crea un profilo utente
   */
  static async createUserProfile(
    userId: string,
    email: string,
    fullName?: string
  ): Promise<UserProfile | null> {
    try {
      // Ottieni l'utente autenticato corrente
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('Error getting authenticated user:', authError);
        return null;
      }

      // Parse first_name and last_name from fullName
      let firstName: string | undefined;
      let lastName: string | undefined;
      
      if (fullName && fullName.trim()) {
        const nameParts = fullName.trim().split(' ');
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
      }

      const { data, error } = await supabase
        .from(Tables.USER_PROFILES)
        .insert({
          id: user.id, // Usa l'ID dell'utente autenticato
          email,
          full_name: fullName, // Keep for backward compatibility
          first_name: firstName,
          last_name: lastName,
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
        console.error('Error getting authenticated user:', authError);
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
        console.error('Error getting authenticated user:', authError);
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
   * Resetta la password
   */
  static async resetPassword(email: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'wellnesscoach://reset-password',
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
            // 🔥 FIX: Solo errori critici in console
            console.error('❌ Failed to restore session from persisted data:', error.message);
            // Tenta di rinnovare la sessione se necessario
            const refreshedState = await AuthPersistenceService.refreshSession(authState.session);
            return refreshedState?.isAuthenticated || false;
          }
          
          if (data.session?.user) {
            // Salva nuovamente i dati aggiornati
            await AuthPersistenceService.saveAuthData(data.session.user, data.session, true);
            return true;
          }
        } catch (restoreError) {
          console.error('❌ Error restoring session:', restoreError);
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

