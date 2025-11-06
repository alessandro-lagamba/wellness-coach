import { supabase, Tables } from '../lib/supabase';
import { AuthService } from './auth.service';
import { useAnalysisStore } from '../stores/analysis.store';

export class ChartDataService {
  // ✅ ADD: Connection monitoring
  private static connectionRetries = 0;
  private static maxRetries = 3;
  private static retryDelay = 1000; // 1 second

  /**
   * Testa la connessione a Supabase
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 Testing Supabase connection...');
      const { data, error } = await supabase
        .from(Tables.USER_PROFILES)
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        return false;
      }
      
      console.log('✅ Supabase connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase connection test error:', error);
      return false;
    }
  }

  /**
   * Retry logic per operazioni database
   */
  private static async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Attempt ${attempt}/${this.maxRetries}`);
        const result = await operation();
        this.connectionRetries = 0; // Reset on success
        return result;
      } catch (error) {
        console.error(`❌ ${operationName} - Attempt ${attempt} failed:`, error);
        
        if (attempt === this.maxRetries) {
          console.error(`❌ ${operationName} - All attempts failed`);
          return null;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
    return null;
  }
  static async loadEmotionDataForCharts(): Promise<void> {
    try {
      // ✅ ADD: Test connection first
      const isConnected = await this.testConnection();
      if (!isConnected) {
        console.warn('⚠️ No database connection, skipping emotion data load');
        return;
      }

      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        console.warn('⚠️ No authenticated user found, skipping emotion data load');
        return;
      }

      console.log('📊 Loading emotion data for charts from Supabase...');

      // ✅ IMPROVE: Use retry logic for database operations
      const result = await this.withRetry(async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from(Tables.EMOTION_ANALYSES)
          .select('*')
          .eq('user_id', currentUser.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(`Database query failed: ${error.message}`);
        }

        return data;
      }, 'Load Emotion Data');

      if (!result) {
        console.error('❌ Failed to load emotion data after retries');
        return;
      }

      if (result.length === 0) {
        console.log('📊 No emotion data found in database');
        return;
      }

      console.log(`📊 Loaded ${result.length} emotion analyses from database`);

      // ✅ FIX: Validate and clean data before processing
      const validData = result.filter(analysis => {
        if (!analysis.id || !analysis.created_at) {
          console.warn('⚠️ Skipping invalid emotion analysis:', analysis);
          return false;
        }
        return true;
      });

      if (validData.length === 0) {
        console.warn('⚠️ No valid emotion data found after validation');
        return;
      }

      // Converti i dati del database nel formato dello store
      const emotionSessions = validData.map((analysis, index) => ({
        id: analysis.id,
        timestamp: new Date(analysis.created_at),
        dominant: analysis.dominant_emotion || 'neutral',
        avg_valence: typeof analysis.valence === 'number' ? analysis.valence : 0,
        avg_arousal: typeof analysis.arousal === 'number' ? analysis.arousal : 0,
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
        duration: typeof analysis.session_duration === 'number' ? analysis.session_duration : 0,
      }));

      // Aggiorna lo store locale con i dati del database
      const store = useAnalysisStore.getState();
      
      // ✅ FIX: Clear existing data first to avoid duplicates
      store.clearHistory();
      
      // Aggiungi tutte le sessioni allo store
      emotionSessions.forEach(session => {
        store.addEmotionSession(session);
      });

      console.log('✅ Emotion data synchronized with local store');

    } catch (error) {
      console.error('❌ Error in loadEmotionDataForCharts:', error);
    }
  }

  /**
   * Carica e sincronizza i dati delle analisi della pelle dal database
   */
  static async loadSkinDataForCharts(): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        console.warn('⚠️ No authenticated user found, skipping skin data load');
        return;
      }

      console.log('📊 Loading skin data for charts from Supabase...');

      // Carica gli ultimi 30 giorni di analisi della pelle
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from(Tables.SKIN_ANALYSES)
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading skin data:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('📊 No skin data found in database');
        return;
      }

      console.log(`📊 Loaded ${data.length} skin analyses from database`);

      // ✅ FIX: Validate and clean data before processing
      const validData = data.filter(analysis => {
        if (!analysis.id || !analysis.created_at) {
          console.warn('⚠️ Skipping invalid skin analysis:', analysis);
          return false;
        }
        return true;
      });

      if (validData.length === 0) {
        console.warn('⚠️ No valid skin data found after validation');
        return;
      }

      // Converti i dati del database nel formato dello store
      const skinCaptures = validData.map((analysis, index) => ({
        id: analysis.id,
        timestamp: new Date(analysis.created_at),
        scores: {
          texture: typeof analysis.texture_score === 'number' ? analysis.texture_score : 0,
          redness: typeof analysis.redness_score === 'number' ? analysis.redness_score : 0,
          hydration: typeof analysis.hydration_score === 'number' ? analysis.hydration_score : 0,  // ✅ FIXED: Correctly map hydration_score
          oiliness: typeof analysis.oiliness_score === 'number' ? analysis.oiliness_score : 0,    // ✅ FIXED: Correctly map oiliness_score
          overall: typeof analysis.overall_score === 'number' ? analysis.overall_score : 0,
        },
        confidence: 0.8, // Default confidence
        quality: {
          lighting: 0.8,
          focus: 0.8,
          roi_coverage: 0.9,
        },
        photoUri: analysis.image_url || '',
      }));

      // Aggiorna lo store locale con i dati del database
      const store = useAnalysisStore.getState();
      
      // ✅ FIX: Clear existing data first to avoid duplicates
      store.clearHistory();
      
      // Aggiungi tutte le catture allo store
      skinCaptures.forEach(capture => {
        store.addSkinCapture(capture);
      });

      console.log('✅ Skin data synchronized with local store');

    } catch (error) {
      console.error('❌ Error in loadSkinDataForCharts:', error);
    }
  }

  /**
   * Carica e sincronizza i dati delle analisi del cibo dal database
   */
  static async loadFoodDataForCharts(): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        console.warn('⚠️ No authenticated user found, skipping food data load');
        return;
      }

      console.log('📊 Loading food data for charts from Supabase...');

      // Carica gli ultimi 30 giorni di analisi del cibo
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from(Tables.FOOD_ANALYSES)
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading food data:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('📊 No food data found in database');
        return;
      }

      console.log(`📊 Loaded ${data.length} food analyses from database`);

      // Validate and clean data before processing
      const validData = data.filter(analysis => {
        if (!analysis.id || !analysis.created_at) {
          console.warn('⚠️ Skipping invalid food analysis:', analysis);
          return false;
        }
        return true;
      });

      if (validData.length === 0) {
        console.warn('⚠️ No valid food data found after validation');
        return;
      }

      // Converti i dati del database nel formato dello store
      const foodSessions = validData.map((analysis) => ({
        id: analysis.id,
        timestamp: new Date(analysis.created_at),
        macronutrients: {
          carbohydrates: analysis.carbohydrates || 0,
          proteins: analysis.proteins || 0,
          fats: analysis.fats || 0,
          fiber: analysis.fiber || 0,
          calories: analysis.calories || 0,
        },
        meal_type: analysis.meal_type || 'other',
        health_score: analysis.health_score || 70,
        confidence: analysis.confidence || 0.8,
        identified_foods: analysis.identified_foods || [],
      }));

      // Sincronizza con lo store
      const store = useAnalysisStore.getState();
      if (foodSessions.length > 0) {
        // Aggiorna latest session
        store.addFoodSession(foodSessions[0]);
        
        // Aggiungi tutte le sessioni alla history (lo store gestisce il limite)
        foodSessions.forEach((session) => {
          store.addFoodSession(session);
        });
        
        console.log(`📊 Synced ${foodSessions.length} food sessions to store`);
      }

      console.log('✅ Food data loaded successfully');

    } catch (error) {
      console.error('❌ Error in loadFoodDataForCharts:', error);
    }
  }

  /**
   * Carica tutti i dati per i grafici
   */
  static async loadAllChartData(): Promise<void> {
    console.log('📊 Loading all chart data from Supabase...');
    
    await Promise.all([
      this.loadEmotionDataForCharts(),
      this.loadSkinDataForCharts(),
      this.loadFoodDataForCharts(),
    ]);
    
    console.log('✅ All chart data loaded and synchronized');
  }

  /**
   * Ottiene i dati delle emozioni per i grafici con fallback ai dati locali
   */
  static async getEmotionChartData(): Promise<{
    emotionHistory: any[];
    latestSession: any | null;
  }> {
    const store = useAnalysisStore.getState();
    
    // Se non ci sono dati locali, prova a caricare dal database
    if (store.emotionHistory.length === 0) {
      await this.loadEmotionDataForCharts();
    }
    
    return {
      emotionHistory: store.emotionHistory,
      latestSession: store.latestEmotionSession,
    };
  }

  /**
   * Ottiene i dati della pelle per i grafici con fallback ai dati locali
   */
  static async getSkinChartData(): Promise<{
    skinHistory: any[];
    latestCapture: any | null;
  }> {
    const store = useAnalysisStore.getState();
    
    // Se non ci sono dati locali, prova a caricare dal database
    if (store.skinHistory.length === 0) {
      await this.loadSkinDataForCharts();
    }
    
    return {
      skinHistory: store.skinHistory,
      latestCapture: store.latestSkinCapture,
    };
  }
}
