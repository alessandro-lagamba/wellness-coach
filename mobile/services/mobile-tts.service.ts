// Mobile TTS service using expo-speech (dynamic import to avoid web issues)
export interface TTSVoice {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
  latency?: number;
  networkConnectionRequired?: boolean;
  notInstalled?: boolean;
}

export class MobileTTSService {
  private static instance: MobileTTSService;
  private isSpeaking = false;
  private isInitialized = false;
  private speechModule: typeof import('expo-speech') | null = null;
  private defaults = {
    language: 'en-US',
    rate: 0.5,
    pitch: 1.0,
    voiceId: undefined as string | undefined,
  };

  public static getInstance(): MobileTTSService {
    if (!MobileTTSService.instance) {
      MobileTTSService.instance = new MobileTTSService();
    }
    return MobileTTSService.instance;
  }

  private async loadSpeechModule() {
    if (!this.speechModule) {
      this.speechModule = await import('expo-speech');
    }
    return this.speechModule;
  }

  /**
   * Initialize expo-speech
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      console.log('Initializing Mobile TTS with expo-speech...');
      await this.loadSpeechModule();
      this.isInitialized = true;
      console.log('Mobile TTS initialized successfully');
    } catch (error) {
      console.error('Mobile TTS initialization error:', error);
    }
  }

  /**
   * Speak text using expo-speech
   */
  async speak(text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    voice?: string;
  }): Promise<void> {
    try {
      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Stop any current speech
      await this.stop();

      const Speech = await this.loadSpeechModule();

      const resolvedOptions = {
        language: options?.language ?? this.defaults.language,
        pitch: options?.pitch ?? this.defaults.pitch,
        rate: options?.rate ?? this.defaults.rate,
        voice: options?.voice ?? this.defaults.voiceId,
        onStart: () => {
          console.log('Mobile TTS started');
          this.isSpeaking = true;
        },
        onDone: () => {
          console.log('Mobile TTS finished');
          this.isSpeaking = false;
        },
        onStopped: () => {
          console.log('Mobile TTS stopped');
          this.isSpeaking = false;
        },
        onError: (error: any) => {
          console.error('Mobile TTS error:', error);
          this.isSpeaking = false;
        },
        ...options,
      };

      console.log('Mobile TTS Speaking:', text, 'with options:', resolvedOptions);
      await Speech.speak(text, resolvedOptions);
    } catch (error) {
      console.error('Mobile TTS speak error:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    try {
      if (!this.isSpeaking) {
        return;
      }

      const Speech = await this.loadSpeechModule();
      await Speech.stop();
      this.isSpeaking = false;
      console.log('Mobile TTS stopped');
    } catch (error) {
      console.error('Mobile TTS stop error:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<TTSVoice[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const Speech = await this.loadSpeechModule();
      const voices = await Speech.getAvailableVoicesAsync();
      console.log('Available Mobile TTS voices:', voices);
      return voices.map((voice) => ({
        identifier: voice.identifier,
        name: voice.name,
        language: voice.language,
        quality: voice.quality,
      }));
    } catch (error) {
      console.error('Error getting mobile voices:', error);
      return [];
    }
  }

  /**
   * Set default voice
   */
  async setDefaultVoice(voiceId: string): Promise<void> {
    this.defaults.voiceId = voiceId;
    console.log('Default mobile voice set to:', voiceId);
  }

  /**
   * Set default language
   */
  async setDefaultLanguage(language: string): Promise<void> {
    this.defaults.language = language;
    console.log('Default mobile language set to:', language);
  }

  /**
   * Set default rate (speed)
   */
  async setDefaultRate(rate: number): Promise<void> {
    this.defaults.rate = rate;
    console.log('Default mobile rate set to:', rate);
  }

  /**
   * Set default pitch
   */
  async setDefaultPitch(pitch: number): Promise<void> {
    this.defaults.pitch = pitch;
    console.log('Default mobile pitch set to:', pitch);
  }

  /**
   * Speak with a specific voice
   */
  async speakWithVoice(text: string, voice: TTSVoice, options?: {
    pitch?: number;
    rate?: number;
  }): Promise<void> {
    try {
      await this.speak(text, {
        voice: voice.identifier,
        pitch: options?.pitch,
        rate: options?.rate,
      });
    } catch (error) {
      console.error('Mobile TTS speakWithVoice error:', error);
    }
  }

  /**
   * Check if TTS is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const voices = await this.getAvailableVoices();
      return voices.length > 0;
    } catch (error) {
      console.error('Error checking mobile TTS availability:', error);
      return false;
    }
  }

  /**
   * Get TTS engine status
   */
  async getEngineStatus(): Promise<any> {
    try {
      const voices = await this.getAvailableVoices();
      return {
        available: voices.length > 0,
        voicesCount: voices.length,
        voices,
        type: 'Expo Speech',
      };
    } catch (error) {
      console.error('Error getting mobile engine status:', error);
      return { available: false, voicesCount: 0, voices: [], type: 'Expo Speech' };
    }
  }
}

export default MobileTTSService;
