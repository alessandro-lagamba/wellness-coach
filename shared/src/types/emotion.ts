/**
 * Emotion Types - Simplified for Smoke Test
 */

import { z } from 'zod';

// Basic emotion analysis
export interface EmotionAnalysis {
  dominantEmotion: string;
  valence: number;
  arousal: number;
  timestamp: string;
}

export interface EmotionContext {
  dominantEmotion: string;
  valence: number;
  arousal: number;
}

// Simple wellness suggestion
export interface WellnessSuggestion {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  actionable: string;
  icon: string;
}

// Priority mapping
export const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

// Simple emotion to suggestion mapping
export const defaultEmotionSuggestions: Record<string, WellnessSuggestion[]> = {
  stressed: [
    {
      id: 'breathing_exercise',
      type: 'mental_health',
      priority: 'high',
      title: 'Breathing Exercise',
      description: 'Take 5 deep breaths',
      actionable: 'Breathe in for 4, hold for 4, breathe out for 4',
      icon: '🫁'
    }
  ],
  happy: [
    {
      id: 'celebrate',
      type: 'mental_health',
      priority: 'medium',
      title: 'Celebrate',
      description: 'Enjoy this positive moment',
      actionable: 'Share your happiness with someone',
      icon: '😊'
    }
  ]
};

// Simple function to get suggestions
export const getSuggestionsForEmotion = (emotion: string): WellnessSuggestion[] => {
  return defaultEmotionSuggestions[emotion] || [];
};

// Simple function to calculate priority score
export const calculatePriorityScore = (suggestion: WellnessSuggestion): number => {
  const priority = suggestion.priority as keyof typeof PRIORITY_WEIGHTS;
  return PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.low;
};