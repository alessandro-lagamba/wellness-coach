// ModernVoiceChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, Alert, Switch } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';
import { WellnessSuggestion, getSuggestionsByTags } from '../data/wellnessSuggestions';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import { QwenOmniCorrectService } from '../services/qwen-omni-correct.service';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

interface ModernVoiceChatProps {
  visible: boolean;
  onClose: () => void;
  onVoiceInput: (text: string) => void;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript?: string;
  avatarUri?: string;
  onAddWellnessActivity?: (suggestion: WellnessSuggestion) => void;
}

export const ModernVoiceChat: React.FC<ModernVoiceChatProps> = ({
  visible,
  onClose,
  onVoiceInput,
  isListening,
  isSpeaking,
  isProcessing,
  transcript,
  avatarUri = 'https://img.heroui.chat/image/avatar?w=320&h=320&u=21',
  onAddWellnessActivity,
}) => {
  const router = useRouter();

  // Animazioni orb / ripple
  const orbScale = useSharedValue(0.8);
  const orbOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  // Audio bars
  const audioBars = useRef(Array.from({ length: 24 }, () => useSharedValue(0.1)));
  const audioBarStyles = useRef(
    Array.from({ length: 24 }, (_, index) =>
      useAnimatedStyle(() => ({
        height: interpolate(audioBars.current[index].value, [0, 1], [4, 28]),
      })),
    ),
  );

  const [hasProcessedResult, setHasProcessedResult] = useState(false);
  const [isListeningLocal, setIsListeningLocal] = useState(false);

  // Qwen-Omni Correct state
  const [useQwenOmni, setUseQwenOmni] = useState(false);
  const qwenOmniService = useRef(QwenOmniCorrectService.getInstance());

  // UI state
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [fastChatMessage, setFastChatMessage] = useState('');
  const [audioChunksCount, setAudioChunksCount] = useState(0);

  // Speech recognition events (solo per modalità normale, non Qwen-Omni)
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      const result = event.results[0];
      const t = result.transcript || '';
      const isFinal = event.isFinal || false;

      if (isFinal && t.trim().length > 2 && !hasProcessedResult && !useQwenOmni) {
        setHasProcessedResult(true);
        console.log('[ModernVoiceChat] 🎤 Normal chat processing text:', t);
        ExpoSpeechRecognitionModule.stop();
        onVoiceInput(t);
        setHasProcessedResult(false);
      }
    }
  });

  useSpeechRecognitionEvent('start', () => {
    console.log('[ModernVoiceChat] 🎙️ ✅ Listening STARTED');
    setIsListeningLocal(true);
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[ModernVoiceChat] 🎙️ ❌ Listening ENDED');
    setIsListeningLocal(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech error:', event?.error);
  });

  // Wellness suggestion
  const [showSuggestion, setShowSuggestion] = React.useState(false);
  const [currentSuggestion, setCurrentSuggestion] = React.useState<WellnessSuggestion | null>(null);

  // ✅ REALTIME: Connetti/disconnetti quando Qwen-Omni è attivo
  useEffect(() => {
    let isActive = true;

    const connectRealtime = async () => {
      // ✅ Connetti SOLO se toggle attivo E modal visibile E non già connesso
      if (useQwenOmni && visible && !qwenOmniRealtimeService.current.isConnectedToServer()) {
        console.log('[ModernVoiceChat] 🚀 Connecting to Qwen-Omni Realtime...');

        try {
          const apiKey = process.env.EXPO_PUBLIC_DASHSCOPE_API_KEY;
          if (!apiKey) {
            console.error('[ModernVoiceChat] ❌ DASHSCOPE_API_KEY not found');
            Alert.alert('Error', 'API key not configured');
            return;
          }

          await qwenOmniRealtimeService.current.connect({
            apiKey,
            voice: 'Jennifer',
            language: 'it',
            onSpeechStarted: () => {
              console.log('[ModernVoiceChat] 🎤 Realtime: User started speaking');
              setIsListeningLocal(true);
            },
            onSpeechStopped: () => {
              console.log('[ModernVoiceChat] 🛑 Realtime: User stopped speaking');
              setIsListeningLocal(false);
            },
            onAudioChunk: (audioChunk) => {
              setAudioChunksCount(prev => prev + 1);
              setIsAudioPlaying(true);
              setIsAISpeaking(true);
            },
            onTextChunk: (textChunk) => {
              setFastChatMessage(prev => prev + textChunk);
            },
            onResponseDone: () => {
              console.log('[ModernVoiceChat] ✅ Realtime: Response done');
              setIsAISpeaking(false);
              setIsAudioPlaying(false);
            },
            onError: (error) => {
              console.error('[ModernVoiceChat] ❌ Realtime error:', error);
              Alert.alert('Error', error);
            }
          });

          // ✅ Avvia streaming audio SOLO se ancora attivo
          if (isActive) {
            await qwenOmniRealtimeService.current.startAudioStreaming();
            console.log('[ModernVoiceChat] ✅ Realtime audio streaming started');
          }

        } catch (error) {
          console.error('[ModernVoiceChat] ❌ Failed to connect realtime:', error);
          Alert.alert('Error', 'Failed to connect to realtime service');
        }
      }
      // ✅ Disconnetti SOLO se toggle disattivato (NON quando modal si chiude)
      else if (!useQwenOmni && qwenOmniRealtimeService.current.isConnectedToServer()) {
        console.log('[ModernVoiceChat] 🔌 Disconnecting from Qwen-Omni Realtime (toggle off)...');
        qwenOmniRealtimeService.current.disconnect();
      }
    };

    connectRealtime();

    // ✅ Cleanup: disconnetti SOLO se il componente viene smontato definitivamente
    return () => {
      isActive = false;
      // NON disconnettere qui - lascia la connessione attiva!
      // Si disconnetterà solo quando useQwenOmni diventa false
    };
  }, [useQwenOmni, visible]);

  // Orb entrance
  useEffect(() => {
    if (visible) {
      orbOpacity.value = withTiming(1, { duration: 600 });
      orbScale.value = withSpring(1, { damping: 20, stiffness: 100 });
    } else {
      orbOpacity.value = withTiming(0, { duration: 400 });
      orbScale.value = withTiming(0.8, { duration: 400 });
    }
  }, [visible]);

  // State animations
  useEffect(() => {
    if (isListeningLocal) {
      // 🎤 Utente sta parlando
      pulseScale.value = withRepeat(withSequence(withTiming(1.15, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true);
      rippleScale.value = withRepeat(withTiming(2.5, { duration: 1200 }), -1, false);
      rippleOpacity.value = withRepeat(withSequence(withTiming(0.4, { duration: 600 }), withTiming(0, { duration: 600 })), -1, false);

      audioBars.current.forEach((bar) => (bar.value = withTiming(0.1, { duration: 200 })));

      setTimeout(() => {
        if (isListeningLocal) {
          audioBars.current.forEach((bar) => {
            bar.value = withRepeat(withTiming(0.3 + Math.random() * 0.4, { duration: 400 }), -1, true);
          });
        }
      }, 1000);
    } else if (isAudioPlaying || isSpeaking || isAISpeaking) {
      // 🔊 AI sta parlando
      pulseScale.value = withRepeat(withSequence(withTiming(1.1, { duration: 600 }), withTiming(1, { duration: 600 })), -1, true);

      audioBars.current.forEach((bar, index) => {
        const baseDelay = index * 50;

        setTimeout(() => {
          if (isAudioPlaying || isSpeaking || isAISpeaking) {
            bar.value = withRepeat(
              withSequence(
                withTiming(0.2 + Math.random() * 0.3, { duration: 200 }),
                withTiming(0.4 + Math.random() * 0.4, { duration: 200 })
              ),
              -1,
              true
            );
          }
        }, baseDelay);
      });
    } else if (isProcessing) {
      // ⚙️ Processing
      pulseScale.value = withRepeat(withTiming(1.12, { duration: 500 }), -1, true);
      audioBars.current.forEach((bar) => (bar.value = withTiming(0.2, { duration: 300 })));
    } else {
      // 💤 Idle
      pulseScale.value = withTiming(1, { duration: 400 });
      rippleScale.value = withTiming(0, { duration: 400 });
      rippleOpacity.value = withTiming(0, { duration: 400 });
      audioBars.current.forEach((bar) => (bar.value = withTiming(0.1, { duration: 400 })));
    }
  }, [isListeningLocal, isSpeaking, isProcessing, isAudioPlaying, isAISpeaking]);

  const getOrbColors = (): [string, string, string] => {
    if (isSpeaking || isAISpeaking) return ['#10b981', '#059669', '#047857'];
    if (isListening || isListeningLocal) return ['#3b82f6', '#2563eb', '#1d4ed8'];
    if (isProcessing) return ['#f59e0b', '#d97706', '#b45309'];
    return ['#6366f1', '#4f46e5', '#4338ca'];
  };

  const generateWellnessSuggestion = (txt: string): WellnessSuggestion | null => {
    const lower = txt.toLowerCase();
    const keywordMap: Record<string, string[]> = {
      stress: ['stress', 'calm'],
      anxious: ['stress', 'calm'],
      worried: ['stress', 'calm'],
      tired: ['energy', 'mood'],
      exhausted: ['energy', 'mood'],
      energy: ['energy', 'motivation'],
      sleep: ['sleep', 'rest'],
      insomnia: ['sleep', 'rest'],
      restless: ['sleep', 'rest'],
      focus: ['focus', 'awareness'],
      concentration: ['focus', 'awareness'],
      mindful: ['mindfulness', 'awareness'],
    };
    for (const [keyword, tags] of Object.entries(keywordMap)) {
      if (lower.includes(keyword)) {
        const suggestions = getSuggestionsByTags(tags);
        if (suggestions.length) return suggestions[0];
      }
    }
    return null;
  };

  useEffect(() => {
    if (isSpeaking && transcript) {
      const s = generateWellnessSuggestion(transcript);
      if (s) {
        setTimeout(() => {
          setCurrentSuggestion(s);
          setShowSuggestion(true);
        }, 2000);
      }
    }
  }, [isSpeaking, transcript]);

  const handleAddToToday = (s: WellnessSuggestion) => {
    onAddWellnessActivity?.(s);
    setShowSuggestion(false);
    setCurrentSuggestion(null);
  };

  const handleDismissSuggestion = () => {
    setShowSuggestion(false);
    setCurrentSuggestion(null);
  };

  const handleStartExercise = (s: WellnessSuggestion) => {
    if (s.id === 'breathing-exercises') router.push('/breathing-exercise');
    setShowSuggestion(false);
    setCurrentSuggestion(null);
  };

  const handleStopAudio = () => {
    setIsAudioPlaying(false);
    // Ferma il servizio realtime se attivo
    if (useQwenOmni && qwenOmniRealtimeService.current.isConnectedToServer()) {
      qwenOmniRealtimeService.current.disconnect();
    }
  };

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value * pulseScale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const colors = getOrbColors();

  const getStatusText = () => {
    if (useQwenOmni && isAISpeaking) return '🚀 Qwen-Omni Speaking...';
    if (useQwenOmni && isListeningLocal) return '🎤 Listening...';
    if (useQwenOmni) return '🚀 Qwen-Omni Realtime Active';
    if (isSpeaking) return 'AI is speaking...';
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    return 'Tap to start voice chat';
  };

  const getStatusColor = () => {
    if (useQwenOmni) return '#10b981';
    if (isSpeaking) return '#10b981';
    if (isListening) return '#3b82f6';
    if (isProcessing) return '#f59e0b';
    return '#6366f1';
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="times" size={18} color="#64748b" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Voice Chat</Text>
          <Text style={styles.subtitle}>Speak naturally with Yachai</Text>
        </View>

        <View style={styles.avatarContainer}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </View>
        </View>

        <View style={styles.orbContainer}>
          <Animated.View style={[styles.ripple, rippleStyle]}>
            <View style={[styles.rippleGradient, { backgroundColor: `${getStatusColor()}20` }]} />
          </Animated.View>

          <TouchableOpacity
            style={styles.orbTouchable}
            onPress={async () => {
              if (!useQwenOmni) {
                // Modalità normale: usa speech recognition
                if (!isListeningLocal && !isSpeaking && !isProcessing) {
                  try {
                    const supported = typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function'
                      ? await ExpoSpeechRecognitionModule.isRecognitionAvailable()
                      : true;

                    if (!supported) {
                      Alert.alert(
                        'Non supportato',
                        'Il riconoscimento vocale non è disponibile su questo dispositivo. Prova la chat di testo.',
                      );
                      return;
                    }

                    await ExpoSpeechRecognitionModule.start?.({
                      lang: 'it-IT',
                      interimResults: true,
                      continuous: true,
                      maxAlternatives: 1,
                      requiresOnDeviceRecognition: false,
                    });

                    setTimeout(() => {
                      ExpoSpeechRecognitionModule.stop?.();
                    }, 10000);
                  } catch (error) {
                    console.error('ASR start failed:', error);
                    Alert.alert(
                      'Errore',
                      "Impossibile avviare il riconoscimento vocale. Riavvia l'app o usa la chat di testo.",
                    );
                  }
                } else {
                  ExpoSpeechRecognitionModule.stop?.();
                }
              }
              // ✅ Con Qwen-Omni Realtime, il WebSocket gestisce tutto automaticamente!
            }}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.orb, orbStyle]}>
              <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbGradient}>
                <View style={styles.innerGlow} />
                <FontAwesome
                  name={isListeningLocal ? 'stop' : isSpeaking || isAISpeaking ? 'volume-up' : 'microphone'}
                  size={28}
                  color="#ffffff"
                />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View style={styles.audioVisualizer}>
          {audioBarStyles.current.map((style, index) => (
            <Animated.View key={index} style={[styles.audioBar, style, { backgroundColor: getStatusColor() }]} />
          ))}
        </View>

        <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>

        {transcript ? (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptText}>{String(transcript)}</Text>
          </View>
        ) : null}

        <View style={styles.fastChatToggleContainer}>
          <View style={styles.fastChatToggle}>
            <Text style={styles.fastChatToggleLabel}>🚀 Qwen-Omni Realtime</Text>
            <Switch
              value={useQwenOmni}
              onValueChange={setUseQwenOmni}
              trackColor={{ false: '#767577', true: '#10b981' }}
              thumbColor={useQwenOmni ? '#fff' : '#f4f3f4'}
            />
          </View>

          {useQwenOmni && (
            <Text style={styles.fastChatHint}>
              🎤 VAD automatico attivo. Parla liberamente, l'AI risponderà automaticamente!
            </Text>
          )}
        </View>

        {isAudioPlaying && (
          <TouchableOpacity
            style={styles.stopAudioButton}
            onPress={handleStopAudio}
          >
            <FontAwesome name="stop" size={16} color="#fff" />
            <Text style={styles.stopAudioButtonText}>Stop Audio</Text>
          </TouchableOpacity>
        )}

        {Boolean(fastChatMessage) && (
          <View style={styles.fastChatResponseContainer}>
            <Text style={styles.fastChatResponseTitle}>⚡ Qwen-Omni Response:</Text>
            <Text style={styles.fastChatResponseText}>{fastChatMessage}</Text>

            {audioChunksCount > 0 && (
              <View style={styles.audioChunksContainer}>
                <Text style={styles.audioChunksText}>
                  🎵 Audio chunks: {audioChunksCount}
                  {isAudioPlaying && ' (streaming...)'}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {useQwenOmni
              ? 'Qwen-Omni Realtime: Parla liberamente!'
              : isListeningLocal
                ? 'Speak now...'
                : 'Tap the orb to start speaking'}
          </Text>
        </View>
      </View>

      <WellnessSuggestionPopup
        visible={showSuggestion}
        suggestion={currentSuggestion}
        onAddToToday={handleAddToToday}
        onDismiss={handleDismissSuggestion}
        onStartExercise={handleStartExercise}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  avatarContainer: {
    marginBottom: 40,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
    position: 'relative',
  },
  orbTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  rippleGradient: {
    flex: 1,
    borderRadius: 100,
  },
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  innerGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  audioVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 30,
    height: 40,
  },
  audioBar: {
    width: 4,
    backgroundColor: '#6366f1',
    borderRadius: 2,
    minHeight: 4,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  transcriptContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginBottom: 30,
    maxWidth: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptText: {
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  instructionsContainer: {
    marginTop: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  fastChatToggleContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  fastChatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fastChatToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginRight: 10,
  },
  fastChatHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  stopAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopAudioButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  fastChatResponseContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f0f9eb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1f3d8',
    maxWidth: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fastChatResponseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 5,
  },
  fastChatResponseText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
  },
  audioChunksContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  audioChunksText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
  },
});

export default ModernVoiceChat;
