import { supabase, Tables, ChatSession, ChatMessage, WellnessSuggestion, UserWellnessSuggestion } from '../lib/supabase';
import { encryptText, decryptText } from './encryption.service';
import { logReadEvent, logWriteEvent, logDecryptionEvent, logEncryptionEvent } from './audit-log.service';

export class ChatService {
  /**
   * Crea una nuova sessione di chat
   */
  static async createChatSession(
    userId: string,
    sessionName?: string,
    emotionContext?: Record<string, any>,
    skinContext?: Record<string, any>
  ): Promise<ChatSession | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.CHAT_SESSIONS)
        .insert({
          user_id: userId,
          session_name: sessionName,
          emotion_context: emotionContext || {},
          skin_context: skinContext || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating chat session:', error);
        return null;
      }

      //console.log('✅ Chat session created:', data.id);
      return data;
    } catch (error) {
      console.error('Error in createChatSession:', error);
      return null;
    }
  }

  /**
   * Salva un messaggio nella chat
   * @deprecated Content is no longer saved to Supabase. Use LocalChatService for content storage.
   */
  static async saveChatMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    emotionContext?: Record<string, any>,
    wellnessSuggestionId?: string
  ): Promise<ChatMessage | null> {
    try {
      // Content encryption/storage is disabled for Supabase
      // We only log metadata that a message occurred

      const { data, error } = await supabase
        .from(Tables.CHAT_MESSAGES)
        .insert({
          session_id: sessionId,
          user_id: userId,
          role,
          // content: null, // REMOVED
          emotion_context: emotionContext || {},
          // wellness_suggestion_id: wellnessSuggestionId, // REMOVED
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving chat message:', error);
        return null;
      }

      const message = data as ChatMessage;
      // We populate content back for the return value so the UI doesn't break immediately
      // if it relies on the return value, although persistence is gone.
      message.content = content;

      // Log scrittura
      await logWriteEvent('chat', message.id);

      return message;
    } catch (error) {
      console.error('Error in saveChatMessage:', error);
      return null;
    }
  }

  /**
   * Ottiene i messaggi di una sessione di chat
   * @deprecated Content is no longer fetched from Supabase. Use LocalChatService.
   */
  static async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.CHAT_MESSAGES)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error getting chat messages:', error);
        return [];
      }

      // No content decryption needed as we don't store content
      const messages = (data || []) as ChatMessage[];

      return messages;
    } catch (error) {
      console.error('Error in getChatMessages:', error);
      return [];
    }
  }

  /**
   * Ottiene le sessioni di chat di un utente con almeno un messaggio utente
   * Include anche il primo messaggio dell'utente per identificare la chat
   */
  static async getUserChatSessions(userId: string, limit: number = 10): Promise<(ChatSession & { firstUserMessage?: string })[]> {
    try {
      // Prima ottieni tutte le sessioni
      const { data: sessions, error: sessionsError } = await supabase
        .from(Tables.CHAT_SESSIONS)
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (sessionsError) {
        console.error('Error getting user chat sessions:', sessionsError);
        return [];
      }

      if (!sessions || sessions.length === 0) {
        return [];
      }

      // We no longer strip content from DB directly for preview as it's not there.
      // We return sessions as is.
      // If names are set, they will be used.

      return sessions.map(s => ({ ...s, firstUserMessage: '' }));
    } catch (error) {
      console.error('Error in getUserChatSessions:', error);
      return [];
    }
  }

  /**
   * Chiude una sessione di chat
   */
  static async endChatSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(Tables.CHAT_SESSIONS)
        .update({
          ended_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error ending chat session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in endChatSession:', error);
      return false;
    }
  }
}

export class WellnessSuggestionService {
  /**
   * Ottiene tutti i wellness suggestions attivi
   */
  static async getActiveSuggestions(): Promise<WellnessSuggestion[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.WELLNESS_SUGGESTIONS_CATALOG)
        .select('*')
        .eq('is_active', true)
        .order('priority_level', { ascending: false });

