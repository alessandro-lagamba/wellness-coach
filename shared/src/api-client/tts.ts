/**
 * TTS API Adapter
 * Adapter for existing TTS integration (Cartesia/OpenAI)
 */

// ========================================
// TTS ADAPTER INTERFACE
// ========================================

export interface TTSAdapter {
  synthesize(
    text: string,
    options: TTSSynthesisOptions
  ): Promise<TTSResult>;
  
  getAvailableVoices(): Promise<TTSVoice[]>;
  getSupportedLanguages(): string[];
}

// ========================================
// TTS TYPES
// ========================================

export interface TTSSynthesisOptions {
  voice?: string;
  language?: string;
  provider?: 'cartesia' | 'openai' | 'polly';
  speed?: number;
  pitch?: number;
  volume?: number;
  format?: 'mp3' | 'wav' | 'pcm';
  includeVisemes?: boolean;
  emotionContext?: {
    dominantEmotion: string;
    intensity: number;
  };
}

export interface TTSResult {
  audioBase64: string;
  duration: number;
  visemes?: TTSViseme[];
  phonemes?: TTSPhoneme[];
  format: string;
  sampleRate: number;
  metadata?: {
    provider: string;
    voice: string;
    language: string;
    tokens?: number;
  };
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: string;
  description?: string;
  preview?: string; // URL to preview audio
}

export interface TTSViseme {
  time: number;
  code: string;
  end?: number;
}

export interface TTSPhoneme {
  start: number;
  end: number;
  value: string;
  time?: number;
}

// ========================================
// EXISTING BACKEND ADAPTER
// ========================================

export class ExistingTTSAdapter implements TTSAdapter {
  constructor(
    private baseUrl: string = 'http://localhost:3001',
    private apiKey?: string
  ) {}

