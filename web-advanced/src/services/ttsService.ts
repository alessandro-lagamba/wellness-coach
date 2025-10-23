/**
 * TTS Service for direct integration with Cartesia
 * Manages speaking state and audio playback
 */

export interface TTSResponse {
  audioBase64: string;
  duration: number;
  meta?: {
    provider: string;
    voice: string;
    language: string;
  };
}

export interface TTSOptions {
  voice?: string;
  language?: string;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
}

export class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private isCurrentlySpeaking = false;

  async speak(text: string, options: TTSOptions = {}): Promise<boolean> {
    const {
      voice = 'azzurra-voice', // Default to azzurra-voice as requested
      language = 'it',
      onSpeakingStart,
      onSpeakingEnd
    } = options;

    // Stop any current speech
    this.stop();

    try {
      console.log('[TTSService] 🎤 Starting TTS synthesis:', { 
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        textLength: text.length,
        voice, 
        language 
      });
      
      // Set speaking state
      this.isCurrentlySpeaking = true;
      onSpeakingStart?.();

      // Call TTS API
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          language
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TTSService] ❌ TTS API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200)
        });
        throw new Error(`TTS API error: ${response.status} - ${errorText}`);
      }

      const data: TTSResponse = await response.json();
      
      if (!data.audioBase64) {
        throw new Error('No audio data received from TTS service');
      }

      // Validate response metadata
      console.log('[TTSService] 🔍 TTS Response validation:', {
        audioLength: data.audioBase64.length,
        duration: data.duration,
        provider: data.meta?.provider,
        responseVoice: data.meta?.voice,
        responseLanguage: data.meta?.language,
        sampleRate: data.meta?.sampleRate
      });

      // Assert voice/language match (like requested in bug report)
      if (voice === 'azzurra-voice' && data.meta?.voice && !data.meta.voice.includes('d609f27f')) {
        console.error('[TTSService] ❌ VOICE MISMATCH! Expected azzurra-voice ID but got:', data.meta.voice);
        throw new Error(`Voice validation failed: expected azzurra-voice, got ${data.meta.voice}`);
      }

      if (language === 'it' && data.meta?.language !== 'it') {
        console.error('[TTSService] ❌ LANGUAGE MISMATCH! Expected Italian but got:', data.meta.language);
        throw new Error(`Language validation failed: expected 'it', got '${data.meta.language}'`);
      }

      console.log('[TTSService] ✅ Response validation passed');

      // Create audio blob and play
      const audioBlob = this.base64ToBlob(data.audioBase64, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      // Set up event handlers
      audio.onended = () => {
        console.log('[TTSService] Audio playback ended');
        URL.revokeObjectURL(audioUrl);
        this.isCurrentlySpeaking = false;
        this.currentAudio = null;
        onSpeakingEnd?.();
      };

      audio.onerror = (e) => {
        console.error('[TTSService] Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        this.isCurrentlySpeaking = false;
        this.currentAudio = null;
        onSpeakingEnd?.();
      };

      // Play audio
      await audio.play();
      console.log('[TTSService] Audio playback started');
      
      return true;

    } catch (error) {
      console.error('[TTSService] TTS error:', error);
      this.isCurrentlySpeaking = false;
      this.currentAudio = null;
      onSpeakingEnd?.();
      return false;
    }
  }

  stop(): void {
    if (this.currentAudio) {
      console.log('[TTSService] Stopping current audio');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isCurrentlySpeaking = false;
  }

  get isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Singleton instance
export const ttsService = new TTSService();
