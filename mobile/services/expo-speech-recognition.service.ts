import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-audio';

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

export class ExpoSpeechRecognitionService {
  private static instance: ExpoSpeechRecognitionService;
  private isListening = false;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTranscript = '';
  private onResultCallback: ((result: SpeechRecognitionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private silenceTimeoutMs = 3000;
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  public static getInstance(): ExpoSpeechRecognitionService {
    if (!ExpoSpeechRecognitionService.instance) {
      ExpoSpeechRecognitionService.instance = new ExpoSpeechRecognitionService();
    }
    return ExpoSpeechRecognitionService.instance;
  }

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize audio permissions and setup
   */
  private async initializeAudio(): Promise<void> {
    try {
      console.log('🔧 Initializing Expo Speech Recognition service...');
      
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

      console.log('✅ Expo Speech Recognition service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Expo Speech Recognition service:', error);
    }
  }

  /**
   * Check if speech recognition is supported
   */
  async isSupported(): Promise<boolean> {
    try {
      // Expo Speech is supported on iOS and Android
      if (Platform.OS === 'web') {
        return false; // Not supported on web
      }

      // Check if we have audio permissions
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Audio permission not granted');
        return false;
      }

      console.log('✅ Expo Speech Recognition is supported');
      return true;
    } catch (error) {
      console.error('Error checking Expo Speech support:', error);
      return false;
    }
  }

  /**
   * Start listening for speech input using Expo Audio Recording
   */
  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    onError?: (error: Error) => void,
    options: SpeechRecognitionOptions = {}
  ): Promise<void> {
    try {
      console.log('🎤 Starting Expo Speech Recognition...');

      const isSupported = await this.isSupported();
      if (!isSupported) {
        throw new Error('Expo Speech Recognition not supported on this device');
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

      console.log('✅ Expo Speech Recognition started successfully');

    } catch (error) {
      console.error('Expo Speech Recognition start error:', error);
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
      
      // Prepare recording
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      // Start recording
      await this.recording.startAsync();
      this.isRecording = true;
      this.isListening = true;

      console.log('✅ Audio recording started');

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
      console.log('🛑 Stopping Expo Speech Recognition...');

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

      console.log('✅ Expo Speech Recognition stopped');

    } catch (error) {
      console.error('Error stopping Expo Speech Recognition:', error);
    }
  }

  /**
   * Stop audio recording and process the audio
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
        // For now, we'll simulate speech recognition
        // In a real implementation, you would send the audio to a speech recognition service
        const simulatedTranscript = await this.simulateSpeechRecognition(uri);
        
        if (simulatedTranscript) {
          this.onResultCallback({
            transcript: simulatedTranscript,
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
   * Simulate speech recognition (placeholder for real implementation)
   */
  private async simulateSpeechRecognition(audioUri: string): Promise<string | null> {
    try {
      // This is a placeholder - in a real implementation, you would:
      // 1. Send the audio file to a speech recognition service (Google Speech-to-Text, Azure, etc.)
      // 2. Process the response and return the transcript
      
      console.log('🎯 Simulating speech recognition for:', audioUri);
      
      // For demo purposes, return a placeholder
      return "Ciao, questo è un test del riconoscimento vocale con Expo Audio";
      
    } catch (error) {
      console.error('Speech recognition simulation failed:', error);
      return null;
    }
  }

  /**
   * Cancel current speech recognition
   */
  async cancel(): Promise<void> {
    try {
      console.log('❌ Cancelling Expo Speech Recognition...');
      await this.stopListening();
    } catch (error) {
      console.error('Error cancelling Expo Speech Recognition:', error);
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
      // Expo Speech supports multiple languages
      return [
        'it-IT', // Italian
        'en-US', // English (US)
        'en-GB', // English (UK)
        'es-ES', // Spanish
        'fr-FR', // French
        'de-DE', // German
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
    console.log('✅ Expo Speech Recognition service destroyed');
  }
}

export default ExpoSpeechRecognitionService;