  async synthesize(
    text: string,
    options: TTSSynthesisOptions = {}
  ): Promise<TTSResult> {
    try {
      // Use secure backend proxy (no API keys exposed)
      const payload = {
        text,
        voice: options.voice || 'd718e944-b313-4998-b011-d1cc078d4ef3', // Liv voice default
        language: options.language || 'it',
        provider: options.provider || 'cartesia',
        includeVisemes: options.includeVisemes ?? true,
        emotionContext: options.emotionContext
      };

      console.log('[TTS Adapter] 🎤 Synthesizing via secure proxy:', {
        textLength: text.length,
        voice: payload.voice,
        provider: payload.provider
      });

      const response = await fetch(`${this.baseUrl}/api/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No API key needed - handled by backend
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      const data = rawData as {
        success?: boolean;
        data?: {
          audioBase64?: string;
          visemes?: any[];
          duration?: number;
          phonemes?: any[];
          tokens?: number;
        };
        error?: string;
      };
      
      if (!data.success || !data.data?.audioBase64) {
        throw new Error(`TTS synthesis failed: ${data.error || 'No audio data'}`);
      }

      console.log('[TTS Adapter] ✅ Synthesis completed:', {
        audioSize: data.data.audioBase64.length,
        visemeCount: data.data.visemes?.length || 0,
        duration: data.data.duration || 0
      });

      return {
        audioBase64: data.data.audioBase64,
        duration: data.data.duration || this.estimateDuration(text),
        visemes: data.data.visemes || [],
        phonemes: data.data.phonemes || [],
        format: this.getAudioFormat(options.provider || 'cartesia'),
        sampleRate: this.getSampleRate(options.provider || 'cartesia'),
        metadata: {
          provider: payload.provider,
          voice: payload.voice,
          language: payload.language,
          tokens: data.data.tokens
        }
      };
    } catch (error) {
      console.error('[TTS Adapter] ❌ Synthesis error:', error);
      throw error;
    }
  }

  async getAvailableVoices(): Promise<TTSVoice[]> {
    // Return predefined voices based on existing backend configuration
    return [
      {
        id: 'd718e944-b313-4998-b011-d1cc078d4ef3',
        name: 'Liv',
        language: 'it',
        gender: 'female',
        provider: 'cartesia',
        description: 'Voce femminile italiana, calda e professionale'
      },
      {
        id: 'e5923af7-a329-4e9b-b95a-5ace4a083535',
        name: 'Marco',
        language: 'it',
        gender: 'male',
        provider: 'cartesia',
        description: 'Voce maschile italiana, rassicurante'
      },
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'it',
        gender: 'neutral',
        provider: 'openai',
        description: 'Voce neutra OpenAI TTS'
      }
    ];
  }

  getSupportedLanguages(): string[] {
    return ['it', 'en', 'es', 'fr', 'de'];
  }

  private estimateDuration(text: string): number {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const estimatedWords = text.length / charactersPerWord;
    const estimatedMinutes = estimatedWords / wordsPerMinute;
    return Math.max(1000, estimatedMinutes * 60 * 1000); // milliseconds
  }

  private getAudioFormat(provider: string): string {
    switch (provider) {
      case 'cartesia':
        return 'wav'; // PCM16 16KHz
      case 'openai':
        return 'mp3';
      case 'polly':
        return 'mp3';
      default:
        return 'wav';
    }
  }

  private getSampleRate(provider: string): number {
    switch (provider) {
      case 'cartesia':
        return 16000; // 16KHz for Simli compatibility
      case 'openai':
        return 24000;
      case 'polly':
        return 22050;
      default:
        return 16000;
    }
  }
}

// ========================================
// ENHANCED TTS FOR WELLNESS COACHING
// ========================================

export class WellnessTTSAdapter extends ExistingTTSAdapter {
  async synthesizeWithEmotion(
    text: string,
    emotionContext: {
      dominantEmotion: string;
      intensity: number;
      valence: number;
      arousal: number;
    },
    options: TTSSynthesisOptions = {}
  ): Promise<TTSResult> {
    // Enhance options with emotion-based voice parameters
    const enhancedOptions = this.applyEmotionToVoice(options, emotionContext);
    
    return await this.synthesize(text, enhancedOptions);
  }

  async synthesizeCoachingResponse(
    text: string,
    coachingContext: {
      type: 'encouragement' | 'instruction' | 'empathy' | 'celebration';
      urgency: 'low' | 'medium' | 'high';
      userEmotion?: string;
    },
    options: TTSSynthesisOptions = {}
  ): Promise<TTSResult> {
    // Adjust voice parameters based on coaching context
    const coachingOptions = this.applyCoachingStyle(options, coachingContext);
    
    return await this.synthesize(text, coachingOptions);
  }

  private applyEmotionToVoice(
    options: TTSSynthesisOptions,
    emotionContext: {
      dominantEmotion: string;
      intensity: number;
      valence: number;
      arousal: number;
    }
  ): TTSSynthesisOptions {
    const enhanced = { ...options };
    
    // Adjust speed based on arousal
    if (emotionContext.arousal > 0.5) {
      enhanced.speed = Math.min(1.2, (options.speed || 1) * 1.1); // Slightly faster for high arousal
    } else if (emotionContext.arousal < -0.5) {
      enhanced.speed = Math.max(0.8, (options.speed || 1) * 0.9); // Slightly slower for low arousal
    }
    
    // Adjust pitch based on valence
    if (emotionContext.valence > 0.5) {
      enhanced.pitch = Math.min(1.1, (options.pitch || 1) * 1.05); // Slightly higher for positive emotions
    } else if (emotionContext.valence < -0.5) {
      enhanced.pitch = Math.max(0.9, (options.pitch || 1) * 0.95); // Slightly lower for negative emotions
    }
    
    // Add emotion context for backend processing
    enhanced.emotionContext = {
      dominantEmotion: emotionContext.dominantEmotion,
      intensity: emotionContext.intensity
    };
    
    return enhanced;
  }

  private applyCoachingStyle(
    options: TTSSynthesisOptions,
    coachingContext: {
      type: 'encouragement' | 'instruction' | 'empathy' | 'celebration';
      urgency: 'low' | 'medium' | 'high';
      userEmotion?: string;
    }
  ): TTSSynthesisOptions {
    const enhanced = { ...options };
    
    switch (coachingContext.type) {
      case 'encouragement':
        enhanced.pitch = Math.min(1.1, (options.pitch || 1) * 1.05);
        enhanced.speed = Math.max(0.9, (options.speed || 1) * 0.95);
        break;
        
      case 'instruction':
        enhanced.speed = Math.max(0.85, (options.speed || 1) * 0.9);
        enhanced.pitch = options.pitch || 1; // Neutral
        break;
        
      case 'empathy':
        enhanced.speed = Math.max(0.8, (options.speed || 1) * 0.85);
        enhanced.pitch = Math.max(0.95, (options.pitch || 1) * 0.98);
        break;
        
      case 'celebration':
        enhanced.pitch = Math.min(1.15, (options.pitch || 1) * 1.1);
        enhanced.speed = Math.min(1.1, (options.speed || 1) * 1.05);
        break;
    }
    
    // Adjust for urgency
    if (coachingContext.urgency === 'high') {
      enhanced.speed = Math.min(1.2, (enhanced.speed || 1) * 1.1);
    }
    
    return enhanced;
  }
}

// ========================================
// FACTORY & SINGLETON
// ========================================

let ttsAdapterInstance: TTSAdapter | null = null;

export function createTTSAdapter(config?: {
  baseUrl?: string;
  apiKey?: string;
  type?: 'existing' | 'wellness';
}): TTSAdapter {
  if (!ttsAdapterInstance) {
    if (config?.type === 'wellness') {
      ttsAdapterInstance = new WellnessTTSAdapter(
        config?.baseUrl,
        config?.apiKey
      );
    } else {
      ttsAdapterInstance = new ExistingTTSAdapter(
        config?.baseUrl,
        config?.apiKey
      );
    }
  }
  
  return ttsAdapterInstance;
}

export function getTTSAdapter(): TTSAdapter {
  if (!ttsAdapterInstance) {
    return createTTSAdapter({ type: 'wellness' });
  }
  
  return ttsAdapterInstance;
}
