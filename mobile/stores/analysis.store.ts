import { create } from 'zustand';
import { SkinAnalysisResults, EmotionData, FoodAnalysisResult } from '../types/analysis.types';

// Types for our store
interface SkinCapture {
  id: string;
  timestamp: Date;
  scores: {
    texture: number;
    redness: number;
    hydration: number;
    oiliness: number;
    overall: number;
  };
  confidence: number;
  quality: {
    lighting: number;
    focus: number;
    roi_coverage: number;
  };
  photoUri?: string;
}

export interface EmotionSession {
  id: string;
  timestamp: Date;
  dominant: string;
  avg_valence: number;
  avg_arousal: number;
  confidence: number;
  duration: number; // in seconds
}

export interface FoodSession {
  id: string;
  timestamp: Date;
  macronutrients: {
    carbohydrates: number;
    proteins: number;
    fats: number;
    fiber?: number;
    calories: number;
  };
  meal_type: string;
  health_score: number;
  confidence: number;
  identified_foods: string[];
}

interface AnalysisStore {
  // Skin Analysis
  latestSkinCapture: SkinCapture | null;
  skinHistory: SkinCapture[];
  
  // Emotion Analysis  
  latestEmotionSession: EmotionSession | null;
  emotionHistory: EmotionSession[];
  
  // Food Analysis
  latestFoodSession: FoodSession | null;
  foodHistory: FoodSession[];
  
  // Actions
  addSkinCapture: (capture: SkinCapture) => void;
  addEmotionSession: (session: EmotionSession) => void;
  addFoodSession: (session: FoodSession) => void;
  setFoodSessions: (sessions: FoodSession[]) => void;
  clearHistory: () => void;
  
  // ✅ FIX: Add safe getters for empty state handling
  getSafeSkinHistory: () => SkinCapture[];
  getSafeEmotionHistory: () => EmotionSession[];
  getSafeFoodHistory: () => FoodSession[];
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  // Initial state
  latestSkinCapture: null,
  skinHistory: [],
  latestEmotionSession: null,
  emotionHistory: [],
  latestFoodSession: null,
  foodHistory: [],
  
  // Actions
  addSkinCapture: (capture: SkinCapture) => {
    console.log('📊 Adding skin capture to store:', capture.id);
    set((state) => ({
      latestSkinCapture: capture,
      skinHistory: [capture, ...state.skinHistory.slice(0, 29)], // Keep last 30
    }));
  },
  
  addEmotionSession: (session: EmotionSession) => {
    console.log('📊 Adding emotion session to store:', session.id);
    set((state) => ({
      latestEmotionSession: session,
      emotionHistory: [session, ...state.emotionHistory.slice(0, 29)], // Keep last 30
    }));
  },
  
  addFoodSession: (session: FoodSession) => {
    console.log('📊 Adding food session to store:', session.id);
    set((state) => {
      const filteredHistory = state.foodHistory.filter((item) => item.id !== session.id);
      const updatedHistory = [session, ...filteredHistory].slice(0, 30);
      const shouldUpdateLatest =
        !state.latestFoodSession ||
        new Date(session.timestamp).getTime() >= new Date(state.latestFoodSession.timestamp).getTime();

      return {
        latestFoodSession: shouldUpdateLatest ? session : state.latestFoodSession,
        foodHistory: updatedHistory,
      };
    });
  },
  
  setFoodSessions: (sessions: FoodSession[]) => {
    console.log('📊 Setting food sessions in store:', sessions.length);
    set(() => ({
      latestFoodSession: sessions.length > 0 ? sessions[0] : null,
      foodHistory: sessions.slice(0, 30),
    }));
  },
  
  clearHistory: () => {
    console.log('📊 Clearing analysis history');
    set({
      latestSkinCapture: null,
      skinHistory: [],
      latestEmotionSession: null,
      emotionHistory: [],
      latestFoodSession: null,
      foodHistory: [],
    });
  },
  
  // ✅ FIX: Safe getters that always return arrays
  getSafeSkinHistory: () => {
    const state = get();
    return Array.isArray(state.skinHistory) ? state.skinHistory : [];
  },
  
  getSafeEmotionHistory: () => {
    const state = get();
    return Array.isArray(state.emotionHistory) ? state.emotionHistory : [];
  },
  
  getSafeFoodHistory: () => {
    const state = get();
    return Array.isArray(state.foodHistory) ? state.foodHistory : [];
  },
}));
