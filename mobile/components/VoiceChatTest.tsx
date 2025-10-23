import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BACKEND_URL } from '../constants/env';
import SpeechRecognitionService from '../services/speechRecognition.service';
import TTSService from '../services/tts.service';

export const VoiceChatTest: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tts = TTSService.getInstance();

  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await SpeechRecognitionService.isSupported();
        setIsSupported(supported);
        if (!supported) {
          setError('Speech recognition is not supported on this device');
        }
      } catch (err) {
        setError('Failed to check speech recognition support');
        console.error('Support check error:', err);
      }
    };

    checkSupport();
  }, []);

  const handleStartListening = async () => {
    if (!isSupported) {
      Alert.alert('Not Supported', 'Speech recognition is not available on this device');
      return;
    }

    try {
      setIsListening(true);
      setTranscript('');
      setAiResponse('');
      setError(null);

      await SpeechRecognitionService.startListening(
        (result) => {
          console.log('Test speech result:', result);
          setTranscript(result.transcript);
          
          if (result.isFinal) {
            setIsListening(false);
            setIsProcessing(true);
            processVoiceInput(result.transcript);
          }
        },
        (err) => {
          console.error('Speech recognition error:', err);
          setError(err.message);
          setIsListening(false);
          setIsProcessing(false);
        },
        {
          language: 'en-US',
          silenceTimeout: 3000, // 3 seconds
        }
      );
    } catch (err) {
      console.error('Failed to start listening:', err);
      setError('Failed to start speech recognition');
      setIsListening(false);
    }
  };

  const handleStopListening = async () => {
    try {
      await SpeechRecognitionService.stopListening();
      setIsListening(false);
    } catch (err) {
      console.error('Failed to stop listening:', err);
    }
  };

  const processVoiceInput = async (userInput: string) => {
    try {
      console.log('Processing voice input:', userInput);
      
      // Send to OpenAI via backend
      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          sessionId: 'voice-chat-test',
        }),
      });

      const data = response.ok ? await response.json() : null;
      const responseText = data?.response?.trim()?.length
        ? data.response
        : "I'm processing that—give me just a second and I'll suggest something helpful.";

      setAiResponse(responseText);
      setIsProcessing(false);
      setIsSpeaking(true);
      
      // Speak the response
      await tts.speak(responseText, { 
        rate: 0.5, 
        pitch: 1.0, 
        language: 'en-US' 
      });
      
      setIsSpeaking(false);
      
    } catch (err) {
      console.error('Voice processing error:', err);
      setError('Failed to process voice input');
      setIsProcessing(false);
    }
  };

  const getStatusText = () => {
    if (isSpeaking) return 'AI is speaking...';
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    return 'Tap to start voice chat';
  };

  const getStatusColor = () => {
    if (isSpeaking) return '#10b981';
    if (isListening) return '#3b82f6';
    if (isProcessing) return '#f59e0b';
    return '#6366f1';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Chat Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {transcript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}

      {aiResponse && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>AI Response:</Text>
          <Text style={styles.responseText}>{aiResponse}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: getStatusColor() },
          (!isSupported || isSpeaking) && styles.buttonDisabled
        ]}
        onPress={isListening ? handleStopListening : handleStartListening}
        disabled={!isSupported || isSpeaking}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Listening' : 'Start Voice Chat'}
        </Text>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Speech Recognition: {isSupported ? '✅ Supported' : '❌ Not Supported'}
        </Text>
        <Text style={styles.infoText}>
          Backend URL: {BACKEND_URL}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#0f172a',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  transcriptContainer: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 16,
    color: '#0f172a',
    lineHeight: 24,
  },
  responseContainer: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 16,
    color: '#0c4a6e',
    lineHeight: 24,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
});

export default VoiceChatTest;


