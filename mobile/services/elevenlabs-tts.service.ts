/**
 * ElevenLabs TTS Service
 * High-quality Italian voice synthesis
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Audio } from 'expo-audio';

export interface ElevenLabsOptions {
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  language?: string;
  rate?: number;
  pitch?: number;
}

export class ElevenLabsTTSService {
  private client: ElevenLabsClient;
  private sound: Audio.Sound | null = null;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || 'sk_6d25ffdcc30a78ec19416d94156986986e7fe41c88ca3fe5',
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎤 ElevenLabs TTS initialized');
    } catch (error) {
      console.error('Failed to initialize ElevenLabs TTS:', error);
      throw error;
    }
  }

  async speak(text: string, options: ElevenLabsOptions = {}): Promise<void> {
    try {
      console.log('🎤 ElevenLabs speaking:', text.substring(0, 50) + '...');

      // Stop any currently playing audio
      await this.stop();

      // Default options for Italian voice
      const voiceId = options.voiceId || 'kAzI34nYjizE0zON6rXv'; // Italian voice
      const modelId = options.modelId || 'eleven_multilingual_v2';
      const outputFormat = options.outputFormat || 'mp3_44100_128';

      // Generate audio with ElevenLabs
      const audioBuffer = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        modelId: modelId,
        outputFormat: outputFormat,
      });

      // Convert buffer to base64 for expo-audio
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const audioUri = `data:audio/mp3;base64,${base64Audio}`;

      // Load and play audio with expo-audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay: true,
          isLooping: false,
          volume: 1.0,
        }
      );

      this.sound = sound;

      // Wait for playback to complete
      return new Promise((resolve, reject) => {
        if (!sound) {
          reject(new Error('Sound not created'));
          return;
        }

        const onPlaybackStatusUpdate = (status: any) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            this.sound = null;
            resolve();
          }
        };

        sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      });

    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error('Error stopping ElevenLabs TTS:', error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test if API key is valid by making a simple request
      await this.client.voices.getAll();
      return true;
    } catch (error) {
      console.error('ElevenLabs not available:', error);
      return false;
    }
  }
}

export default ElevenLabsTTSService;
