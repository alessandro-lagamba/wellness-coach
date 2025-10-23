import { create } from 'zustand';
import { SkinAnalysisResults, EmotionData } from '../types/analysis.types';

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

interface AnalysisStore {
  // Skin Analysis
  latestSkinCapture: SkinCapture | null;
  skinHistory: SkinCapture[];
  
  // Emotion Analysis  
  latestEmotionSession: EmotionSession | null;
  emotionHistory: EmotionSession[];
  
  // Actions
  addSkinCapture: (capture: SkinCapture) => void;
  addEmotionSession: (session: EmotionSession) => void;
  clearHistory: () => void;
  
  // ✅ FIX: Add safe getters for empty state handling
  getSafeSkinHistory: () => SkinCapture[];
  getSafeEmotionHistory: () => EmotionSession[];
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  // Initial state
  latestSkinCapture: null,
  skinHistory: [],
  latestEmotionSession: null,
  emotionHistory: [],
  
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
  
  clearHistory: () => {
    console.log('📊 Clearing analysis history');
    set({
      latestSkinCapture: null,
      skinHistory: [],
      latestEmotionSession: null,
      emotionHistory: [],
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
}));
