/**
 * TTS Service - ElevenLabs Text-to-Speech Integration
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface TTSOptions {
  voice?: string;
  language?: string;
  provider?: 'elevenlabs';
  speed?: number;
}

export interface TTSResponse {
  audioBase64: string;
  audioUrl?: string;
  duration?: number;
  visemes?: any[];
  provider: string;
}

export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResponse> {
  const {
    voice = process.env.DEFAULT_TTS_VOICE || 'kAzI34nYjizE0zON6rXv',
    language = process.env.DEFAULT_LANGUAGE || 'it',
    provider = 'elevenlabs',
    speed = 1.0
  } = options;

  console.log('[TTS] 🎤 Synthesizing speech:', {
    textLength: text.length,
    voice,
    language,
    provider
  });

  try {
    return await synthesizeWithElevenLabs(text, { voice, language, speed });
  } catch (error) {
    console.error('[TTS] ❌ Synthesis failed:', error);
    throw error;
  }
}

async function synthesizeWithElevenLabs(
  text: string,
  options: { voice?: string; language?: string; speed?: number }
): Promise<TTSResponse> {
  const {
    voice = 'kAzI34nYjizE0zON6rXv', // Italian voice ID
    language = 'it',
    speed = 1.0
  } = options;

  console.log('[TTS] 🎤 ElevenLabs synthesis:', { textLength: text.length, voice, language });

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        text: text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert arraybuffer to base64
    console.log('[TTS] 🔍 ElevenLabs response status:', response.status);
    console.log('[TTS] 🔍 ElevenLabs response headers:', response.headers);
    console.log('[TTS] 🔍 ElevenLabs response data type:', typeof response.data);
    console.log('[TTS] 🔍 ElevenLabs response data length:', response.data?.length || 'undefined');
    
    const audioBuffer = Buffer.from(response.data);
    const audioBase64 = audioBuffer.toString('base64');

    console.log('[TTS] ✅ ElevenLabs synthesis completed, base64 length:', audioBase64.length);

    return {
      audioBase64,
      provider: 'elevenlabs',
      duration: undefined, // ElevenLabs doesn't provide duration in response
    };
  } catch (error) {
    console.error('[TTS] ❌ ElevenLabs synthesis failed:', error);
    throw error;
  }
}