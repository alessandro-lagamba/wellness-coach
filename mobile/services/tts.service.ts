// Unified TTS service that automatically chooses the right implementation
import { Platform } from 'react-native';
import WebTTSService from './web-tts.service';
import UnifiedTTSService from './unified-tts.service'; // 🔧 RINOMINATO: Da CartesiaTTSService a UnifiedTTSService

export interface TTSVoice {
  identifier: string;
  name: string;
  language: string;
  quality?: number;
  latency?: number;
  networkConnectionRequired?: boolean;
  notInstalled?: boolean;
}

export class TTSService {
  private static instance: TTSService;
  private webTTS: WebTTSService;
  private unifiedTTS: UnifiedTTSService; // 🔧 RINOMINATO: Da cartesiaTTS a unifiedTTS
  private currentTTS: WebTTSService | UnifiedTTSService; // 🔧 RINOMINATO: Da CartesiaTTSService a UnifiedTTSService

  public static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  constructor() {
    this.webTTS = WebTTSService.getInstance();
    this.unifiedTTS = UnifiedTTSService.getInstance(); // 🔧 RINOMINATO: Da cartesiaTTS a unifiedTTS
    
    // Choose the appropriate TTS service based on platform
    if (Platform.OS === 'web') {
      this.currentTTS = this.webTTS;
    } else {
      // 🔧 PRIORITÀ: Unified TTS (ElevenLabs → Cartesia → expo-speech)
      this.currentTTS = this.unifiedTTS;
    }
  }

  /**
   * Initialize TTS engine
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Initializing TTS for platform: ${Platform.OS}`);
      
      if (Platform.OS !== 'web') {
        // 🔧 USA UNIFIED TTS (ElevenLabs → Cartesia → expo-speech)
        console.log('🎤 Using Unified TTS (ElevenLabs → Cartesia → expo-speech)');
        this.currentTTS = this.unifiedTTS;
      }
      
      await this.currentTTS.initialize();
    } catch (error) {
      console.error('TTS initialization error:', error);
    }
  }

  /**
   * Speak text using the appropriate TTS engine
   */
  async speak(text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    voice?: string;
  }): Promise<void> {
    try {
      console.log(`Speaking on platform: ${Platform.OS}`);
      await this.currentTTS.speak(text, options);
    } catch (error) {
      console.error('TTS speak error:', error);
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    try {
      await this.currentTTS.stop();
    } catch (error) {
      console.error('TTS stop error:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.currentTTS.isCurrentlySpeaking();
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      return await this.currentTTS.getAvailableVoices();
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  }

  /**
   * Set default voice (mobile only)
   */
  async setDefaultVoice(voiceId: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await (this.cartesiaTTS as CartesiaTTSService).setDefaultVoice?.(voiceId);
      }
    } catch (error) {
      console.error('Error setting default voice:', error);
    }
  }

  /**
   * Set default language (mobile only)
   */
  async setDefaultLanguage(language: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await (this.cartesiaTTS as CartesiaTTSService).setDefaultLanguage?.(language);
      }
    } catch (error) {
      console.error('Error setting default language:', error);
    }
  }

  /**
   * Set default rate (mobile only)
   */
  async setDefaultRate(rate: number): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await (this.cartesiaTTS as CartesiaTTSService).setDefaultRate?.(rate);
      }
    } catch (error) {
      console.error('Error setting default rate:', error);
    }
  }

  /**
   * Set default pitch (mobile only)
   */
  async setDefaultPitch(pitch: number): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        await (this.cartesiaTTS as CartesiaTTSService).setDefaultPitch?.(pitch);
      }
    } catch (error) {
      console.error('Error setting default pitch:', error);
    }
  }

  /**
   * Speak with a specific voice
   */
  async speakWithVoice(text: string, voice: TTSVoice, options?: {
    pitch?: number;
    rate?: number;
  }): Promise<void> {
    try {
      await this.currentTTS.speak(text, {
        voice: voice.identifier,
        ...options,
      });
    } catch (error) {
      console.error('TTS speakWithVoice error:', error);
    }
  }

  /**
   * Check if TTS is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.currentTTS.isAvailable();
    } catch (error) {
      console.error('Error checking TTS availability:', error);
      return false;
    }
  }

  /**
   * Get TTS engine status
   */
  async getEngineStatus(): Promise<any> {
    try {
      const status = await this.currentTTS.getEngineStatus?.() || { available: false };
      return {
        ...status,
        platform: Platform.OS,
        type: Platform.OS === 'web' ? 'Web Speech API' : 'Unified TTS (ElevenLabs → Cartesia → expo-speech)', // 🔧 AGGIORNATO
      };
    } catch (error) {
      console.error('Error getting engine status:', error);
      return { 
        available: false, 
        voicesCount: 0, 
        voices: [], 
        platform: Platform.OS,
        type: Platform.OS === 'web' ? 'Web Speech API' : (this.currentTTS instanceof ElevenLabsTTSService ? 'ElevenLabs TTS' : 'Cartesia TTS')
      };
    }
  }
}

export default TTSService;