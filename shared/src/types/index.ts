/**
 * Shared Types Index
 * Re-exports all type definitions
 */

// Voice chat types are defined in the voice modules themselves
export type { UseVoiceChatOptions, UseVoiceChatReturn } from '../voice/useVoiceChat';

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Emotion types
export interface EmotionContext {
  valence: number;
  arousal: number;
  dominantEmotion: string;
  confidence: number;
}

export interface EmotionAnalysis {
  emotions: Record<string, number>;
  valence: number;
  arousal: number;
  dominantEmotion: string;
  confidence: number;
  timestamp: Date;
}

// Avatar types
export interface AvatarToken {
  token: string;
  expiresAt: Date;
  provider: string;
}

export interface AvatarServicesStatus {
  simli: boolean;
  readyPlayerMe: boolean;
  liveKit: boolean;
}