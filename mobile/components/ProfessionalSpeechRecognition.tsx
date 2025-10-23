import React, { useEffect, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface ProfessionalSpeechRecognitionProps {
  onResult: (transcript: string, confidence: number, isFinal: boolean) => void;
  onError: (error: Error) => void;
  onStart?: () => void;
  onEnd?: () => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export const ProfessionalSpeechRecognition: React.FC<ProfessionalSpeechRecognitionProps> = ({
  onResult,
  onError,
  onStart,
  onEnd,
  language = 'it-IT',
  continuous = false,
  interimResults = true,
}) => {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        setIsAvailable(available);
        console.log('🎤 Professional speech recognition available:', available);
      } catch (error) {
        console.error('Error checking speech recognition availability:', error);
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  // Handle speech recognition events
  useSpeechRecognitionEvent('start', () => {
    console.log('🎤 Professional speech recognition started');
    onStart?.();
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('🎤 Professional speech recognition ended');
    onEnd?.();
  });

  useSpeechRecognitionEvent('result', (event) => {
    console.log('🎤 Professional speech recognition result:', event);
    
    if (event.results && event.results.length > 0) {
      const result = event.results[0];
      const transcript = result.transcript || '';
      const confidence = result.confidence || 0.8;
      const isFinal = event.isFinal || false;
      
      onResult(transcript, confidence, isFinal);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('🎤 Professional speech recognition error:', event);
    onError(new Error(event.error || 'Speech recognition error'));
  });

  useSpeechRecognitionEvent('audiostart', () => {
    console.log('🎤 Professional speech recognition audio started');
  });

  useSpeechRecognitionEvent('audioend', () => {
    console.log('🎤 Professional speech recognition audio ended');
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    console.log('🎤 Professional speech recognition volume change:', event.value);
  });

  // Expose control methods
  const startListening = async () => {
    if (!isAvailable) {
      onError(new Error('Speech recognition not available'));
      return;
    }

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults,
        continuous,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      console.error('Failed to start professional speech recognition:', error);
      onError(error as Error);
    }
  };

  const stopListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Failed to stop professional speech recognition:', error);
      onError(error as Error);
    }
  };

  const cancelListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.cancel();
    } catch (error) {
      console.error('Failed to cancel professional speech recognition:', error);
      onError(error as Error);
    }
  };

  // Return control methods and availability status
  return {
    isAvailable,
    startListening,
    stopListening,
    cancelListening,
  };
};

export default ProfessionalSpeechRecognition;
