import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nxxuhadbyoznzivktoje.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eHVoYWRieW96bnppdmt0b2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NjAxODgsImV4cCI6MjA3NTQzNjE4OH0.1q0I6mZ_00V6kvTz5kNcFOn8ce0PyOItlTIzYTG2piM';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // 🔥 FIX: Enable URL detection for deep links
    storage: AsyncStorage, // 🔥 FIX: Use AsyncStorage for session persistence
  },
});

// Database Types
export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weight?: number; // kg
  height?: number; // cm
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  timezone?: string;
  preferences?: Record<string, any>;
  nutritional_goals?: {
    daily_calories?: number;
    carbs_percentage?: number;
    proteins_percentage?: number;
    fats_percentage?: number;
    source?: 'manual' | 'ai_suggested' | 'nutritionist';
  };
  avatar_url?: string; // URL dell'avatar generato
  created_at: string;
  updated_at: string;
}

export interface EmotionAnalysis {
  id: string;
  user_id: string;
  dominant_emotion: string;
  valence: number;
  arousal: number;
  confidence: number;
  analysis_data?: Record<string, any>;
  session_duration?: number;
  created_at: string;
}

export interface SkinAnalysis {
  id: string;
  user_id: string;
  overall_score: number;
  hydration_score?: number;
  oiliness_score?: number;
  texture_score?: number;
  pigmentation_score?: number;
  redness_score?: number;  // Added redness score
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  analysis_data?: Record<string, any>;
  image_url?: string;
  created_at: string;
}

export interface FoodAnalysis {
  id: string;
  user_id: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  identified_foods: string[];
  calories: number;
  carbohydrates: number;
  proteins: number;
  fats: number;
  fiber?: number;
  vitamins?: Record<string, number>;
  minerals?: Record<string, number>;
  health_score?: number;
  recommendations: string[];
  observations: string[];
  confidence: number;
  analysis_data?: Record<string, any>;
  image_url?: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  session_name?: string;
  emotion_context?: Record<string, any>;
  skin_context?: Record<string, any>;
  started_at: string;
  ended_at?: string;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  emotion_context?: Record<string, any>;
  wellness_suggestion_id?: string;
  created_at: string;
}

export interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'emotion' | 'skin' | 'lifestyle' | 'stress' | 'sleep' | 'nutrition';
  content: string;
  actionable_steps: string[];
  priority_level: 'low' | 'medium' | 'high';
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface UserWellnessSuggestion {
  id: string;
  user_id: string;
  suggestion_id: string;
  suggested_at: string;
  viewed_at?: string;
  completed_at?: string;
  feedback_rating?: number;
  feedback_comment?: string;
  is_dismissed: boolean;
}

export interface UserInsight {
  id: string;
  user_id: string;
  insight_type: 'emotion_trend' | 'skin_trend' | 'correlation' | 'progress' | 'recommendation';
  title: string;
  description: string;
  data?: Record<string, any>;
  confidence?: number;
  is_viewed: boolean;
  created_at: string;
}

// Database Tables
export const Tables = {
  USER_PROFILES: 'user_profiles',
  EMOTION_ANALYSES: 'emotion_analyses',
  SKIN_ANALYSES: 'skin_analyses',
  FOOD_ANALYSES: 'food_analyses',
  CHAT_SESSIONS: 'chat_sessions',
  CHAT_MESSAGES: 'chat_messages',
  WELLNESS_SUGGESTIONS_CATALOG: 'wellness_suggestions_catalog',
  USER_WELLNESS_SUGGESTIONS: 'user_wellness_suggestions',
  USER_INSIGHTS: 'user_insights',
  HEALTH_DATA: 'health_data',
  USER_FEEDBACKS: 'user_feedbacks',
} as const;


