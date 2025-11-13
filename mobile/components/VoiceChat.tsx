import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import TTSService from '../services/tts.service';
import { BACKEND_URL } from '../constants/env';

// Database Services
import { ChatService, WellnessSuggestionService } from '../services/chat-wellness.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { AnalysisIntentService } from '../services/analysis-intent.service';
import { AnalysisActionButtons } from './AnalysisActionButtons';
import { getUserLanguage } from '../services/language.service';

const { width } = Dimensions.get('window');

interface VoiceChatProps {
  onClose: () => void;
  onUserInput?: (input: string, context: string, assistantResponse: string) => void;
  onNavigateToAnalysis?: (type: 'emotion' | 'skin') => void;
  user?: any;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ onClose, onUserInput, onNavigateToAnalysis, user }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const tts = useMemo(() => TTSService.getInstance(), []);

  // Database state
  const [currentUser, setCurrentUser] = useState<any>(user);
  const [aiContext, setAiContext] = useState<any>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [wellnessSuggestion, setWellnessSuggestion] = useState<any>(null);

  // 🆕 Funzioni per navigazione alle analisi
  const handleEmotionAnalysis = () => {
    console.log('🔍 Navigating to emotion analysis from VoiceChat');
    onClose(); // Chiudi il VoiceChat prima di navigare
    if (onNavigateToAnalysis) {
      onNavigateToAnalysis('emotion');
    }
  };

  const handleSkinAnalysis = () => {
    console.log('📸 Navigating to skin analysis from VoiceChat');
    onClose(); // Chiudi il VoiceChat prima di navigare
    if (onNavigateToAnalysis) {
      onNavigateToAnalysis('skin');
    }
  };

  const supportPrompts = [
    { icon: 'sun-o', text: 'Morning motivation' },
    { icon: 'medkit', text: 'Stress reset' },
    { icon: 'tint', text: 'Hydration reminder' },
  ];

  // Initialize TTS and Database
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await tts.initialize();
        console.log('TTS initialized for VoiceChat');
        
        // Initialize database services if user is authenticated
        if (currentUser) {
          await initializeDatabaseServices();
        }
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();
  }, [currentUser]);

  // Initialize database services
  const initializeDatabaseServices = async () => {
    try {
      console.log('🧠 Initializing database services for VoiceChat user:', currentUser.id);
      
      // Get AI context
      const context = await AIContextService.getCompleteContext(currentUser.id);
      setAiContext(context);
      
      // 🧠 NUOVO: Usa il sistema intelligente per wellness suggestions
      const intelligentSuggestion = await WellnessSuggestionService.getIntelligentSuggestion(
        currentUser.id,
        context
      );
      
      if (intelligentSuggestion.shouldShow && intelligentSuggestion.suggestion) {
        setWellnessSuggestion({
          suggestion: intelligentSuggestion.suggestion,
          shouldShowBanner: true,
          urgency: intelligentSuggestion.urgency,
          timing: intelligentSuggestion.timing
        });
        console.log('✅ Intelligent wellness suggestion loaded for VoiceChat:', intelligentSuggestion.suggestion.title);
      } else {
        console.log('ℹ️ No wellness suggestion to show for VoiceChat at this time');
        setWellnessSuggestion(null);
      }
      
      // Create or get current chat session
      const session = await ChatService.createChatSession(
        currentUser.id,
        `Voice Chat ${new Date().toLocaleDateString('it-IT')}`,
        context.currentEmotion ? {
          dominantEmotion: context.currentEmotion.emotion,
          valence: context.currentEmotion.valence,
          arousal: context.currentEmotion.arousal,
          confidence: context.currentEmotion.confidence
        } : undefined,
        context.currentSkin ? {
          overallScore: context.currentSkin.overallScore,
          hydrationScore: context.currentSkin.hydrationScore,
          oilinessScore: context.currentSkin.oilinessScore,
          textureScore: context.currentSkin.textureScore,
          pigmentationScore: context.currentSkin.pigmentationScore
        } : undefined
      );
      
      if (session) {
        setCurrentSessionId(session.id);
        console.log('✅ Voice chat session created:', session.id);
      }
      
    } catch (error) {
      console.error('Error initializing database services:', error);
    }
  };

  // Real speech recognition
  useEffect(() => {
    if (isListening) {
      const startRealSpeechRecognition = async () => {
        try {
          const SpeechRecognitionService = (await import('../services/speechRecognition.service')).default;
          
          await SpeechRecognitionService.startListening(
            (result) => {
              console.log('VoiceChat speech result:', result);
              setTranscript(result.transcript);
              
              if (result.isFinal) {
                setIsListening(false);
                setIsResponding(true);
                processUserInput(result.transcript);
              }
            },
            (error) => {
              console.error('VoiceChat speech error:', error);
              setIsListening(false);
              setIsResponding(false);
            },
            {
              language: 'it-IT',
              silenceTimeout: 3000, // 3 seconds of silence before processing
            }
          );
        } catch (error) {
          console.error('Failed to start speech recognition in VoiceChat:', error);
          setIsListening(false);
        }
      };
      
      startRealSpeechRecognition();
    }
  }, [isListening]);

  const processUserInput = async (userQuery: string) => {
    try {
      // Save user message to database if authenticated
      if (currentUser && currentSessionId) {
        await ChatService.saveChatMessage(
          currentSessionId,
          currentUser.id,
          'user',
          userQuery,
          aiContext?.currentEmotion ? {
            dominantEmotion: aiContext.currentEmotion.emotion,
            valence: aiContext.currentEmotion.valence,
            arousal: aiContext.currentEmotion.arousal,
            confidence: aiContext.currentEmotion.confidence
          } : undefined
        );
      }

      // 🆕 Rileva intent di analisi dal messaggio dell'utente
      const analysisIntent = AnalysisIntentService.detectAnalysisIntent(userQuery);
      console.log('🔍 Analysis intent detected in VoiceChat:', analysisIntent);

      // Prepare context for AI
      const userLanguage = await getUserLanguage(); // 🔥 FIX: Ottieni la lingua dell'utente
      const userContext = aiContext ? {
        emotionHistory: aiContext.emotionHistory,
        skinHistory: aiContext.skinHistory,
        emotionTrend: aiContext.emotionTrend,
        skinTrend: aiContext.skinTrend,
        insights: aiContext.insights,
        // Nuovi campi per analisi avanzate
        temporalPatterns: aiContext.temporalPatterns,
        behavioralInsights: aiContext.behavioralInsights,
        contextualFactors: aiContext.contextualFactors,
        language: userLanguage // 🔥 FIX: Includi la lingua per il backend
      } : {
        language: userLanguage // 🔥 FIX: Includi la lingua anche se non c'è contesto
      };

      // Send to OpenAI via backend for real AI response
      const response = await fetch(`${BACKEND_URL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userQuery,
          sessionId: currentSessionId,
          userId: currentUser?.id,
          emotionContext: aiContext?.currentEmotion,
          skinContext: aiContext?.currentSkin,
          userContext,
          // 🆕 Invia l'analysis intent al backend
          analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
        }),
      });

      const data = response.ok ? await response.json() : null;
      const aiResponse = data?.text || data?.message || data?.response || 
        "I'm processing that—give me just a second and I'll suggest something helpful.";

      setResponse(aiResponse);
      setIsResponding(false);

      // Save AI message to database if authenticated
      if (currentUser && currentSessionId) {
        await ChatService.saveChatMessage(
          currentSessionId,
          currentUser.id,
          'assistant',
          aiResponse,
          aiContext?.currentEmotion ? {
            dominantEmotion: aiContext.currentEmotion.emotion,
            valence: aiContext.currentEmotion.valence,
            arousal: aiContext.currentEmotion.arousal,
            confidence: aiContext.currentEmotion.confidence
          } : undefined,
          data?.wellnessSuggestionId
        );
      }

      // Speak the response using TTS
      try {
        setIsSpeaking(true);
        await tts.speak(aiResponse, {
          rate: 0.5, // Slower for better comprehension
          pitch: 1.0,
          language: 'it-IT',
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
          language: 'it-IT',
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
    } else if (isSpeaking) {
      // Stop TTS if currently speaking
      await tts.stop();
      setIsSpeaking(false);
    } else if (isListening) {
      // TODO: Stop speech recognition if currently listening
      // await SpeechRecognitionService.stopListening();
      setIsListening(false);
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withRepeat(withTiming(1.15, { duration: 700 }), -1, true) },
    ],
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withRepeat(withTiming(0.9, { duration: 700 }), -1, true) },
    ],
  }));

  return (
    <LinearGradient
      colors={['#f4f4ff', '#eef2ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrapper}
    >
      <View style={styles.voiceCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Voice Coaching</Text>
          <Text style={styles.cardSubtitle}>
            Ask anything or share how you’re feeling – your coach listens and responds instantly.
          </Text>
        </View>

        <View style={styles.promptRow}>
          {supportPrompts.map((prompt) => (
            <View key={prompt.text} style={styles.promptPill}>
              <FontAwesome name={prompt.icon as any} size={12} color="#6366f1" />
              <Text style={styles.promptText}>{prompt.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={['#a855f7', '#8b5cf6']}
            style={styles.avatarBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.avatarImageContainer}>
              <FontAwesome name="android" size={60} color="white" />
            </View>
          </LinearGradient>

          {isListening && (
            <Animated.View style={[styles.listeningIndicator, pulseStyle]}>
              <FontAwesome name="microphone" size={16} color="white" />
            </Animated.View>
          )}
        </View>

        <View style={styles.chatContainer}>
          {transcript && (
            <View style={styles.userMessage}>
              <Text style={[styles.messageText, styles.userMessageText]}>{transcript}</Text>
            </View>
          )}

          {isResponding && (
            <View style={styles.loadingContainer}>
              <Animated.View style={[styles.loadingIcon, loadingStyle]}>
                <FontAwesome name="spinner" size={16} color="#6366f1" />
              </Animated.View>
              <View style={styles.progressBar} />
            </View>
          )}

          {response && (
            <View style={styles.aiMessage}>
              <Text style={[styles.messageText, styles.aiMessageText]}>{response}</Text>
              
              {/* 🆕 Bottoni interattivi per risposta IA */}
              <AnalysisActionButtons
                message={response}
                onEmotionAnalysis={handleEmotionAnalysis}
                onSkinAnalysis={handleSkinAnalysis}
              />
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <FontAwesome name="times" size={16} color="#4338ca" />
            <Text style={styles.secondaryButtonText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
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
              size={28}
              color="#ffffff"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <FontAwesome name="cog" size={16} color="#4338ca" />
            <Text style={styles.secondaryButtonText}>Options</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    padding: 20,
  },
  voiceCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#c7d2fe',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    lineHeight: 18,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
    marginBottom: 12,
    gap: 8,
  },
  promptText: {
    fontSize: 12,
    color: '#3730a3',
    fontWeight: '500',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 28,
    alignSelf: 'center',
  },
  avatarBackground: {
    width: 192, // HeroUI avatar size
    height: 192,
    borderRadius: 96, // HeroUI rounded-full
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImageContainer: {
    width: 176, // HeroUI inner circle
    height: 176,
    borderRadius: 88, // HeroUI rounded-full
    borderWidth: 2, // HeroUI border
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningIndicator: {
    position: 'absolute',
    bottom: -8, // HeroUI positioning
    right: -8,
    width: 40, // HeroUI button size
    height: 40,
    borderRadius: 20, // HeroUI rounded-full
    backgroundColor: '#6366f1', // HeroUI primary
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    width: width * 0.8,
    alignSelf: 'center',
    marginBottom: 24, // HeroUI mb-6
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#e0e7ff',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  userMessage: {
    backgroundColor: '#F3F4F6', // HeroUI content1
    paddingHorizontal: 12, // HeroUI px-3
    paddingVertical: 8, // HeroUI py-2
    borderRadius: 16, // HeroUI rounded-large
    borderTopRightRadius: 4, // HeroUI message tail
    marginBottom: 8, // HeroUI mb-2
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  aiMessage: {
    backgroundColor: '#6366f1', // HeroUI primary
    paddingHorizontal: 12, // HeroUI px-3
    paddingVertical: 8, // HeroUI py-2
    borderRadius: 16, // HeroUI rounded-large
    borderTopLeftRadius: 4, // HeroUI message tail
    marginBottom: 8, // HeroUI mb-2
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 14, // HeroUI text-medium
    lineHeight: 20, // HeroUI leading-5
  },
  userMessageText: {
    color: '#374151',
  },
  aiMessageText: {
    color: '#f8fafc',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // HeroUI mb-2
  },
  loadingIcon: {
    width: 32, // HeroUI icon size
    height: 32,
    borderRadius: 16, // HeroUI rounded-full
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // HeroUI primary/20
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8, // HeroUI mr-2
  },
  progressBar: {
    flex: 1,
    height: 4, // HeroUI progress height
    backgroundColor: '#E5E7EB', // HeroUI border-default-100
    borderRadius: 2, // HeroUI rounded-small
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16, // HeroUI gap-4
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  secondaryButtonText: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '500',
  },
  micButton: {
    width: 72, // HeroUI button size
    height: 72,
    borderRadius: 36, // HeroUI rounded-full
    backgroundColor: '#6366f1', // HeroUI primary
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  micButtonActive: {
    backgroundColor: '#ef4444', // HeroUI danger
  },
  micButtonProcessing: {
    backgroundColor: '#8b5cf6', // HeroUI secondary
  },
  micButtonSpeaking: {
    backgroundColor: '#10b981', // HeroUI success
  },
});

export default VoiceChat;
