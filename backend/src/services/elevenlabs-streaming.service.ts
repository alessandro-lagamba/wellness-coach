/**
 * ElevenLabs Streaming TTS Service
 * Uses Turbo Flash model for ultra-low latency (75ms)
 * Supports streaming for progressive audio playback
 */

export interface ElevenLabsStreamOptions {
  voiceId?: string;
  modelId?: string;
  language?: string;
  stability?: number;
  similarityBoost?: number;
}

export class ElevenLabsStreamingService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  // Default Italian voice ID (same as traditional chat)
  private defaultVoiceId = 'kAzI34nYjizE0zON6rXv';

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  /**
   * Stream audio from ElevenLabs using Turbo Flash model
   * Returns ReadableStream for immediate progressive playback
   */
  async streamAudio(
    text: string,
    options: ElevenLabsStreamOptions = {}
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      const {
        voiceId = this.defaultVoiceId,
        modelId = 'eleven_turbo_v2', // ← Ultra-low latency model
        stability = 0.5, // Same as traditional chat
        similarityBoost = 0.5 // Same as traditional chat
      } = options;

      console.log('[ElevenLabs Streaming] 🚀 Starting stream:', {
        textLength: text.length,
        voiceId,
        modelId,
        timestamp: new Date().toISOString()
      });

      const startTime = Date.now();

      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            voice_settings: {
              stability: stability,
              similarity_boost: similarityBoost,
              style: 0.0,
              use_speaker_boost: true // Same as traditional chat
            },
            optimize_streaming_latency: 2 // ← Maximum optimization
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ElevenLabs Streaming] ❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`ElevenLabs streaming failed: ${response.status} ${errorText}`);
      }

      const ttfb = Date.now() - startTime;
      console.log('[ElevenLabs Streaming] ⚡ Time to first byte:', ttfb, 'ms');
      console.log('[ElevenLabs Streaming] ✅ Stream started, returning readable stream');

      // Return the response body directly as ReadableStream
      return response.body as ReadableStream<Uint8Array>;

    } catch (error) {
      console.error('[ElevenLabs Streaming] ❌ Error:', error);
      throw error;
    }
  }

  /**
   * Get complete audio as Buffer (non-streaming fallback)
   */
  async getAudioBuffer(
    text: string,
    options: ElevenLabsStreamOptions = {}
  ): Promise<Buffer> {
    try {
      const {
        voiceId = this.defaultVoiceId,
        modelId = 'eleven_turbo_v2',
        stability = 0.5, // Same as traditional chat
        similarityBoost = 0.5 // Same as traditional chat
      } = options;

      console.log('[ElevenLabs] 🎯 Getting audio buffer with model:', modelId);

      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            voice_settings: {
              stability: stability,
              similarity_boost: similarityBoost,
              style: 0.0,
              use_speaker_boost: true // Same as traditional chat
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log('[ElevenLabs] ✅ Audio buffer created:', {
        size: buffer.length,
        sizeKB: Math.round(buffer.length / 1024)
      });

      return buffer;

    } catch (error) {
      console.error('[ElevenLabs] ❌ Error:', error);
      throw error;
    }
  }

  /**
   * Get audio as base64 string
   */
  async getAudioBase64(
    text: string,
    options: ElevenLabsStreamOptions = {}
  ): Promise<string> {
    const buffer = await this.getAudioBuffer(text, options);
    return buffer.toString('base64');
  }
}