      if (error) {
        console.error('Error getting active suggestions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActiveSuggestions:', error);
      return [];
    }
  }

  /**
   * Ottiene suggerimenti per categoria
   */
  static async getSuggestionsByCategory(
    category: 'emotion' | 'skin' | 'lifestyle' | 'stress' | 'sleep' | 'nutrition'
  ): Promise<WellnessSuggestion[]> {
    if (!category) return [];

    try {
      const { data, error } = await supabase
        .from(Tables.WELLNESS_SUGGESTIONS_CATALOG)
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('priority_level', { ascending: false });

      if (error) {
        console.error('Error getting suggestions by category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSuggestionsByCategory:', error);
      return [];
    }
  }

  /**
   * Suggerisce un wellness suggestion a un utente
   */
  static async suggestToUser(
    userId: string,
    suggestionId: string
  ): Promise<UserWellnessSuggestion | null> {
    try {
      const { data, error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .insert({
          user_id: userId,
          suggestion_id: suggestionId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error suggesting to user:', error);
        return null;
      }

      console.log('✅ Wellness suggestion added for user:', userId);
      return data;
    } catch (error) {
      console.error('Error in suggestToUser:', error);
      return null;
    }
  }

  /**
   * Ottiene i suggerimenti non visualizzati di un utente
   */
  static async getUserPendingSuggestions(userId: string): Promise<UserWellnessSuggestion[]> {
    try {
      const { data, error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .select(`
          *,
          wellness_suggestions_catalog (*)
        `)
        .eq('user_id', userId)
        .is('viewed_at', null)
        .eq('is_dismissed', false)
        .order('suggested_at', { ascending: false });

      if (error) {
        console.error('Error getting user pending suggestions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserPendingSuggestions:', error);
      return [];
    }
  }

  /**
   * Marca un suggerimento come visualizzato
   */
  static async markSuggestionAsViewed(suggestionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .update({
          viewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (error) {
        console.error('Error marking suggestion as viewed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markSuggestionAsViewed:', error);
      return false;
    }
  }

  /**
   * Marca un suggerimento come completato
   */
  static async markSuggestionAsCompleted(suggestionId: string, rating?: number, comment?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .update({
          completed_at: new Date().toISOString(),
          feedback_rating: rating,
          feedback_comment: comment,
        })
        .eq('id', suggestionId);

      if (error) {
        console.error('Error marking suggestion as completed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markSuggestionAsCompleted:', error);
      return false;
    }
  }

  /**
   * Ottiene il suggerimento più appropriato basato sul contesto avanzato
   */
  static async getContextualSuggestion(
    userId: string,
    emotionContext?: Record<string, any>,
    skinContext?: Record<string, any>
  ): Promise<WellnessSuggestion | null> {
    try {
      // Logica per determinare il suggerimento più appropriato
      // basato su emozioni, pelle, e altri fattori

      let category: 'emotion' | 'skin' | 'lifestyle' | 'stress' | 'sleep' | 'nutrition' = 'lifestyle';

      if (emotionContext?.dominantEmotion) {
        const emotion = emotionContext.dominantEmotion.toLowerCase();
        if (['sadness', 'anger', 'fear'].includes(emotion)) {
          category = 'emotion';
        } else if (emotion === 'stress' || emotionContext.valence < -0.3) {
          category = 'stress';
        }
      }

      if (skinContext?.overallScore && skinContext.overallScore < 60) {
        category = 'skin';
      }

      const suggestions = await this.getSuggestionsByCategory(category);

      if (suggestions.length > 0) {
        // Per ora restituiamo il primo suggerimento ad alta priorità
        return suggestions.find(s => s.priority_level === 'high') || suggestions[0];
      }

      return null;
    } catch (error) {
      console.error('Error in getContextualSuggestion:', error);
      return null;
    }
  }

  /**
   * 🧠 NUOVO: Ottiene suggerimento intelligente basato su AIContext completo
   */
  static async getIntelligentSuggestion(
    userId: string,
    aiContext: any
  ): Promise<{ suggestion: WellnessSuggestion | null; shouldShow: boolean; urgency: 'low' | 'medium' | 'high'; timing: 'immediate' | 'today' | 'this_week' }> {
    try {
      // Se abbiamo già un suggerimento suggerito dall'AIContext, usalo
      if (aiContext?.suggestedWellnessSuggestion) {
        const suggestedSuggestion = aiContext.suggestedWellnessSuggestion;

        // Trova il suggerimento corrispondente nel database
        const { data: suggestion, error } = await supabase
          .from(Tables.WELLNESS_SUGGESTIONS_CATALOG)
          .select('*')
          .eq('id', suggestedSuggestion.id)
          .eq('is_active', true)
          .single();

        if (suggestion && !error) {
          return {
            suggestion,
            shouldShow: true,
            urgency: suggestedSuggestion.urgency || 'medium',
            timing: suggestedSuggestion.timing || 'today'
          };
        }
      }

      // Fallback: usa la logica intelligente basata sui dati
      const suggestion = await this.getSmartSuggestionFromData(userId, aiContext);

      if (suggestion) {
        return {
          suggestion,
          shouldShow: true,
          urgency: 'medium',
          timing: 'today'
        };
      }

      return {
        suggestion: null,
        shouldShow: false,
        urgency: 'low',
        timing: 'this_week'
      };
    } catch (error) {
      console.error('Error in getIntelligentSuggestion:', error);
      return {
        suggestion: null,
        shouldShow: false,
        urgency: 'low',
        timing: 'this_week'
      };
    }
  }

  /**
   * 🎯 NUOVO: Logica intelligente per selezione suggerimenti basata sui dati
   */
  private static async getSmartSuggestionFromData(
    userId: string,
    aiContext: any
  ): Promise<WellnessSuggestion | null> {
    try {
      // Analizza i dati per determinare il suggerimento più appropriato
      const emotionHistory = aiContext?.emotionHistory || [];
      const skinHistory = aiContext?.skinHistory || [];
      const behavioralInsights = aiContext?.behavioralInsights || {};
      const temporalPatterns = aiContext?.temporalPatterns || {};

      // 1. PRIORITÀ ALTA: Stress indicators
      if (behavioralInsights.stressIndicators?.length > 0) {
        const stressSuggestions = await this.getSuggestionsByCategory('stress');
        if (stressSuggestions.length > 0) {
          return stressSuggestions.find(s => s.priority_level === 'high') || stressSuggestions[0];
        }
      }

      // 2. PRIORITÀ MEDIA: Emozioni negative recenti
      if (emotionHistory.length > 0) {
        const recentEmotion = emotionHistory[0];
        if (recentEmotion.valence < -0.3) {
          const emotionSuggestions = await this.getSuggestionsByCategory('emotion');
          if (emotionSuggestions.length > 0) {
            return emotionSuggestions.find(s => s.priority_level === 'high') || emotionSuggestions[0];
          }
        }
      }

      // 3. PRIORITÀ MEDIA: Pelle problematica
      if (skinHistory.length > 0) {
        const recentSkin = skinHistory[0];
        if (recentSkin.overall_score < 60) {
          const skinSuggestions = await this.getSuggestionsByCategory('skin');
          if (skinSuggestions.length > 0) {
            return skinSuggestions.find(s => s.priority_level === 'high') || skinSuggestions[0];
          }
        }
      }

      // 4. PRIORITÀ BASSA: Timing-based suggestions
      const timeOfDay = temporalPatterns.timeOfDay;
      if (timeOfDay === 'evening') {
        const sleepSuggestions = await this.getSuggestionsByCategory('sleep');
        if (sleepSuggestions.length > 0) {
          return sleepSuggestions[0];
        }
      } else if (timeOfDay === 'morning') {
        const lifestyleSuggestions = await this.getSuggestionsByCategory('lifestyle');
        if (lifestyleSuggestions.length > 0) {
          return lifestyleSuggestions[0];
        }
      }

      // 5. FALLBACK: Suggerimento generale
      const generalSuggestions = await this.getSuggestionsByCategory('lifestyle');
      return generalSuggestions.length > 0 ? generalSuggestions[0] : null;

    } catch (error) {
      console.error('Error in getSmartSuggestionFromData:', error);
      return null;
    }
  }

  /**
   * 🎓 NUOVO: Sistema di apprendimento dalle interazioni utente
   */
  static async learnFromUserInteraction(
    userId: string,
    suggestionId: string,
    action: 'accepted' | 'dismissed' | 'completed',
    rating?: number,
    comment?: string
  ): Promise<boolean> {
    try {
      console.log(`🎓 Learning from user interaction: ${action} for suggestion ${suggestionId}`);

      // Se suggestionId non è un UUID (es. "breathing-exercises"), 
      // cerchiamo il record corrispondente per nome/titolo
      let actualSuggestionId = suggestionId;

      // Controlla se è un UUID valido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(suggestionId)) {
        // Non è un UUID, cerchiamo per nome o titolo
        const { data: suggestions, error: searchError } = await supabase
          .from(Tables.USER_WELLNESS_SUGGESTIONS)
          .select('id')
          .eq('user_id', userId)
          .or(`suggestion_name.ilike.%${suggestionId}%,suggestion_title.ilike.%${suggestionId}%`)
          .limit(1);

        if (searchError || !suggestions || suggestions.length === 0) {
          console.log(`⚠️ No database record found for suggestion: ${suggestionId}, skipping database update`);
          // Non è un errore critico, continuiamo
          console.log(`✅ User interaction logged (no DB): ${action} for suggestion ${suggestionId}`);
          return true;
        }

        actualSuggestionId = suggestions[0].id;
      }

      // Salva l'interazione per analisi future
      const { error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .update({
          viewed_at: action === 'dismissed' ? new Date().toISOString() : null,
          completed_at: action === 'completed' ? new Date().toISOString() : null,
          is_dismissed: action === 'dismissed',
          feedback_rating: rating,
          feedback_comment: comment
        })
        .eq('user_id', userId)
        .eq('id', actualSuggestionId);

      if (error) {
        console.error('Error learning from user interaction:', error);
        return false;
      }

      // TODO: Implementare logica di machine learning per migliorare le future selezioni
      // Per ora, logghiamo i pattern per analisi future
      console.log(`✅ User interaction logged: ${action} for suggestion ${suggestionId}`);

      return true;
    } catch (error) {
      console.error('Error in learnFromUserInteraction:', error);
      return false;
    }
  }

  /**
   * 📊 NUOVO: Ottiene statistiche sui suggerimenti per un utente
   */
  static async getUserSuggestionStats(userId: string): Promise<{
    totalSuggested: number;
    totalAccepted: number;
    totalCompleted: number;
    totalDismissed: number;
    averageRating: number;
    mostEffectiveCategories: string[];
  }> {
    try {
      const { data, error } = await supabase
        .from(Tables.USER_WELLNESS_SUGGESTIONS)
        .select(`
          *,
          wellness_suggestions_catalog (category, priority_level)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting user suggestion stats:', error);
        return {
          totalSuggested: 0,
          totalAccepted: 0,
          totalCompleted: 0,
          totalDismissed: 0,
          averageRating: 0,
          mostEffectiveCategories: []
        };
      }

      const suggestions = data || [];
      const totalSuggested = suggestions.length;
      const totalAccepted = suggestions.filter(s => s.interaction_type === 'accepted').length;
      const totalCompleted = suggestions.filter(s => s.interaction_type === 'completed').length;
      const totalDismissed = suggestions.filter(s => s.is_dismissed).length;

      const ratings = suggestions
        .filter(s => typeof s.feedback_rating === 'number')
        .map(s => s.feedback_rating as number);

      const averageRating = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;

      // Calcola categorie più efficaci (con rating alto)
      const categoryStats = suggestions
        .filter(s => typeof s.feedback_rating === 'number' && s.feedback_rating >= 4)
        .reduce((acc, s) => {
          const category = s.wellness_suggestions_catalog?.category || 'unknown';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const mostEffectiveCategories = Object.entries(categoryStats)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([category]) => category);

      return {
        totalSuggested,
        totalAccepted,
        totalCompleted,
        totalDismissed,
        averageRating,
        mostEffectiveCategories
      };
    } catch (error) {
      console.error('Error in getUserSuggestionStats:', error);
      return {
        totalSuggested: 0,
        totalAccepted: 0,
        totalCompleted: 0,
        totalDismissed: 0,
        averageRating: 0,
        mostEffectiveCategories: []
      };
    }
  }
}


