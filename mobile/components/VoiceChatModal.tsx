import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import TTSService from '../services/tts.service';
import { BACKEND_URL } from '../constants/env';

const { width, height } = Dimensions.get('window');

interface VoiceChatModalProps {
  visible: boolean;
  onClose: () => void;
  onUserInput?: (input: string, context: string, assistantResponse: string) => void;
}

export const VoiceChatModal: React.FC<VoiceChatModalProps> = ({ 
  visible, 
  onClose, 
  onUserInput 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const tts = useMemo(() => TTSService.getInstance(), []);
  
  // Animation values
  const modalScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const avatarScale = useSharedValue(1);
  const micScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  const supportPrompts = [
    { icon: 'sun-o', text: 'Morning motivation', color: '#f59e0b' },
    { icon: 'medkit', text: 'Stress reset', color: '#ef4444' },
    { icon: 'tint', text: 'Hydration reminder', color: '#3b82f6' },
    { icon: 'moon-o', text: 'Sleep tips', color: '#8b5cf6' },
  ];

  // Initialize TTS when component mounts
  useEffect(() => {
    const initializeTTS = async () => {
      try {
        await tts.initialize();
        console.log('TTS initialized for VoiceChatModal');
      } catch (error) {
        console.error('Failed to initialize TTS:', error);
      }
    };

    if (visible) {
      initializeTTS();
    }
  }, [visible]);

  // Modal animation
  useEffect(() => {
    if (visible) {
      modalScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      modalOpacity.value = withTiming(1, { duration: 300 });
    } else {
      modalScale.value = withTiming(0, { duration: 200 });
      modalOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  // Real speech recognition
  useEffect(() => {
    if (isListening) {
      const startRealSpeechRecognition = async () => {
        try {
          const SpeechRecognitionService = (await import('../services/speechRecognition.service')).default;
          
          await SpeechRecognitionService.startListening(
            (result) => {
              console.log('VoiceChatModal speech result:', result);
              setTranscript(result.transcript);
              
              if (result.isFinal) {
                setIsListening(false);
                setIsResponding(true);
                processUserInput(result.transcript);
              }
            },
            (error) => {
              console.error('VoiceChatModal speech error:', error);
              setIsListening(false);
              setIsResponding(false);
            },
            {
              language: 'it-IT',
              silenceTimeout: 3000, // 3 seconds of silence before processing
            }
          );
        } catch (error) {
          console.error('Failed to start speech recognition in VoiceChatModal:', error);
          setIsListening(false);
        }
      };
      
      startRealSpeechRecognition();
    }
  }, [isListening]);

  const processUserInput = async (userQuery: string) => {
    try {
      // 🔥 FIX: Ottieni la lingua dell'utente
      const { getUserLanguage } = await import('../services/language.service');
      const userLanguage = await getUserLanguage();
      
      // Send to OpenAI via backend for real AI response
      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userQuery,
          sessionId: 'mobile-voice-chat-modal',
          userContext: {
            language: userLanguage // 🔥 FIX: Includi la lingua per il backend
          },
        }),
      });

      const data = response.ok ? await response.json() : null;
      const aiResponse = data?.response?.trim()?.length
        ? data.response
        : "I'm processing that—give me just a second and I'll suggest something helpful.";

      setResponse(aiResponse);
      setIsResponding(false);

      // Speak the response using TTS
      try {
        setIsSpeaking(true);
        await tts.speak(aiResponse, {
          rate: 0.5, // Slower for better comprehension
          pitch: 1.0,
          language: 'en-US',
        });
      } catch (error) {
        console.error('TTS error:', error);
      } finally {
        setIsSpeaking(false);
      }

      // Trigger wellness suggestions after response
      if (onUserInput) {
        setTimeout(() => {
          const context = userQuery.toLowerCase().includes('tired') || userQuery.toLowerCase().includes('stressed')
            ? 'stress'
            : userQuery.toLowerCase().includes('skin')
            ? 'skin'
            : userQuery.toLowerCase().includes('sleep')
            ? 'sleep'
            : 'general';
          onUserInput(userQuery, context, aiResponse);
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing user input:', error);
      setIsResponding(false);
      
      // Fallback response
      const fallbackResponse = "I'm having trouble processing your request right now. Please try again.";
      setResponse(fallbackResponse);
      
      // Speak fallback response
      try {
        setIsSpeaking(true);
        await tts.speak(fallbackResponse, {
          rate: 0.5,
          pitch: 1.0,
          language: 'en-US',
        });
      } catch (ttsError) {
        console.error('TTS error:', ttsError);
      } finally {
        setIsSpeaking(false);
      }
    }
  };

  const handleMicToggle = async () => {
    if (!isListening && !isResponding && !isSpeaking) {
      setTranscript('');
      setResponse('');
      setIsListening(true);
      
      // Start pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else if (isSpeaking) {
      // Stop TTS if currently speaking
      await tts.stop();
      setIsSpeaking(false);
      pulseScale.value = withTiming(1, { duration: 200 });
    } else if (isListening) {
      // Stop listening
      setIsListening(false);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  };

  const handleClose = () => {
    modalScale.value = withTiming(0, { duration: 200 });
    modalOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  // Animation styles
  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalOpacity.value,
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withRepeat(withTiming(0.9, { duration: 700 }), -1, true) },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <BlurView intensity={20} style={styles.backdrop}>
        <Animated.View style={[styles.modalContainer, modalStyle]}>
          <LinearGradient
            colors={['#f8fafc', '#f1f5f9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <FontAwesome name="times" size={18} color="#6b7280" />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.title}>Voice Coach</Text>
                <Text style={styles.subtitle}>Share how you're feeling</Text>
              </View>
            </View>

            {/* Quick Prompts */}
            <View style={styles.promptsContainer}>
              {supportPrompts.map((prompt, index) => (
                <TouchableOpacity
                  key={prompt.text}
                  style={[styles.promptPill, { backgroundColor: `${prompt.color}15` }]}
                  onPress={() => {
                    setTranscript(prompt.text);
                    processUserInput(prompt.text);
                  }}
                >
                  <FontAwesome name={prompt.icon as any} size={14} color={prompt.color} />
                  <Text style={[styles.promptText, { color: prompt.color }]}>{prompt.text}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarWrapper, avatarStyle]}>
                <LinearGradient
                  colors={['#a855f7', '#8b5cf6']}
                  style={styles.avatarBackground}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <FontAwesome name="android" size={50} color="white" />
                </LinearGradient>
              </Animated.View>

              {/* Listening indicator */}
              {isListening && (
                <Animated.View style={[styles.listeningRing, pulseStyle]}>
                  <View style={styles.listeningRingInner} />
                </Animated.View>
              )}
            </View>

            {/* Chat Area */}
            <View style={styles.chatArea}>
              {transcript && (
                <View style={styles.userMessage}>
                  <Text style={styles.userMessageText}>{transcript}</Text>
                </View>
              )}

              {isResponding && (
                <View style={styles.loadingContainer}>
                  <Animated.View style={[styles.loadingDot, loadingStyle]} />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              )}

              {response && (
                <View style={styles.aiMessage}>
                  <Text style={styles.aiMessageText}>{response}</Text>
                </View>
              )}
            </View>

            {/* Mic Button */}
            <View style={styles.micContainer}>
              <Animated.View style={[styles.micButtonWrapper, micStyle]}>
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    isListening && styles.micButtonListening,
                    isResponding && styles.micButtonProcessing,
                    isSpeaking && styles.micButtonSpeaking,
                  ]}
                  onPress={handleMicToggle}
                  disabled={isResponding}
                >
                  <FontAwesome
                    name={
                      isListening
                        ? 'stop'
                        : isResponding
                        ? 'spinner'
                        : isSpeaking
                        ? 'volume-up'
                        : 'microphone'
                    }
                    size={24}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </Animated.View>
              
              <Text style={styles.micLabel}>
                {isListening ? 'Listening...' : isResponding ? 'Processing...' : isSpeaking ? 'Speaking...' : 'Tap to talk'}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginRight: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  promptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  promptText: {
    fontSize: 12,
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  listeningRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  listeningRingInner: {
    flex: 1,
    borderRadius: 68,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  chatArea: {
    flex: 1,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMessage: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopRightRadius: 6,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessageText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  aiMessage: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    maxWidth: '80%',
  },
  aiMessageText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
  micContainer: {
    alignItems: 'center',
  },
  micButtonWrapper: {
    marginBottom: 12,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonListening: {
    backgroundColor: '#ef4444',
  },
  micButtonProcessing: {
    backgroundColor: '#8b5cf6',
  },
  micButtonSpeaking: {
    backgroundColor: '#10b981',
  },
  micLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default VoiceChatModal;
