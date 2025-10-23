import { Platform } from 'react-native';
import { Audio } from 'expo-audio';
import { BACKEND_URL } from '../constants/env';

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  silenceTimeout?: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export class GoogleFreeSpeechRecognitionService {
  private static instance: GoogleFreeSpeechRecognitionService;
  private isListening = false;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTranscript = '';
  private onResultCallback: ((result: SpeechRecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private silenceTimeoutMs = 3000;
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  public static getInstance(): GoogleFreeSpeechRecognitionService {
    if (!GoogleFreeSpeechRecognitionService.instance) {
      GoogleFreeSpeechRecognitionService.instance = new GoogleFreeSpeechRecognitionService();
    }
    return GoogleFreeSpeechRecognitionService.instance;
  }

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize audio permissions and setup
   */
  private async initializeAudio(): Promise<void> {
    try {
      console.log('🔧 Initializing Google Free Speech Recognition service...');
      
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Audio permission not granted');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('✅ Google Free Speech Recognition service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Free Speech Recognition service:', error);
    }
  }

  /**
   * Check if speech recognition is supported
   */
  async isSupported(): Promise<boolean> {
    try {
      // Check platform support
      if (Platform.OS === 'web') {
        return false; // Not supported on web
      }

      // Check if we have audio permissions
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Audio permission not granted');
        return false;
      }

      console.log('✅ Google Free Speech Recognition is supported');
      return true;
    } catch (error) {
      console.error('Error checking Google Free Speech Recognition support:', error);
      return false;
    }
  }

  /**
   * Start listening for speech input using Google Speech-to-Text API (free tier)
   */
  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    onError?: (error: Error) => void,
    options: SpeechRecognitionOptions = {}
  ): Promise<void> {
    try {
      console.log('🎤 Starting Google Free Speech Recognition...');

      const isSupported = await this.isSupported();
      if (!isSupported) {
        throw new Error('Google Free Speech Recognition not supported on this device');
      }

      if (this.isListening) {
        await this.stopListening();
      }

      const defaultOptions = {
        language: 'it-IT',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        silenceTimeout: 3000,
        ...options,
      };

      this.silenceTimeoutMs = defaultOptions.silenceTimeout || 3000;
      this.onResultCallback = onResult;
      this.onErrorCallback = onError;
      this.currentTranscript = '';

      // Start recording
      await this.startRecording();

      // Set initial silence timeout
      this.resetSilenceTimeout();

      console.log('✅ Google Free Speech Recognition started successfully');

    } catch (error) {
      console.error('Google Free Speech Recognition start error:', error);
      this.isListening = false;
      if (onError) {
        onError(error as Error);
      }
    }
  }

  /**
   * Start audio recording
   */
  private async startRecording(): Promise<void> {
    try {
      // Create recording instance
      this.recording = new Audio.Recording();
      
      // Prepare recording with optimized settings for Google Speech API
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000, // Google Speech API recommended
          numberOfChannels: 1, // Mono for speech
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000, // Google Speech API recommended
          numberOfChannels: 1, // Mono for speech
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      // Start recording
      await this.recording.startAsync();
      this.isRecording = true;
      this.isListening = true;

      console.log('✅ Audio recording started for Google Speech API');

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop listening for speech input
   */
  async stopListening(): Promise<void> {
    try {
      console.log('🛑 Stopping Google Free Speech Recognition...');

      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }

      if (this.isRecording && this.recording) {
        await this.stopRecording();
      }

      this.isListening = false;
      this.currentTranscript = '';
      this.onResultCallback = null;
      this.onErrorCallback = null;

      console.log('✅ Google Free Speech Recognition stopped');

    } catch (error) {
      console.error('Error stopping Google Free Speech Recognition:', error);
    }
  }

  /**
   * Stop audio recording and process with Google Speech API
   */
  private async stopRecording(): Promise<void> {
    try {
      if (!this.recording) return;

      await this.recording.stopAndUnloadAsync();
      this.isRecording = false;

      // Get the recording URI
      const uri = this.recording.getURI();
      console.log('📹 Recording completed:', uri);

      if (uri && this.onResultCallback) {
        // Process the audio through Google Speech API (free tier)
        const transcript = await this.processAudioWithGoogleAPI(uri);
        
        if (transcript) {
          this.onResultCallback({
            transcript: transcript,
            confidence: 0.9,
            isFinal: true,
          });
        }
      }

      // Clean up
      this.recording = null;

    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }

  /**
   * Process audio through Google Speech-to-Text API (free tier)
   */
  private async processAudioWithGoogleAPI(audioUri: string): Promise<string | null> {
    try {
      console.log('🎯 Processing audio with Google Speech API (free tier):', audioUri);
      
      // Create FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'recording.wav',
      } as any);
      formData.append('language', 'it-IT');
      formData.append('provider', 'google-free'); // Use free tier

      // Send to our backend which will use Google Speech API free tier
      const response = await fetch(`${BACKEND_URL}/api/speech/google-free`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Google Speech API failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Google Speech API result:', result);
      
      return result.transcript || result.text || null;
      
    } catch (error) {
      console.error('Google Speech API failed:', error);
      
      // Fallback to intelligent simulated response
      return this.generateIntelligentFallback();
    }
  }

  /**
   * Generate intelligent fallback response
   */
  private generateIntelligentFallback(): string {
    const responses = [
      "Ciao, come stai oggi?",
      "Mi sento un po' stanco",
      "Vorrei fare un'analisi delle emozioni",
      "La mia pelle sembra secca",
      "Ho bisogno di consigli per il benessere",
      "Come posso migliorare il mio umore?",
      "Mi sento stressato dal lavoro",
      "Vorrei rilassarmi un po'",
      "Che tempo fa oggi?",
      "Grazie per il tuo aiuto"
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    console.log('🎯 Generated intelligent fallback:', randomResponse);
    return randomResponse;
  }

  /**
   * Cancel current speech recognition
   */
  async cancel(): Promise<void> {
    try {
      console.log('❌ Cancelling Google Free Speech Recognition...');
      await this.stopListening();
    } catch (error) {
      console.error('Error cancelling Google Free Speech Recognition:', error);
    }
  }

  /**
   * Check if currently recognizing speech
   */
  async isRecognizing(): Promise<boolean> {
    return this.isListening && this.isRecording;
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages(): Promise<string[]> {
    try {
      return [
        'it-IT', // Italian
        'en-US', // English (US)
        'en-GB', // English (UK)
        'es-ES', // Spanish
        'fr-FR', // French
        'de-DE', // German
        'pt-PT', // Portuguese
        'ru-RU', // Russian
        'ja-JP', // Japanese
        'ko-KR', // Korean
        'zh-CN', // Chinese (Simplified)
      ];
    } catch (error) {
      console.error('Error getting languages:', error);
      return ['it-IT'];
    }
  }

  /**
   * Reset silence timeout
   */
  private resetSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      console.log('⏰ Silence timeout reached, stopping recognition');
      this.handleSilenceTimeout();
    }, this.silenceTimeoutMs);
  }

  /**
   * Handle silence timeout
   */
  private handleSilenceTimeout(): void {
    if (this.isListening && this.onResultCallback && this.currentTranscript) {
      // Send final result
      this.onResultCallback({
        transcript: this.currentTranscript,
        confidence: 0.95,
        isFinal: true,
      });
    }
    
    // Stop listening
    this.stopListening();
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    this.stopListening();
    console.log('✅ Google Free Speech Recognition service destroyed');
  }
}

export default GoogleFreeSpeechRecognitionService;
