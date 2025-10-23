// Web-based TTS service using Web Speech API
export interface TTSVoice {
  identifier: string;
  name: string;
  language: string;
}

export class WebTTSService {
  private static instance: WebTTSService;
  private isSpeaking = false;
  private speechSynthesis: SpeechSynthesis | null = null;

  public static getInstance(): WebTTSService {
    if (!WebTTSService.instance) {
      WebTTSService.instance = new WebTTSService();
    }
    return WebTTSService.instance;
  }

  /**
   * Initialize Web Speech API
   */
  async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        this.speechSynthesis = window.speechSynthesis;
        console.log('Web Speech Synthesis API initialized');
      } else {
        console.log('Web Speech Synthesis API not available');
      }
    } catch (error) {
      console.error('Web TTS initialization error:', error);
    }
  }

  /**
   * Speak text using Web Speech API
   */
  async speak(text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    voice?: string;
  }): Promise<void> {
    try {
      const defaultOptions = {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.8,
        voice: undefined,
        ...options,
      };

      console.log('Web TTS Speaking:', text, 'with options:', defaultOptions);

      if (this.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = defaultOptions.language;
        utterance.pitch = defaultOptions.pitch;
        utterance.rate = defaultOptions.rate;
        utterance.volume = 1.0;

        // Set voice if specified
        if (defaultOptions.voice) {
          const voices = this.speechSynthesis.getVoices();
          const selectedVoice = voices.find(voice => voice.name === defaultOptions.voice);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }

        // Set up event handlers
        utterance.onstart = () => {
          console.log('Web TTS started');
          this.isSpeaking = true;
        };

        utterance.onend = () => {
          console.log('Web TTS finished');
          this.isSpeaking = false;
        };

        utterance.onerror = (error) => {
          console.error('Web TTS error:', error);
          this.isSpeaking = false;
        };

        // Speak the text
        this.speechSynthesis.speak(utterance);
      } else {
        // Fallback: simulate TTS with timing
        this.isSpeaking = true;
        console.log('🔊 Web TTS (Simulated):', text);
        
        setTimeout(() => {
          this.isSpeaking = false;
          console.log('Web TTS completed (simulated)');
        }, text.length * 100);
      }

    } catch (error) {
      console.error('Web TTS speak error:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Stop current speech
   */
  async stop(): Promise<void> {
    try {
      if (this.speechSynthesis) {
        this.speechSynthesis.cancel();
      }
      this.isSpeaking = false;
      console.log('Web TTS stopped');
    } catch (error) {
      console.error('Web TTS stop error:', error);
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
      if (this.speechSynthesis) {
        const voices = this.speechSynthesis.getVoices();
        return voices.map(voice => ({
          identifier: voice.name,
          name: voice.name,
          language: voice.lang,
        }));
      } else {
        return [
          { identifier: 'en-US', name: 'English (US)', language: 'en-US' },
          { identifier: 'en-GB', name: 'English (UK)', language: 'en-GB' },
        ];
      }
    } catch (error) {
      console.error('Error getting web voices:', error);
      return [];
    }
  }

  /**
   * Check if TTS is available
   */
  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Get engine status to align with mobile TTS diagnostics
   */
  async getEngineStatus(): Promise<{ available: boolean; voicesCount: number; voices: TTSVoice[]; type: string }> {
    const voices = await this.getAvailableVoices();
    return {
      available: voices.length > 0,
      voicesCount: voices.length,
      voices,
      type: this.speechSynthesis ? 'Web Speech API' : 'Simulated Web Speech',
    };
  }
}

export default WebTTSService;
