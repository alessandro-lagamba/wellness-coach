// ModernVoiceChat.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useTheme } from '../contexts/ThemeContext';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';
import { WellnessSuggestion, getSuggestionsByTags } from '../data/wellnessSuggestions';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import { useLiveKitConnection } from '../hooks/useLiveKitConnection';
import { LiveKitRoom, AudioSession, registerGlobals, useRoomContext, useLocalParticipant, useIOSAudioManagement } from '@livekit/react-native';
import { useVoiceAssistant } from '@livekit/components-react';
import AudioOrbVisual from './AudioOrbVisual';
import { AuthService } from '../services/auth.service'; // 🆕 Import AuthService to load profile
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

// Call registerGlobals() as per official LiveKit documentation
registerGlobals();

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
  // 🆕 Context for unified prompt
  userContext?: any;
  aiContext?: any;
  currentUser?: any;
  currentUserProfile?: any; // 🆕 For first_name from profile
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
  userContext,
  aiContext,
  currentUser,
  currentUserProfile,
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const router = useRouter();

  // LiveKit connection
  const {
    connectionState,
    audioLevels,
    isMicrophoneEnabled,
    startVoiceChat,
    stopVoiceChat,
  } = useLiveKitConnection();

  // LiveKit voice chat state
  const [useLiveKitVoice, setUseLiveKitVoice] = useState(false);
  const [isLiveKitActive, setIsLiveKitActive] = useState(false);
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);
  const [liveKitUrl, setLiveKitUrl] = useState<string | null>(null);

  // Start audio session when LiveKit is active
  useEffect(() => {
    if (isLiveKitActive) {
      const startAudioSession = async () => {
        try {
          await AudioSession.startAudioSession();
          console.log('[ModernVoiceChat] ✅ AudioSession started');
        } catch (error) {
          console.error('[ModernVoiceChat] ❌ AudioSession start failed:', error);
        }
      };
      
      startAudioSession();
      
      return () => {
        AudioSession.stopAudioSession();
        console.log('[ModernVoiceChat] 🛑 AudioSession stopped');
      };
    }
  }, [isLiveKitActive]);

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
  
  // UI state
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [fastChatMessage, setFastChatMessage] = useState('');
  const [audioChunksCount, setAudioChunksCount] = useState(0);
  const [localAudioLevels, setLocalAudioLevels] = useState({
    input: 0,
    output: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  });

  // Wellness suggestion
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<WellnessSuggestion | null>(null);

  // Reset function for realtime UI
  const resetRealtimeUi = useCallback(() => {
    setIsListeningLocal(false);
    setIsAISpeaking(false);
    setIsAudioPlaying(false);
    setFastChatMessage('');
    setAudioChunksCount(0);
    setLocalAudioLevels({
      input: 0,
      output: 0,
      bass: 0,
      mid: 0,
      treble: 0,
    });
  }, []);

  // Speech recognition events
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      const result = event.results[0];
      const t = result.transcript || '';
      const isFinal = event.isFinal || false;

      if (isFinal && t.trim().length > 2 && !hasProcessedResult) {
        setHasProcessedResult(true);
        console.log('[ModernVoiceChat] 🎤 Processing text:', t);
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

  // Start the audio session first - following the exact pattern from working implementation
  useEffect(() => {
    let start = async () => {
      await AudioSession.startAudioSession();
    };

    start();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

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
    } else if (isSpeaking) {
      // 🔊 AI sta parlando
      pulseScale.value = withRepeat(withSequence(withTiming(1.1, { duration: 600 }), withTiming(1, { duration: 600 })), -1, true);
      
      audioBars.current.forEach((bar, index) => {
        const baseDelay = index * 50;
        
        setTimeout(() => {
          if (isSpeaking) {
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
  }, [isListeningLocal, isSpeaking, isProcessing]);

  const getOrbColors = (): [string, string, string] => {
    if (isSpeaking) return ['#10b981', '#059669', '#047857'];
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

  // LiveKit voice chat handlers - following the exact pattern from working implementation
  const handleLiveKitToggle = useCallback(async (enabled: boolean) => {
    setUseLiveKitVoice(enabled);
    
    if (enabled) {
      console.log('[ModernVoiceChat] 🚀 Starting LiveKit voice chat');
      
      try {
        // Get token from backend - following the exact pattern from working implementation
        const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wellness-coach-production.up.railway.app';
        
        // 🆕 Load user profile directly from database if not passed as prop (ensure fresh data)
        let userProfile = currentUserProfile;
        if (currentUser?.id && !userProfile?.first_name) {
          console.log('[ModernVoiceChat] 🔄 Loading user profile from database...');
          userProfile = await AuthService.getUserProfile(currentUser.id);
          console.log('[ModernVoiceChat] ✅ Profile loaded:', userProfile ? { 
            first_name: userProfile.first_name, 
            last_name: userProfile.last_name 
          } : 'null');
        }
        
        // 🆕 Extract user name with priority: userProfile.first_name > currentUserProfile.first_name > user_metadata.full_name > email
        const firstName = userProfile?.first_name || currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || undefined;
        const lastName = userProfile?.last_name || currentUserProfile?.last_name || currentUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined;
        const userName = firstName || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente';
        
        // 🆕 Build user context for unified prompt (ALWAYS pass context if we have user info, even if userContext is null)
        const voiceUserContext = {
          // Historical context from userContext if available
          emotionHistory: userContext?.emotionHistory || [],
          skinHistory: userContext?.skinHistory || [],
          emotionTrend: userContext?.emotionTrend || null,
          skinTrend: userContext?.skinTrend || null,
          insights: userContext?.insights || [],
          temporalPatterns: userContext?.temporalPatterns || null,
          behavioralInsights: userContext?.behavioralInsights || null,
          contextualFactors: userContext?.contextualFactors || null,
          // 🆕 User name (always include if available)
          firstName: firstName,
          lastName: lastName,
          userName: userName,
        };
        
        console.log('[ModernVoiceChat] 📤 Sending context to backend:', {
          hasUserContext: !!voiceUserContext,
          firstName: voiceUserContext?.firstName,
          userName: voiceUserContext?.userName,
          hasEmotion: !!aiContext?.currentEmotion,
          hasSkin: !!aiContext?.currentSkin,
        });

        const response = await fetch(`${BACKEND_URL}/api/livekit/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: `wellness-chat-${Date.now()}`,
            identity: `user-${Date.now()}`,
            metadata: JSON.stringify({ 
              platform: 'mobile',
              // 🆕 Pass user context for unified prompt
              userContext: voiceUserContext,
              emotionContext: aiContext?.currentEmotion || null,
              skinContext: aiContext?.currentSkin || null,
              userId: currentUser?.id || null,
            }),
          }),
        });

        if (!response.ok) {
          throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Token generation failed');
        }

        console.log('[ModernVoiceChat] ✅ Token received successfully');
        console.log('[ModernVoiceChat] 📋 Context sent summary:', {
          firstName: voiceUserContext?.firstName || 'NOT FOUND',
          userName: voiceUserContext?.userName || 'NOT FOUND',
          hasContext: !!voiceUserContext,
        });
        
        // Set token and URL for LiveKitRoom component - use our backend's LiveKit URL
        setLiveKitToken(data.token);
        setLiveKitUrl(data.url); // Use the URL from our backend
        setIsLiveKitActive(true);
        
        console.log('[ModernVoiceChat] ✅ LiveKit voice chat ready');
      } catch (error) {
        console.error('[ModernVoiceChat] ❌ Failed to get LiveKit token:', error);
        setUseLiveKitVoice(false);
        Alert.alert(t('voiceChat.error'), t('voiceChat.errorToken'));
      }
    } else {
      // Stop LiveKit voice chat
      console.log('[ModernVoiceChat] 🛑 Stopping LiveKit voice chat');
      setLiveKitToken(null);
      setLiveKitUrl(null);
      setIsLiveKitActive(false);
    }
  }, []);

  const handleMicrophonePress = async () => {
    if (useLiveKitVoice) {
      // LiveKit mode: microphone is already managed by LiveKit connection
      console.log('[ModernVoiceChat] 🎤 LiveKit microphone toggle');
      return;
    } else {
      // 🆕 Auto-attiva LiveKit quando si clicca sul microfono (se non è già attivo)
      console.log('[ModernVoiceChat] 🎤 Microphone pressed - auto-enabling LiveKit Voice');
      handleLiveKitToggle(true);
    }
  };

  const handleStopAudio = async () => {
    setIsAudioPlaying(false);
  };

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value * pulseScale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const orbColors = getOrbColors();
  const { colors, mode: themeMode } = useTheme();

  const getStatusText = () => {
    if (isSpeaking) return t('voiceChat.speaking');
    if (isListening) return t('voiceChat.listening');
    if (isProcessing) return t('voiceChat.processing');
    return t('voiceChat.tapToStart');
  };

  const getStatusColor = () => {
    if (isSpeaking) return '#10b981';
    if (isListening) return '#3b82f6';
    if (isProcessing) return '#f59e0b';
    return '#6366f1';
  };

  if (!visible) return null;

  // Render LiveKitRoom component when token is available
  // 🆕 Accept LiveKit state as props so orb can react to agent speaking
  const renderContent = (liveKitAIState?: { isAISpeaking: boolean; isListening: boolean }) => {
    // 🆕 Use LiveKit state if available, otherwise use props
    const effectiveIsAISpeaking = liveKitAIState?.isAISpeaking ?? isAISpeaking;
    const effectiveIsListening = liveKitAIState?.isListening ?? (isListeningLocal || (useLiveKitVoice && isMicrophoneEnabled));
    
    // 🆕 When LiveKit is active and connected, show only orb + toggle
    const isLiveKitConnected = !!liveKitAIState;
    
    return (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          {/* 🆕 Quando LiveKit NON è connesso: MOSTRA SOLO ORB + CLOSE BUTTON */}
          {!isLiveKitConnected && (
            <>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onClose}>
                <FontAwesome name="times" size={18} color={colors.text} />
              </TouchableOpacity>

              {/* ✅ Audio Orb Visual - Centrata e grande */}
              <View style={styles.orbVisualContainer}>
                <AudioOrbVisual
                  isListening={false}
                  isSpeaking={false}
                  isProcessing={false}
                  audioLevels={{ input: 0, output: 0, bass: 0, mid: 0, treble: 0 }}
                />
                
                {/* ✅ Overlay con microfono cliccabile - avvia automaticamente LiveKit */}
                <View style={styles.orbOverlay}>
                  <TouchableOpacity
                    style={styles.orbTouchable}
                    onPress={handleMicrophonePress}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={[styles.orb, orbStyle]}>
                      <LinearGradient colors={['#3b82f6', '#2563eb', '#1d4ed8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbGradient}>
                        <View style={styles.innerGlow} />
                        <FontAwesome
                          name="microphone"
                          size={32}
                          color="#ffffff"
                        />
                      </LinearGradient>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 🆕 Status minimale: solo "Tap to start" */}
              <Text style={[styles.statusText, { color: colors.primary, marginTop: 30 }]}>
                {t('voiceChat.tapToStart')}
              </Text>
            </>
          )}

          {/* 🆕 Quando LiveKit È connesso: mostra orb reattiva + status + toggle */}
          {isLiveKitConnected && (
            <>
              {/* 🆕 Close button anche quando LiveKit è connesso */}
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onClose}>
                <FontAwesome name="times" size={18} color={colors.text} />
              </TouchableOpacity>

              {/* ✅ Audio Orb Visual - Reattiva all'audio */}
              <View style={styles.orbVisualContainer}>
                <AudioOrbVisual
                  isListening={effectiveIsListening}
                  isSpeaking={isSpeaking || effectiveIsAISpeaking}
                  isProcessing={isProcessing}
                  audioLevels={useLiveKitVoice ? {
                    input: audioLevels.inputLevel,
                    output: audioLevels.outputLevel,
                    bass: audioLevels.inputLevel * 0.8,
                    mid: audioLevels.inputLevel * 0.6,
                    treble: audioLevels.inputLevel * 0.4,
                  } : localAudioLevels}
                />
              </View>

              {/* 🆕 Status text - Minimal when LiveKit connected */}
              <View style={styles.liveKitStatusContainer}>
                <Text style={[styles.liveKitStatusText, { 
                  color: effectiveIsAISpeaking ? colors.success : effectiveIsListening ? colors.primary : colors.textSecondary 
                }]}>
                  {effectiveIsAISpeaking ? `🎙️ ${t('voiceChat.speaking')}` : 
                   effectiveIsListening ? `🎤 ${t('voiceChat.listening')}` : 
                   `✅ ${t('voiceChat.connected')}`}
                </Text>
              </View>

              {/* 🆕 Toggle button elegante per fermare */}
              <View style={styles.fastChatToggleContainerMinimal}>
                <LinearGradient
                  colors={[colors.surface, colors.surfaceSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.fastChatToggle, styles.fastChatToggleMinimal]}
                >
                  <FontAwesome name="phone" size={18} color={colors.error} style={{ marginRight: 12 }} />
                  <Text style={[styles.fastChatToggleLabel, styles.fastChatToggleLabelMinimal]}>
                    {t('voiceChat.stopCall')}
                  </Text>
                  <Switch
                    value={useLiveKitVoice}
                    onValueChange={handleLiveKitToggle}
                    trackColor={{ false: colors.border, true: colors.error }}
                    thumbColor={colors.textInverse}
                    ios_backgroundColor={colors.border}
                  />
                </LinearGradient>
              </View>

              {connectionState.error && (
                <Text style={styles.errorText}>
                  ❌ {t('voiceChat.error')}: {connectionState.error}
                </Text>
              )}
            </>
          )}
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

  // Return LiveKitRoom wrapper if token is available, otherwise return content directly
  if (liveKitToken && liveKitUrl) {
    return (
      <LiveKitRoom
        serverUrl={liveKitUrl}
        token={liveKitToken}
        connect={true}
        options={{
          // Use screen pixel density to handle screens with differing densities.
          adaptiveStream: { pixelDensity: 'screen' },
        }}
        audio={true}
        video={false}
      >
        <LiveKitConnectedContent 
          renderContent={renderContent}
          onVoiceInput={onVoiceInput}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          isAISpeaking={isAISpeaking}
          localAudioLevels={localAudioLevels}
          useLiveKitVoice={useLiveKitVoice}
        />
      </LiveKitRoom>
    );
  }

  return renderContent(); // No LiveKit state when not connected
};

// Component to handle LiveKit connection state
const LiveKitConnectedContent: React.FC<{
  renderContent: (liveKitAIState?: { isAISpeaking: boolean; isListening: boolean }) => React.ReactNode;
  onVoiceInput: (text: string) => void;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isAISpeaking: boolean;
  localAudioLevels: { input: number; output: number; bass: number; mid: number; treble: number };
  useLiveKitVoice: boolean;
}> = ({ renderContent, onVoiceInput, isListening, isSpeaking, isProcessing, isAISpeaking, localAudioLevels, useLiveKitVoice }) => {
  const { t } = useTranslation(); // 🆕 i18n hook (componente separato)
  const { colors } = useTheme(); // 🆕 Aggiunto tema per sfondo solido
  const room = useRoomContext();
  const { isMicrophoneEnabled } = useLocalParticipant();
  
  // Use useVoiceAssistant hook - this is the KEY difference!
  const { state: agentState, audioTrack, videoTrack, agent } = useVoiceAssistant();
  
  // 🆕 Track AI speaking state from agent
  const [isAISpeakingLiveKit, setIsAISpeakingLiveKit] = React.useState(false);
  
  // 🆕 Update AI speaking state based on agent state
  React.useEffect(() => {
    if (useLiveKitVoice && agentState === 'speaking') {
      setIsAISpeakingLiveKit(true);
    } else {
      setIsAISpeakingLiveKit(false);
    }
  }, [agentState, useLiveKitVoice]);
  
  // Use iOS audio management like the working implementation
  useIOSAudioManagement(room, true);
  
  // Track previous values to log only on actual changes (optimization)
  const prevStateRef = React.useRef({
    roomState: room.state,
    agentState: agentState,
    hasAgent: !!agent,
    agentId: agent?.identity,
    hasAudioTrack: !!audioTrack,
  });
  
  // Log connection state changes ONLY when they actually change (optimized)
  React.useEffect(() => {
    const prev = prevStateRef.current;
    const hasChanged = 
      prev.roomState !== room.state ||
      prev.agentState !== agentState ||
      prev.hasAgent !== !!agent ||
      prev.agentId !== agent?.identity ||
      prev.hasAudioTrack !== !!audioTrack;
    
    if (!hasChanged) return;
    
    // Log only significant state changes
    if (prev.roomState !== room.state) {
      console.log('[LiveKitConnectedContent] Room state:', room.state);
      
      if (room.state === 'connected') {
        console.log('[LiveKitConnectedContent] ✅ Successfully connected to LiveKit room!');
      }
    }
    
    if (prev.hasAgent !== !!agent && agent) {
      console.log('[LiveKitConnectedContent] 🤖 Agent connected to room!', agent.identity);
    }
    
    if (prev.agentState !== agentState) {
      console.log('[LiveKitConnectedContent] Agent state:', agentState);
    }
    
    // Update ref with current values
    prevStateRef.current = {
      roomState: room.state,
      agentState: agentState,
      hasAgent: !!agent,
      agentId: agent?.identity,
      hasAudioTrack: !!audioTrack,
    };
  }, [room.state, isMicrophoneEnabled, agent, agentState, audioTrack]);
  
  // Show loading state while connecting or waiting for agent
  if (room.state === 'connecting' || (room.state === 'connected' && !agent)) {
    return (
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('voiceChat.title')}</Text>
            <Text style={styles.subtitle}>
              {room.state === 'connecting' ? t('voiceChat.connectingToLiveKit') : t('voiceChat.waitingAgent')}
            </Text>
          </View>
          <View style={styles.orbVisualContainer}>
            <AudioOrbVisual
              isListening={false}
              isSpeaking={false}
              isProcessing={true}
              audioLevels={{ input: 0, output: 0, bass: 0, mid: 0, treble: 0 }}
            />
          </View>
          <Text style={[styles.statusText, { color: '#f59e0b' }]}>
            {room.state === 'connecting' ? t('voiceChat.connectingToVoiceChat') : t('voiceChat.agentJoining')}
          </Text>
        </View>
      </View>
    );
  }
  
  // Show error state if connection failed
  if (room.state === 'disconnected') {
    return (
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('voiceChat.title')}</Text>
            <Text style={styles.subtitle}>{t('voiceChat.connectionFailed')}</Text>
          </View>
          <Text style={[styles.statusText, { color: '#ef4444' }]}>
            {t('voiceChat.connectionFailedMessage')}
          </Text>
        </View>
      </View>
    );
  }
  
  // Show connected state with agent - 🆕 Pass LiveKit agent state to renderContent
  return <>{renderContent({ 
    isAISpeaking: isAISpeakingLiveKit, 
    isListening: isMicrophoneEnabled 
  })}</>;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    // backgroundColor sarà sovrascritto dinamicamente con colors.background
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    // 🆕 Spazio extra in alto per abbassare il testo
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    // backgroundColor e borderColor saranno sovrascritti dinamicamente
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    borderWidth: 1,
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
    color: '#f1f5f9',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
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
  orbVisualContainer: {
    width: 300,
    height: 300,
    marginBottom: 40,
    position: 'relative',
    // 🆕 Quando LiveKit è connesso, l'orb è più grande e centrata
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#6366f1', // left as brand; will be tinted by gradient overlay
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
  liveKitStatusContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  liveKitStatusText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  transcriptContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    borderColor: 'rgba(255,255,255,0.12)',
  },
  transcriptText: {
    fontSize: 16,
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  instructionsContainer: {
    marginTop: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    fontWeight: '500',
  },
  fastChatToggleContainer: {
    marginTop: 15,
    alignItems: 'center',
    // 🆕 Assicura che il toggle sia sempre visibile
    zIndex: 10,
    minHeight: 60, // 🆕 Altezza minima per garantire visibilità
  },
  fastChatToggleContainerMinimal: {
    marginTop: 30,
    position: 'absolute',
    bottom: 100, // 🆕 Alzato da 40 a 100 per migliore posizionamento
    left: 0,
    right: 0,
    alignItems: 'center',
    // 🆕 Mantieni z-index anche quando minimale
    zIndex: 10,
  },
  fastChatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fastChatToggleMinimal: {
    // 🆕 Stile migliorato: più grande, più elegante, con gradiente
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    // 🆕 Ombre più marcate e eleganti
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    // 🆕 Effetto glassmorphism (backdrop blur)
    overflow: 'hidden',
  },
  fastChatToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginRight: 10,
  },
  fastChatToggleLabelMinimal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fca5a5',
    marginRight: 12,
  },
  fastChatHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#fca5a5',
    textAlign: 'center',
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
