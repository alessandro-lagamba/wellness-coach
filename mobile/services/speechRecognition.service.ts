// Dynamic import to avoid web platform issues

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService;
  private isListening = false;
  private recognitionTimeout: ReturnType<typeof setTimeout> | null = null;

  public static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  /**
   * Start listening for speech input
   */
  async startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    onError?: (error: Error) => void,
    options: SpeechRecognitionOptions = {}
  ): Promise<void> {
    try {
      if (this.isListening) {
        await this.stopListening();
      }

      const defaultOptions = {
        language: 'en-US',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        ...options,
      };

      this.isListening = true;

      // For now, we'll simulate speech recognition since expo-speech-recognition
      // might not be available in all environments. In a real implementation,
      // you would use the actual speech recognition API.
      
      // Simulate listening with a timeout
      this.recognitionTimeout = setTimeout(() => {
        if (this.isListening) {
          // Simulate a realistic user query
          const simulatedQueries = [
            "I'm feeling tired and stressed today",
            "How can I improve my skin health?",
            "I need help with my sleep routine",
            "What should I do for better hydration?",
            "I'm having trouble with my emotions lately"
          ];
          
          const randomQuery = simulatedQueries[Math.floor(Math.random() * simulatedQueries.length)];
          
          onResult({
            transcript: randomQuery,
            confidence: 0.95,
            isFinal: true,
          });
          
          this.isListening = false;
        }
      }, 3000); // 3 seconds of "listening"

    } catch (error) {
      console.error('Speech recognition error:', error);
      this.isListening = false;
      if (onError) {
        onError(error as Error);
      }
    }
  }

  /**
   * Stop listening for speech input
   */
  async stopListening(): Promise<void> {
    try {
      this.isListening = false;
      
      if (this.recognitionTimeout) {
        clearTimeout(this.recognitionTimeout);
        this.recognitionTimeout = null;
      }
    } catch (error) {
      console.error('Stop listening error:', error);
    }
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages(): Promise<string[]> {
    try {
      // Return common languages supported by most speech recognition services
      return [
        'en-US',
        'en-GB',
        'en-AU',
        'es-ES',
        'es-MX',
        'fr-FR',
        'de-DE',
        'it-IT',
        'pt-BR',
        'ja-JP',
        'ko-KR',
        'zh-CN',
        'zh-TW',
      ];
    } catch (error) {
      console.error('Error getting languages:', error);
      return ['en-US'];
    }
  }

  /**
   * Check if speech recognition is supported
   */
  async isSupported(): Promise<boolean> {
    try {
      // For now, return true since we're using simulation
      // In a real implementation, check if the device supports speech recognition
      return true;
    } catch (error) {
      console.error('Error checking support:', error);
      return false;
    }
  }
}

export default SpeechRecognitionService.getInstance();
