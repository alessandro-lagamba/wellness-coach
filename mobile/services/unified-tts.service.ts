// Unified TTS service for mobile - ElevenLabs via backend + expo-speech fallback
import { BACKEND_URL } from '../constants/env';
import * as Speech from 'expo-speech';

export interface UnifiedTTSOptions {
  language?: string;
  voice?: string;
  speed?: string;
}

export class UnifiedTTSService {
  private static instance: UnifiedTTSService;
  private isSpeaking = false;

  public static getInstance(): UnifiedTTSService {
    if (!UnifiedTTSService.instance) {
      UnifiedTTSService.instance = new UnifiedTTSService();
    }
    return UnifiedTTSService.instance;
  }

  /**
   * Initialize Unified TTS (ElevenLabs + expo-speech fallback)
   */
  async initialize(): Promise<void> {
    //console.log('Unified TTS initialized (ElevenLabs → expo-speech)');
  }

  /**
   * Speak text using ElevenLabs via backend, with expo-speech fallback
   * Priority: ElevenLabs → expo-speech
   */
  async speak(text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    voice?: string;
  }): Promise<void> {
    try {
      // Stop any current speech
      await this.stop();

      console.log('Unified TTS speaking:', text);

      // Try ElevenLabs via backend
      try {
        const elevenLabsResponse = await this.tryElevenLabsViaBackend(text, options);
        if (elevenLabsResponse) {
          console.log('🎤 Using ElevenLabs TTS via backend (highest quality)');
          await this.playAudio(elevenLabsResponse);
          return;
        }
      } catch (error) {
        console.warn('⚠️ ElevenLabs TTS failed, falling back to expo-speech:', error);
      }

      // 🔧 FALLBACK: expo-speech
      console.log('🎤 Using expo-speech fallback (basic quality)');
      await this.speakWithExpoSpeech(text, options);

    } catch (error) {
      console.error('❌ TTS failed:', error);
      throw error;
    }
  }

  /**
   * Try ElevenLabs TTS via backend
   */
  private async tryElevenLabsViaBackend(text: string, options?: any): Promise<string | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: options?.voice || 'kAzI34nYjizE0zON6rXv', // Italian voice
          language: options?.language || 'it',
          provider: 'elevenlabs',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          return data.audioBase64;
        }
      }
      return null;
    } catch (error) {
      console.error('ElevenLabs backend error:', error);
      return null;
    }
  }

  /**
   * Play audio from base64 data
   */
  private async playAudio(audioBase64: string): Promise<void> {
    this.isSpeaking = true;

    try {
      // Create audio from base64 and play it
      const audioUri = `data:audio/mpeg;base64,${audioBase64}`;

      // Use expo-av to play the ElevenLabs audio
      const { Audio } = await import('expo-av');
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      // Set up completion handler
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.isSpeaking = false;
          sound.unloadAsync();
        }
      });

      console.log('🎤 ElevenLabs TTS playing actual generated audio');
    } catch (error) {
      console.error('Error playing audio:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Fallback to expo-speech
   */
  private async speakWithExpoSpeech(text: string, options?: any): Promise<void> {
    this.isSpeaking = true;

    try {
      await Speech.speak(text, {
        language: options?.language || 'it-IT',
        pitch: options?.pitch || 1.0,
        rate: options?.rate || 0.8,
      });

      // Wait for speech to complete
      await new Promise<void>((resolve) => {
        const checkComplete = () => {
          if (!Speech.isSpeakingAsync()) {
            this.isSpeaking = false;
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    } catch (error) {
      console.error('expo-speech error:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    if (this.isSpeaking) {
      try {
        await Speech.stop();
        this.isSpeaking = false;
      } catch (error) {
        console.error('Error stopping speech:', error);
      }
    }
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}