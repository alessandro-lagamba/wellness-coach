/**
 * Emotion Detection Service (Mobile)
 * Connects to the backend API and avoids any removed native dependencies.
 */

import type { CameraCapturedPicture } from 'expo-camera';
import { BACKEND_URL } from '../constants/env';

export interface EmotionBreakdown {
  happiness: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  neutral?: number;
}

export interface EmotionData {
  dominantEmotion: string;
  valence: number;
  arousal: number;
  confidence: number;
  emotions: EmotionBreakdown;
  timestamp: string;
  source?: 'backend' | 'fallback';
}

interface EmotionResponseBody {
  success: boolean;
  data?: EmotionData;
  error?: string;
}

class EmotionDetectionService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  async processFrame(): Promise<EmotionData | null> {
    // Real-time processing is currently handled server-side only.
    return null;
  }

  async processPhoto(photo: CameraCapturedPicture): Promise<EmotionData | null> {
    if (!photo?.uri && !photo?.base64) {
      console.warn('[EmotionDetection] No photo data available');
      return null;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (!photo.base64) {
        console.warn('[EmotionDetection] Missing base64 data, using fallback result');
        return {
          dominantEmotion: 'neutral',
          valence: 0,
          arousal: 0.4,
          confidence: 0.5,
          emotions: {
            happiness: 0.2,
            sadness: 0.1,
            anger: 0.1,
            fear: 0.1,
            surprise: 0.1,
            disgust: 0.05,
            neutral: 0.35,
          },
          timestamp: new Date().toISOString(),
          source: 'fallback',
        };
      }

      const payload = {
        image: photo.base64.startsWith('data:')
          ? photo.base64
          : `data:image/jpeg;base64,${photo.base64}`,
        sessionId: 'mobile-app',
      };

      const response = await fetch(`${BACKEND_URL}/api/emotion/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const json: EmotionResponseBody = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Invalid emotion analysis response');
      }

      return {
        ...json.data,
        source: 'backend',
      };
    } catch (error) {
      console.error('[EmotionDetection] Photo analysis failed:', error);
      return {
        dominantEmotion: 'neutral',
        valence: 0,
        arousal: 0.4,
        confidence: 0.5,
        emotions: {
          happiness: 0.2,
          sadness: 0.1,
          anger: 0.1,
          fear: 0.1,
          surprise: 0.1,
          disgust: 0.05,
          neutral: 0.35,
        },
        timestamp: new Date().toISOString(),
        source: 'fallback',
      };
    }
  }

  async cleanup(): Promise<void> {
    this.initialized = false;
  }
}

const emotionDetectionService = new EmotionDetectionService();
export default emotionDetectionService;
