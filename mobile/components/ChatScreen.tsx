import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image,
  AppState,
  Alert,
  Keyboard,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming, 
  withRepeat,
  withSequence,
  runOnJS
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';

import { BACKEND_URL, getBackendURL } from '../constants/env';

import { UnifiedTTSService } from '../services/unified-tts.service';
import LoadingCloud from './LoadingCloud';
import AnimatedOrbVoiceChat from './AnimatedOrbVoiceChat';
import ModernVoiceChat from './ModernVoiceChat';
import MessageLoadingDots from './MessageLoadingDots';
import { DailyJournalService } from '../services/daily-journal.service';
import { DailyJournalDBService } from '../services/daily-journal-db.service';
import { AnalysisActionButtons } from './AnalysisActionButtons';
import { FastVoiceChatService } from '../services/fast-voice-chat.service';

// Database Services
import { ChatService, WellnessSuggestionService } from '../services/chat-wellness.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { AnalysisIntentService } from '../services/analysis-intent.service';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sessionId?: string;
  emotionContext?: any;
  wellnessSuggestionId?: string;
}

interface ChatScreenProps {
  user?: any;
  onLogout?: () => void;
}

const coachAvatar = 'https://img.heroui.chat/image/avatar?w=320&h=320&u=21';

// 🔧 Funzione per estrarre suggerimenti specifici dalla risposta IA
const extractSuggestionFromAIResponse = (aiResponse: string) => {
  const response = aiResponse.toLowerCase();
  
  // Categorie con struttura completa
  const categories = {
    mind_body: {
      id: 'mind-body',
      name: 'Mind & Body',
      description: 'Mental wellness and physical movement',
      icon: 'heartbeat',
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        light: '#d1fae5',
        gradient: ['#10b981', '#059669']
      }
    },
    nutrition: {
      id: 'nutrition',
      name: 'Nutrition',
      description: 'Healthy eating and hydration',
      icon: 'leaf',
      colors: {
        primary: '#f59e0b',
        secondary: '#d97706',
        light: '#fef3c7',
        gradient: ['#f59e0b', '#d97706']
      }
    }
  };
  
  // Mappa dei suggerimenti disponibili con struttura completa
  const suggestions = {
    'gentle stretching': {
      id: 'gentle-stretching',
      title: 'Gentle Stretching',
      description: 'Allungamenti per collo e spalle per rilasciare tensione',
      icon: 'leaf',
      category: categories.mind_body,
      duration: '10 minutes',
      difficulty: 'easy',
      tags: ['stress', 'tension'],
      content: 'Pratica allungamenti dolci per 10 minuti per rilasciare la tensione accumulata nel corpo.'
    },
    'green tea break': {
      id: 'green-tea-break',
      title: 'Green Tea Break',
      description: 'Pausa con tè verde per antiossidanti e calma',
      icon: 'coffee',
      category: categories.nutrition,
      duration: '5 minutes',
      difficulty: 'easy',
      tags: ['relaxation', 'antioxidants'],
      content: 'Prenditi una pausa di 5 minuti con una tazza di tè verde per godere dei benefici antiossidanti e rilassanti.'
    },
    'breathing exercises': {
      id: 'breathing-exercises',
      title: 'Breathing Exercises',
      description: 'Pratica respirazione consapevole per ridurre stress',
      icon: 'leaf',
      category: categories.mind_body,
      duration: '5 minutes',
      difficulty: 'easy',
      tags: ['stress', 'focus', 'calm'],
      content: 'Pratica esercizi di respirazione per 5 minuti per ridurre lo stress e calmare la mente.'
    },
    'take a walk': {
      id: 'take-a-walk',
      title: 'Camminata Quotidiana',
      description: 'Attività fisica leggera per il benessere generale',
      icon: 'road',
      category: categories.mind_body,
      duration: '15 minutes',
      difficulty: 'easy',
      tags: ['mood', 'circulation', 'outdoor'],
      content: 'Fai una camminata di 15 minuti all\'aperto per migliorare umore e circolazione.'
    }
  };
  
  // Cerca corrispondenze nella risposta IA
  for (const [key, suggestion] of Object.entries(suggestions)) {
    if (response.includes(key) || response.includes(suggestion.title.toLowerCase())) {
      return suggestion;
    }
  }
  
  return null;
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ user, onLogout }) => {
  const router = useRouter();
  const { voiceMode, t } = useLocalSearchParams();
  
  // Force voice interface to open if voiceMode is true
  useEffect(() => {
    if (voiceMode === 'true') {
      console.log('ChatScreen: Force opening voice interface immediately');
      setShowVoiceInterface(true);
      voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [voiceMode, t]);
  // 🔧 FIX: Messaggio iniziale personalizzato
  const getInitialMessage = () => {
    if (currentUserProfile?.first_name) {
      return `Ciao ${currentUserProfile.first_name}! 👋 Sono il tuo AI wellness coach. Come ti senti oggi?`;
    } else if (user?.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0];
      return `Ciao ${firstName}! 👋 Sono il tuo AI wellness coach. Come ti senti oggi?`;
    } else if (user?.email) {
      const firstName = user.email.split('@')[0].split('.')[0];
      return `Ciao ${firstName}! 👋 Sono il tuo AI wellness coach. Come ti senti oggi?`;
    }
    return 'Ciao! 👋 Sono il tuo AI wellness coach. Come ti senti oggi?';
  };

  const [mode, setMode] = useState<'chat' | 'journal'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: getInitialMessage(),
      sender: 'ai',
      timestamp: new Date(Date.now() - 60000),
    },
  ]);
  const [journalText, setJournalText] = useState('');
  const [journalPrompt, setJournalPrompt] = useState('');
  const [journalHistory, setJournalHistory] = useState<any[]>([]);
  const dayKey = DailyJournalService.todayKey();
  // Database state (must be declared before effects using it)
  const [currentUser, setCurrentUser] = useState<any>(user);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSavedChip, setShowSavedChip] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(dayKey);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [monthDays, setMonthDays] = useState<string[]>([]);
  const [monthMoodMap, setMonthMoodMap] = useState<Record<string, number>>({});
  const [monthRestMap, setMonthRestMap] = useState<Record<string, number>>({});
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Persist and restore mode
  useEffect(() => {
    (async () => {
      const savedMode = await AsyncStorage.getItem('chat:mode');
      if (savedMode === 'journal' || savedMode === 'chat') setMode(savedMode as any);
    })();
  }, []);
  useEffect(() => { AsyncStorage.setItem('chat:mode', mode); }, [mode]);

  // Load journal local + remote, build prompt
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      const local = await DailyJournalService.getLocalEntry(selectedDayKey);
      setJournalText(local.content);
      setJournalPrompt(local.aiPrompt);
      // Build prompt from mood/sleep notes if empty
      if (!local.aiPrompt) {
        const moodNote = await AsyncStorage.getItem(`checkin:mood_note:${selectedDayKey}`);
        const sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${selectedDayKey}`);
        const prompt = DailyJournalService.buildAIPrompt({ moodNote: moodNote || undefined, sleepNote: sleepNote || undefined });
        setJournalPrompt(prompt);
        await DailyJournalService.saveLocalEntry(selectedDayKey, local.content, prompt);
      }
      // Recent history
      try {
        const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
        setJournalHistory(recent);
      } catch (e) {
        console.log('Failed to load journal history', e);
      }
      // Try to fetch AI fields for selected day
      try {
        const existing = await DailyJournalDBService.getEntryByDate(currentUser.id, selectedDayKey);
        console.log('🔍 Loading AI data for day:', selectedDayKey, existing);
        setAiSummary(existing?.ai_summary ?? null);
        setAiScore((existing as any)?.ai_score ?? null);
        setAiLabel((existing as any)?.ai_label ?? null);
        setAiAnalysis((existing as any)?.ai_analysis ?? null);
        console.log('🔍 AI data loaded:', {
          summary: existing?.ai_summary,
          score: (existing as any)?.ai_score,
          label: (existing as any)?.ai_label,
          analysis: (existing as any)?.ai_analysis
        });
      } catch (e) {
        console.log('❌ Error loading AI data:', e);
      }
    })();
  }, [currentUser, selectedDayKey]);

  // Build month days and color maps
  useEffect(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const days: string[] = [];
    for (let d = first.getDate(); d <= last.getDate(); d++) {
      const iso = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d).toISOString().slice(0, 10);
      days.push(iso);
    }
    setMonthDays(days);
    (async () => {
      const moodPairs = await Promise.all(days.map(async (iso) => [iso, await AsyncStorage.getItem(`checkin:mood:${iso}`)] as const));
      const restPairs = await Promise.all(days.map(async (iso) => [iso, await AsyncStorage.getItem(`checkin:rest_level:${iso}`)] as const));
      const moodMap: Record<string, number> = {};
      const restMap: Record<string, number> = {};
      moodPairs.forEach(([k, v]) => { if (v) moodMap[k] = parseInt(v, 10); });
      restPairs.forEach(([k, v]) => { if (v) restMap[k] = parseInt(v, 10); });
      setMonthMoodMap(moodMap);
      setMonthRestMap(restMap);
    })();
  }, [currentMonth]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false);
  const [showLoadingCloud, setShowLoadingCloud] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // ⚡ Fast Chat States
  const [useFastChat, setUseFastChat] = useState(true);
  const [fastChatLoading, setFastChatLoading] = useState(false);
  const [fastChatMessage, setFastChatMessage] = useState('');
  const [fastChatTimings, setFastChatTimings] = useState<any>(null);
  const fastChatService = useRef(new FastVoiceChatService());

  // 🔧 FIX: Aggiorna currentUser quando user cambia
  useEffect(() => {
    console.log('🔧 ChatScreen: user prop changed:', user ? { id: user.id, email: user.email } : null);
    setCurrentUser(user);
    
    // 🔧 Carica il profilo utente per ottenere first_name e last_name
    if (user?.id) {
      AuthService.getUserProfile(user.id).then(profile => {
        setCurrentUserProfile(profile);
        console.log('👤 User profile loaded:', profile ? { first_name: profile.first_name, last_name: profile.last_name } : null);
      });
    } else {
      setCurrentUserProfile(null);
    }
    
    // 🔧 Aggiorna anche il messaggio iniziale con il nome se user è disponibile
    if (user) {
      const personalizedMessage = getInitialMessage();
      setMessages(prev => prev.map(msg => 
        msg.id === 'welcome' 
          ? { ...msg, text: personalizedMessage }
          : msg
      ));
    }
  }, [user]);
  const [aiContext, setAiContext] = useState<any>(null);
  const [wellnessSuggestion, setWellnessSuggestion] = useState<any>(null);
  const [showWellnessPopup, setShowWellnessPopup] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Wellness popup handlers
  const handleAddToToday = async (suggestion: any) => {
    // 🎓 Learn from user interaction
    await WellnessSuggestionService.learnFromUserInteraction(
      currentUser.id,
      suggestion.id,
      'accepted'
    );
    
    // Show completion feedback
    Alert.alert(
      'Ottimo!',
      'Suggerimento applicato. Come ti senti dopo averlo provato?',
      [
        { text: 'Molto bene', onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            5,
            'Molto efficace'
          );
        }},
        { text: 'Bene', onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            4,
            'Utile'
          );
        }},
        { text: 'Così così', onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            3,
            'Normale'
          );
        }}
      ]
    );
    setShowWellnessPopup(false);
    setWellnessSuggestion(null);
  };

  const handleDismissPopup = async () => {
    // 🎓 Learn from user interaction
    await WellnessSuggestionService.learnFromUserInteraction(
      currentUser.id,
      wellnessSuggestion.suggestion.id,
      'dismissed'
    );
    setShowWellnessPopup(false);
    setWellnessSuggestion(null);
  };

  const handleStartExercise = async (suggestion: any) => {
    // 🎓 Learn from user interaction
    await WellnessSuggestionService.learnFromUserInteraction(
      currentUser.id,
      suggestion.id,
      'accepted'
    );
    
    // Navigate to breathing exercise screen
    if (suggestion.id === 'breathing-exercises') {
      router.push('/breathing-exercise');
    }
    setShowWellnessPopup(false);
    setWellnessSuggestion(null);
  };

  // Keyboard management states - 🔧 SPOSTATO PRIMA DEGLI useEffect CHE LI USANO
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputContainerRef = useRef<View>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // 🔧 DEBUG: Log user state
  useEffect(() => {
    console.log('👤 User state:', { 
      user: user, 
      currentUser: currentUser, 
      aiContext: aiContext,
      sessionId: currentSessionId,
      userId: currentUser?.id,
      userEmail: currentUser?.email
    });
  }, [user, currentUser, aiContext, currentSessionId]);

  // 🔧 DEBUG: Log keyboard state
  useEffect(() => {
    console.log('⌨️ Keyboard state:', { 
      keyboardVisible, 
      keyboardHeight, 
      inputFocused,
      platform: Platform.OS
    });
  }, [keyboardVisible, keyboardHeight, inputFocused]);

  const scrollRef = useRef<ScrollView>(null);
  const tts = useMemo(() => UnifiedTTSService.getInstance(), []);

  // Animation values
  const micScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const voiceInterfaceOpacity = useSharedValue(0);

  const quickReplies = [
    { text: 'I\'m feeling stressed', icon: 'heartbeat', color: '#ef4444' },
    { text: 'Help me sleep better', icon: 'moon-o', color: '#8b5cf6' },
    { text: 'Give me energy tips', icon: 'bolt', color: '#f59e0b' },
    { text: 'Skin care advice', icon: 'tint', color: '#3b82f6' },
  ];

  const getDayColor = async (date: Date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // First try to get AI score from database
    try {
      if (currentUser) {
        const entry = await DailyJournalDBService.getEntryByDate(currentUser.id, dateKey);
        if (entry && (entry as any).ai_score) {
          return DailyJournalService.colorForScore((entry as any).ai_score);
        }
      }
    } catch (e) {
      // Fallback to mood/rest level
    }
    
    // Fallback to mood/rest level from AsyncStorage
    const mood = await AsyncStorage.getItem(`checkin:mood:${dateKey}`);
    const restLevel = await AsyncStorage.getItem(`checkin:rest_level:${dateKey}`);

    if (mood) {
      const moodValue = parseInt(mood, 10);
      if (moodValue <= 2) return '#ef4444'; // Red
      if (moodValue === 3) return '#f59e0b'; // Orange
      if (moodValue >= 4) return '#10b981'; // Green
    } else if (restLevel) {
      const restValue = parseInt(restLevel, 10);
      if (restValue <= 2) return '#fca5a5'; // Light Red
      if (restValue === 3) return '#fcd34d'; // Light Orange
      if (restValue >= 4) return '#a7f3d0'; // Light Green
    }
    return '#e2e8f0'; // Neutral gray
  };

  // Initialize TTS and Database
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await tts.initialize();
        console.log('TTS initialized for ChatScreen');
        
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
      console.log('🧠 Initializing database services for user:', currentUser.id);
      
      // Get AI context
      const context = await AIContextService.getCompleteContext(currentUser.id);
      setAiContext(context);
      
      // 🔧 RIMOSSO: Non mostrare banner iniziale automatico
      // Il banner apparirà solo dopo conversazioni contestuali
      console.log('ℹ️ Wellness suggestions will appear contextually during conversations');
      setWellnessSuggestion(null);
      
      // Create or get current chat session
      const session = await ChatService.createChatSession(
        currentUser.id,
        `Chat ${new Date().toLocaleDateString('it-IT')}`,
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
        console.log('✅ Chat session created:', session.id);
      }
      
    } catch (error) {
      console.error('Error initializing database services:', error);
    }
  };

  // Auto-start voice mode when coming from Avatar mic button
  useEffect(() => {
    console.log('ChatScreen: voiceMode changed to:', voiceMode, 'timestamp:', t);
    if (voiceMode === 'true') {
      console.log('ChatScreen: Starting voice interface');
      const timer = setTimeout(() => {
        setShowVoiceInterface(true);
        voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
        console.log('ChatScreen: Voice interface opened');
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [voiceMode, t]);

  // Also check voiceMode on component mount/focus
  useEffect(() => {
    console.log('ChatScreen: Component mounted/focused, voiceMode:', voiceMode);
    if (voiceMode === 'true' && !showVoiceInterface) {
      console.log('ChatScreen: Auto-opening voice interface on mount');
      const timer = setTimeout(() => {
        setShowVoiceInterface(true);
        voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for app state changes to handle navigation
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('ChatScreen: App state changed to:', nextAppState);
      if (nextAppState === 'active' && voiceMode === 'true' && !showVoiceInterface) {
        console.log('ChatScreen: App became active, opening voice interface');
        setTimeout(() => {
          setShowVoiceInterface(true);
          voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
        }, 200);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [voiceMode, showVoiceInterface]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keyboard management
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      console.log('⌨️ Keyboard shown, height:', e.endCoordinates.height);
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      
      // Scroll to bottom when keyboard appears
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      console.log('⌨️ Keyboard hidden');
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setInputFocused(false);
      
      // 🔧 FIX: Forza il reset completo del layout
      setTimeout(() => {
        // Reset scroll position
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
        
        // 🔧 FIX: Forza il re-render per tornare alla posizione iniziale
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }, 100);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 🆕 Funzioni per navigazione alle analisi
  const handleEmotionAnalysis = () => {
    console.log('🔍 Navigating to emotion analysis');
    router.push('/(tabs)/analysis');
  };

  const handleSkinAnalysis = () => {
    console.log('📸 Navigating to skin analysis');
    router.push('/(tabs)/skin');
  };

  // 🆕 Handle voice messages through the same pipeline as text
  const handleVoiceMessage = async (voiceText: string) => {
    try {
      console.log('🎤 Processing voice message:', voiceText);
      
      // 🆕 Rileva intent di analisi dal messaggio vocale
      const analysisIntent = AnalysisIntentService.detectAnalysisIntent(voiceText);
      console.log('🔍 Analysis intent detected in voice:', analysisIntent);

      // Prepare context for AI (same as text chat)
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
        // 🔧 Aggiungi nome utente per personalizzazione (usa first_name se disponibile)
        firstName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        lastName: currentUserProfile?.last_name || currentUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
        userName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente'
      } : {
        // 🔧 FALLBACK: Contesto base anche senza autenticazione
        emotionHistory: [],
        skinHistory: [],
        emotionTrend: null,
        skinTrend: null,
        insights: [],
        temporalPatterns: null,
        behavioralInsights: null,
        contextualFactors: null,
        userName: 'Utente',
        isAnonymous: true
      };

      console.log('🌐 Making request to dynamic backend URL');
      console.log('🌐 BACKEND_URL value:', BACKEND_URL);
      
      // 🔧 AUTO-DISCOVERY: Ottieni URL dinamico del backend
      const dynamicBackendURL = await getBackendURL();
      console.log('🌐 Dynamic backend URL:', dynamicBackendURL);
      
      const response = await fetch(`${dynamicBackendURL}/api/chat/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: voiceText,
          sessionId: currentSessionId,
          userId: currentUser?.id,
          emotionContext: aiContext?.currentEmotion,
          skinContext: aiContext?.currentSkin,
          userContext,
          // 🆕 Invia l'analysis intent al backend
          analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
          messageHistory: messages.slice(-5).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        }),
      });

      const data = response.ok ? await response.json() : null;
      const reply = data?.text || data?.message || data?.response || 
        "I'm processing that—give me just a second and I'll suggest something helpful.";

      const aiMessage: Message = {
        id: `${Date.now()}-voice-ai`,
        text: reply,
        sender: 'ai',
        timestamp: new Date(),
        sessionId: currentSessionId || undefined,
        wellnessSuggestionId: data?.wellnessSuggestionId,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to database if authenticated
      if (currentUser && currentSessionId) {
        await ChatService.saveChatMessage(
          currentSessionId,
          currentUser.id,
          'assistant',
          reply,
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
      setIsProcessing(false);
      setIsSpeaking(true);
      
      try {
        await tts.speak(reply, {
          rate: 0.5,
          pitch: 1.0,
          language: 'it-IT',
        });
      } catch (error) {
        console.error('TTS error:', error);
      } finally {
        setIsSpeaking(false);
      }

      // 🔧 MIGLIORATO: Banner coerente con suggerimenti IA
      if (currentUser && aiContext) {
        try {
          // Solo se l'utente ha espresso bisogni specifici o l'IA ha dato consigli
          const shouldShowSuggestion = 
            analysisIntent.confidence > 0.3 || // Intent di analisi rilevato
            reply.toLowerCase().includes('consiglio') || // IA ha dato consigli
            reply.toLowerCase().includes('prova') || // IA ha suggerito azioni
            reply.toLowerCase().includes('breathing') || // Suggerimenti specifici
            reply.toLowerCase().includes('camminata') ||
            reply.toLowerCase().includes('stretching') ||
            reply.toLowerCase().includes('green tea');
          
          if (shouldShowSuggestion) {
            // 🔧 NUOVO: Estrai suggerimento specifico dalla risposta IA
            const aiSuggestion = extractSuggestionFromAIResponse(reply);
            
            if (aiSuggestion) {
              // Usa il suggerimento specifico dell'IA
              setWellnessSuggestion({
                suggestion: aiSuggestion,
                shouldShowBanner: true,
                urgency: 'medium',
                timing: 'now'
              });
              console.log('✅ AI-specific wellness suggestion shown:', aiSuggestion.title);
            } else {
              // Fallback al sistema intelligente
              const suggestion = await WellnessSuggestionService.getIntelligentSuggestion(
                currentUser.id,
                aiContext
              );
              
              if (suggestion.shouldShow) {
                setWellnessSuggestion({
                  ...suggestion,
                  shouldShowBanner: true
                });
                console.log('✅ Contextual wellness suggestion shown:', suggestion.suggestion?.title);
              }
            }
          } else {
            console.log('ℹ️ No contextual trigger for wellness suggestion');
          }
        } catch (error) {
          console.error('Error getting wellness suggestion:', error);
        }
      }

    } catch (error) {
      console.error('Error processing voice message:', error);
      setIsProcessing(false);
      
      // Show error message
      const errorMessage: Message = {
        id: `${Date.now()}-voice-error`,
        text: "Sorry, I couldn't process your voice message. Please try again.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Keyboard management functions
  const handleInputFocus = () => {
    console.log('⌨️ Input focused');
    setInputFocused(true);
    
    // Scroll to bottom when input is focused
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleInputBlur = () => {
    console.log('⌨️ Input blurred');
    setInputFocused(false);
    
    // Small delay to ensure smooth transition
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      text: trimmed,
      sender: 'user',
      timestamp: new Date(),
      sessionId: currentSessionId || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);
    setShowLoadingCloud(true);

    try {
      // Save user message to database if authenticated
      if (currentUser && currentSessionId) {
        await ChatService.saveChatMessage(
          currentSessionId,
          currentUser.id,
          'user',
          trimmed,
          aiContext?.currentEmotion ? {
            dominantEmotion: aiContext.currentEmotion.emotion,
            valence: aiContext.currentEmotion.valence,
            arousal: aiContext.currentEmotion.arousal,
            confidence: aiContext.currentEmotion.confidence
          } : undefined
        );
      }

      // ⚡ Fast Chat should be used for voice input, not text input
      // For now, disable Fast Chat entirely until voice input is properly detected
      if (false) { // Disabled: useFastChat && mode === 'chat'
        // ⚡ Use Fast Chat System ONLY for voice chat mode
        setFastChatLoading(true);
        setFastChatMessage('');
        
        console.log('[ChatScreen] 🚀 Using Fast Chat for voice mode:', trimmed);
        
        // Prepare complete context for Fast Chat (same as traditional chat)
        const fastChatContext = aiContext ? {
          emotionHistory: aiContext.emotionHistory,
          skinHistory: aiContext.skinHistory,
          emotionTrend: aiContext.emotionTrend,
          skinTrend: aiContext.skinTrend,
          insights: aiContext.insights,
          wellnessSuggestion: wellnessSuggestion?.suggestion,
          temporalPatterns: aiContext.temporalPatterns,
          behavioralInsights: aiContext.behavioralInsights,
          contextualFactors: aiContext.contextualFactors,
          firstName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
          lastName: currentUserProfile?.last_name || currentUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
          userName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente'
        } : {
          emotionHistory: [],
          skinHistory: [],
          emotionTrend: null,
          skinTrend: null,
          insights: [],
          wellnessSuggestion: null,
          temporalPatterns: null,
          behavioralInsights: null,
          contextualFactors: null,
          userName: 'Utente',
          isAnonymous: true
        };

        // Detect analysis intent for Fast Chat
        const analysisIntent = AnalysisIntentService.detectAnalysisIntent(trimmed);
        console.log('🔍 Analysis intent detected for Fast Chat:', analysisIntent);

        try {
          for await (const chunk of fastChatService.current.streamChatResponse(
            trimmed,
            fastChatContext,
            true, // Include audio
            aiContext?.currentEmotion, // emotionContext
            aiContext?.currentSkin, // skinContext
            analysisIntent // analysisIntent
          )) {
            console.log('[ChatScreen] 📨 Fast chat chunk:', {
              type: chunk.type,
              size: chunk.chunk ? chunk.chunk.length : 'audio'
            });

            if (chunk.type === 'text' && chunk.chunk) {
              setFastChatMessage(prev => prev + chunk.chunk);
            } else if (chunk.type === 'complete') {
              setFastChatTimings(chunk.timings);
              console.log('[ChatScreen] ⚡ Fast chat complete:', {
                totalTime: chunk.timings?.total,
                geminiTime: chunk.timings?.gemini
              });
            } else if (chunk.type === 'error') {
              console.error('[ChatScreen] ❌ Fast chat error:', chunk.error);
              throw new Error(chunk.error || 'Fast chat failed');
            }
          }
        } catch (fastChatError) {
          console.error('[ChatScreen] ❌ Fast chat failed, falling back to traditional chat:', fastChatError);
          
          // Fallback to traditional chat system
          setUseFastChat(false);
          setFastChatLoading(false);
          
          // Show user-friendly message
          const fallbackMessage: Message = {
            id: `${Date.now()}-fallback`,
            text: "Sistema veloce temporaneamente non disponibile, uso il sistema tradizionale...",
            sender: 'ai',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, fallbackMessage]);
          
          // Continue with traditional chat logic
          return;
        }

        // Add AI response to messages
        const aiMessage: Message = {
          id: `${Date.now()}-ai`,
          text: fastChatMessage,
          sender: 'ai',
          timestamp: new Date(),
          sessionId: currentSessionId || undefined,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setFastChatLoading(false);
      } else {
        // 🔄 Use Traditional Chat System (OpenAI) for all text messages
        // Fast Chat is only available in ModernVoiceChat component for voice input
        console.log('[ChatScreen] 💬 Using traditional OpenAI chat for text messages');
        
        // 🆕 Rileva intent di analisi dal messaggio dell'utente
        const analysisIntent = AnalysisIntentService.detectAnalysisIntent(trimmed);
        console.log('🔍 Analysis intent detected:', analysisIntent);

        // Prepare context for AI
        const userContext = aiContext ? {
          emotionHistory: aiContext.emotionHistory,
          skinHistory: aiContext.skinHistory,
          emotionTrend: aiContext.emotionTrend,
          skinTrend: aiContext.skinTrend,
          insights: aiContext.insights,
          wellnessSuggestion: wellnessSuggestion?.suggestion,
          // Nuovi campi per analisi avanzate
          temporalPatterns: aiContext.temporalPatterns,
          behavioralInsights: aiContext.behavioralInsights,
          contextualFactors: aiContext.contextualFactors,
          // 🔧 Aggiungi nome utente per personalizzazione (usa first_name se disponibile)
          firstName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
          lastName: currentUserProfile?.last_name || currentUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
          userName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente'
        } : {
          // 🔧 FALLBACK: Contesto base anche senza autenticazione
          emotionHistory: [],
          skinHistory: [],
          emotionTrend: null,
          skinTrend: null,
          insights: [],
          wellnessSuggestion: null,
          temporalPatterns: null,
          behavioralInsights: null,
          contextualFactors: null,
          userName: 'Utente',
          isAnonymous: true
        };

        console.log('🌐 Making request to dynamic backend URL');
        console.log('🌐 BACKEND_URL value:', BACKEND_URL);
        
        // 🔧 AUTO-DISCOVERY: Ottieni URL dinamico del backend
        const dynamicBackendURL = await getBackendURL();
        console.log('🌐 Dynamic backend URL:', dynamicBackendURL);
        
        const response = await fetch(`${dynamicBackendURL}/api/chat/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: trimmed,
            sessionId: currentSessionId,
            userId: currentUser?.id,
            emotionContext: aiContext?.currentEmotion,
            skinContext: aiContext?.currentSkin,
            userContext,
            // 🆕 Invia l'analysis intent al backend
            analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
            messageHistory: messages.slice(-5).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          }),
        });

        const data = response.ok ? await response.json() : null;
        const reply = data?.text || data?.message || data?.response || 
          "I'm processing that—give me just a second and I'll suggest something helpful.";

        const aiMessage: Message = {
          id: `${Date.now()}-ai`,
          text: reply,
          sender: 'ai',
          timestamp: new Date(),
          sessionId: currentSessionId || undefined,
          wellnessSuggestionId: data?.wellnessSuggestionId,
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Save AI message to database if authenticated
        if (currentUser && currentSessionId) {
          await ChatService.saveChatMessage(
            currentSessionId,
            currentUser.id,
            'assistant',
            reply,
            aiContext?.currentEmotion ? {
              dominantEmotion: aiContext.currentEmotion.emotion,
              valence: aiContext.currentEmotion.valence,
              arousal: aiContext.currentEmotion.arousal,
              confidence: aiContext.currentEmotion.confidence
            } : undefined,
            data?.wellnessSuggestionId
          );
        }

        // Only speak the response if input was vocal
        if (isVoiceMode) {
          try {
            setIsSpeaking(true);
            await tts.speak(reply, {
              rate: 0.5,
              pitch: 1.0,
              language: 'it-IT',
            });
          } catch (error) {
            console.error('TTS error:', error);
          } finally {
            setIsSpeaking(false);
          }
        }

        // 🔧 MIGLIORATO: Banner coerente con suggerimenti IA
        if (currentUser && aiContext) {
          try {
            // Solo se l'utente ha espresso bisogni specifici o l'IA ha dato consigli
            const shouldShowSuggestion = 
              analysisIntent.confidence > 0.3 || // Intent di analisi rilevato
              reply.toLowerCase().includes('consiglio') || // IA ha dato consigli
              reply.toLowerCase().includes('prova') || // IA ha suggerito azioni
              reply.toLowerCase().includes('breathing') || // Suggerimenti specifici
              reply.toLowerCase().includes('camminata') ||
              reply.toLowerCase().includes('stretching') ||
              reply.toLowerCase().includes('green tea');
            
            if (shouldShowSuggestion) {
              // 🔧 NUOVO: Estrai suggerimento specifico dalla risposta IA
              const aiSuggestion = extractSuggestionFromAIResponse(reply);
              
              if (aiSuggestion) {
                // Usa il suggerimento specifico dell'IA
                setWellnessSuggestion({
                  suggestion: aiSuggestion,
                  shouldShowBanner: true,
                  urgency: 'medium',
                  timing: 'now'
                });
                console.log('✅ AI-specific wellness suggestion shown:', aiSuggestion.title);
              } else {
                // Fallback al sistema intelligente
                const suggestion = await WellnessSuggestionService.getIntelligentSuggestion(
                  currentUser.id,
                  aiContext
                );
                
                if (suggestion.shouldShow) {
                  setWellnessSuggestion({
                    ...suggestion,
                    shouldShowBanner: true
                  });
                  console.log('✅ Contextual wellness suggestion shown:', suggestion.suggestion?.title);
                }
              }
            } else {
              console.log('ℹ️ No contextual trigger for wellness suggestion');
            }
          } catch (error) {
            console.error('Error getting wellness suggestion:', error);
          }
        }
      }
    } catch (error) {
      console.error('Chat send error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-fallback`,
          text: "I'm having a little trouble connecting right now, but we can keep chatting—try again in a moment?",
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
      setShowLoadingCloud(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    setInputValue(reply);
  };

  const handleVoiceToggle = async () => {
    if (!isListening && !isSpeaking && !isProcessing) {
      try {
        setIsListening(true);
        setIsVoiceMode(true);
        setTranscript('');
        
        // Import and use Professional Speech Recognition (expo-speech-recognition)
        const ProfessionalSpeechRecognitionService = (await import('../services/professional-speech-recognition.service')).default;
        const speechService = ProfessionalSpeechRecognitionService.getInstance();
        
        await speechService.startListening(
          (result) => {
            console.log('Speech recognition result:', result);
            setTranscript(result.transcript);
            
            if (result.isFinal) {
              setIsListening(false);
              setIsProcessing(true);
              
              // Add user message
              const userMessage: Message = {
                id: `${Date.now()}-voice-user`,
                text: result.transcript,
                sender: 'user',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, userMessage]);
              
              // Send to OpenAI and get real response
              handleVoiceMessage(result.transcript);
            }
          },
          (error) => {
            console.error('Speech recognition error:', error);
            setIsListening(false);
            setIsProcessing(false);
            
            // Show error message
            const errorMessage: Message = {
              id: `${Date.now()}-voice-error`,
              text: "Sorry, I couldn't understand what you said. Please try again.",
              sender: 'ai',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
          {
            language: 'it-IT',
            silenceTimeout: 3000, // 3 seconds of silence before processing
          }
        );
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    } else if (isSpeaking) {
      await tts.stop();
      setIsSpeaking(false);
    } else if (isListening) {
      // Stop speech recognition
      try {
        const ProfessionalSpeechRecognitionService = (await import('../services/professional-speech-recognition.service')).default;
        const speechService = ProfessionalSpeechRecognitionService.getInstance();
        await speechService.stopListening();
        setIsListening(false);
      } catch (error) {
        console.error('Failed to stop speech recognition:', error);
        setIsListening(false);
      }
    }
  };


  const closeVoiceInterface = () => {
    voiceInterfaceOpacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(setShowVoiceInterface)(false);
    });
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Animation styles
  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const voiceInterfaceStyle = useAnimatedStyle(() => ({
    opacity: voiceInterfaceOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.flex} 
        behavior={keyboardVisible ? "height" : "padding"}  // 🔧 FIX: Comportamento dinamico
        keyboardVerticalOffset={0}   
        enabled={keyboardVisible}  // 🔧 FIX: Disabilita quando tastiera chiusa
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.headerButton}>
            <FontAwesome name="chevron-left" size={18} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {/* Segmented toggle: Chat | Journal */}
            <View style={styles.segmentedWrap}>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'chat' && styles.segmentBtnActive]}
                onPress={() => setMode('chat')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'chat' }}
              >
                <Text style={[styles.segmentText, mode === 'chat' && styles.segmentTextActive]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'journal' && styles.segmentBtnActive]}
                onPress={() => setMode('journal')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'journal' }}
              >
                <Text style={[styles.segmentText, mode === 'journal' && styles.segmentTextActive]}>Journal</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <FontAwesome name="cog" size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Fast Chat is only available for voice chat mode */}
        {/* Text chat always uses OpenAI for stability and quality */}

        {/* Wellness Suggestion Banner */}
        {wellnessSuggestion?.shouldShowBanner && wellnessSuggestion?.suggestion && (
          <View style={styles.wellnessBanner}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.wellnessBannerGradient}
            >
              <View style={styles.wellnessBannerContent}>
                <FontAwesome name="lightbulb-o" size={20} color="#fff" />
                <View style={styles.wellnessBannerText}>
                  <Text style={styles.wellnessBannerTitle}>
                    {wellnessSuggestion.suggestion.title}
                  </Text>
                  <Text style={styles.wellnessBannerDescription}>
                    {wellnessSuggestion.suggestion.description}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.wellnessBannerButton}
                  onPress={() => {
                    // Show wellness suggestion popup instead of alert
                    setShowWellnessPopup(true);
                  }}
                >
                  <FontAwesome name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
                
                {/* 🔧 Pulsante per chiudere il banner */}
                <TouchableOpacity
                  style={styles.wellnessBannerCloseButton}
                  onPress={() => setWellnessSuggestion(null)}
                >
                  <FontAwesome name="times" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Modern Voice Chat */}
        <ModernVoiceChat
          visible={showVoiceInterface}
          onClose={() => setShowVoiceInterface(false)}
          onVoiceInput={async (text) => {
            // ✅ REAL VOICE INPUT - No more simulation!
            console.log('🎤 Real voice input received:', text);
            
            if (mode === 'journal') {
              // In Journal mode, append dictation to journal text instead of sending to chat
              setJournalText(prev => (prev ? `${prev}\n${text}` : text));
              setIsListening(false);
              setIsProcessing(false);
              setIsVoiceMode(false);
              return;
            }

            setIsVoiceMode(true);
            setIsListening(false);
            setIsProcessing(true);
            setTranscript(text);
            
            // Add user message
            const userMessage: Message = {
              id: `${Date.now()}-voice-user`,
              text: text,
              sender: 'user',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);
            
            // Process the real voice input through the same pipeline as text chat
            await handleVoiceMessage(text);
          }}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          transcript={transcript}
          onAddWellnessActivity={(suggestion) => {
            console.log('Adding wellness activity to today:', suggestion);
            // TODO: Implement adding to today's activities
            // This will be implemented later with proper data storage
          }}
        />

        {/* Chat/Journal Content */}
        <ScrollView
          ref={scrollViewRef}
          style={[
            styles.scrollArea,
            // 🔧 FIX: Riduci l'altezza dell'area scroll quando la tastiera è aperta
            keyboardVisible && {
              height: height - keyboardHeight - 120, // 🔧 FIX: Spazio ottimizzato per input bar
            }
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            // 🔧 FIX: Padding dinamico per ottimizzare spazio
            {
              paddingBottom: keyboardVisible ? 0 : 20
            }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          nestedScrollEnabled={true}
          automaticallyAdjustKeyboardInsets={false} // 🔧 DISABILITATO: Gestiamo manualmente
        >
          {mode === 'chat' ? (
            <>
              {/* Quick Replies */}
              <View style={styles.quickRepliesContainer}>
                <Text style={styles.sectionTitle}>Quick Start</Text>
                <View style={styles.quickRepliesGrid}>
                  {quickReplies.map((reply) => (
                    <TouchableOpacity
                      key={reply.text}
                      style={[styles.quickReplyCard, { backgroundColor: `${reply.color}15` }]}
                      onPress={() => handleQuickReply(reply.text)}
                    >
                      <FontAwesome name={reply.icon as any} size={16} color={reply.color} />
                      <Text style={[styles.quickReplyText, { color: reply.color }]}>{reply.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Messages */}
              <View style={styles.messagesContainer}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[styles.messageWrapper, message.sender === 'user' ? styles.userWrapper : styles.aiWrapper]}
                  >
                    <View
                      style={[styles.messageBubble, message.sender === 'user' ? styles.userBubble : styles.aiBubble]}
                    >
                      {message.sender === 'ai' ? (
                        <Markdown style={chatMarkdownStyles}>{message.text}</Markdown>
                      ) : (
                        <Text style={[styles.messageText, styles.userMessageText]}>
                          {message.text}
                        </Text>
                      )}
                      <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
                      {message.sender === 'ai' && (
                        <AnalysisActionButtons
                          message={message.text}
                          onEmotionAnalysis={handleEmotionAnalysis}
                          onSkinAnalysis={handleSkinAnalysis}
                        />
                      )}
                    </View>
                  </View>
                ))}
                {showLoadingCloud && (
                  <View style={[styles.messageWrapper, styles.aiWrapper]}>
                    <View style={[styles.messageBubble, styles.aiBubble]}>
                      <MessageLoadingDots isVisible={showLoadingCloud} />
                    </View>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Month header + navigation */}
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={styles.monthNavBtn}>
                  <Text style={styles.monthNavTxt}>{'<'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={styles.monthTitleWrap}>
                  <Text style={styles.monthTitle}>{currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} style={styles.monthNavBtn}>
                  <Text style={styles.monthNavTxt}>{'>'}</Text>
                </TouchableOpacity>
              </View>

              {/* Month day strip */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthStrip} contentContainerStyle={styles.monthStripContent}>
                {monthDays.map((iso) => {
                  const mood = monthMoodMap[iso];
                  const rest = monthRestMap[iso];
                  const color = mood ? (mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981') : (rest ? (rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399') : '#e2e8f0');
                  const active = iso === selectedDayKey;
                  const dayNum = parseInt(iso.slice(8,10), 10);
                  return (
                    <TouchableOpacity key={iso} onPress={() => setSelectedDayKey(iso)} style={[styles.dayPill, active && { borderColor: '#6366f1', backgroundColor: '#eef2ff' }]}> 
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                      <Text style={[styles.dayText, active && { color: '#3730a3', fontWeight: '800' }]}>{dayNum}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Month Picker Modal (calendar view) */}
              <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
                <View style={styles.modalBackdrop}>
                  <View style={styles.monthPickerCard}>
                    {/* Modal header with month navigation */}
                    <View style={styles.monthHeaderModal}>
                      <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavTxt}>{'<'}</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>{currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</Text>
                      <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavTxt}>{'>'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Year selector */}
                    <View style={styles.yearRow}>
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const baseYear = new Date().getFullYear();
                        const year = baseYear - 2 + idx;
                        const active = year === currentMonth.getFullYear();
                        return (
                          <TouchableOpacity key={year} style={[styles.yearBtn, active && styles.yearBtnActive]}
                            onPress={() => setCurrentMonth(new Date(year, currentMonth.getMonth(), 1))}
                          >
                            <Text style={[styles.yearTxt, active && styles.yearTxtActive]}>{year}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Weekday headers */}
                    <View style={styles.weekHeaderRow}>
                      {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((wd) => (
                        <Text key={wd} style={styles.weekHeaderTxt}>{wd}</Text>
                      ))}
                    </View>

                    {/* Calendar grid */}
                    <View style={styles.calendarGrid}>
                      {(() => {
                        const y = currentMonth.getFullYear();
                        const m = currentMonth.getMonth();
                        const first = new Date(y, m, 1);
                        const daysInMonth = new Date(y, m + 1, 0).getDate();
                        // JS getDay(): 0=Sun..6=Sat, convert to 0=Mon..6=Sun
                        const jsFirst = first.getDay();
                        const startOffset = (jsFirst + 6) % 7; // how many blanks before day 1
                        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
                        const cells = [] as React.ReactNode[];
                        for (let i=0;i<totalCells;i++){
                          const dayNum = i - startOffset + 1;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            cells.push(<View key={`e-${i}`} style={styles.calCellEmpty} />);
                          } else {
                            const iso = new Date(y, m, dayNum).toISOString().slice(0,10);
                            const mood = monthMoodMap[iso];
                            const rest = monthRestMap[iso];
                            const color = mood ? (mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981') : (rest ? (rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399') : '#e2e8f0');
                            const active = iso === selectedDayKey;
                            cells.push(
                              <TouchableOpacity key={`d-${i}`} style={[styles.calCell, active && { borderColor:'#6366f1', backgroundColor:'#eef2ff' }]} onPress={() => { setSelectedDayKey(iso); setShowMonthPicker(false); }}>
                                <Text style={[styles.calDayTxt, active && { color:'#3730a3', fontWeight:'800' }]}>{dayNum}</Text>
                                <View style={[styles.calDot, { backgroundColor: color }]} />
                              </TouchableOpacity>
                            );
                          }
                        }
                        return cells;
                      })()}
                    </View>

                    <TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseTxt}>Chiudi</Text></TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* Journal Prompt */}
              {journalPrompt ? (
                <LinearGradient
                  colors={["#EEF2FF", "#FFFFFF"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.journalPromptGrad}
                >
                  <View style={styles.journalPromptHeader}>
                    <Text style={styles.journalPromptTitle}>Prompt del giorno</Text>
                    <TouchableOpacity style={styles.pillSecondary} onPress={() => setJournalPrompt(journalPrompt)}>
                      <Text style={styles.pillSecondaryText}>Rigenera</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.journalPromptText}>{journalPrompt}</Text>
                </LinearGradient>
              ) : null}

              {/* Journal Editor */}
              <View style={styles.journalEditorWrap}>
                <BlurView intensity={12} tint="light" style={styles.journalBlur} />
                <View style={styles.journalEditorHeader}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={styles.editorTitle}>Entry di oggi</Text>
                    <View style={styles.dateChip}><Text style={styles.dateChipText}>{dayKey}</Text></View>
                  </View>
                  <Text style={styles.counterText}>{journalText.length}/2000</Text>
                </View>
                <TextInput
                  style={styles.journalInput}
                  multiline
                  placeholder="Scrivi il tuo diario di oggi…"
                  placeholderTextColor="#94a3b8"
                  value={journalText}
                  onChangeText={setJournalText}
                />
                <View style={styles.journalActions}>
                  <TouchableOpacity style={styles.journalMic} onPress={() => setShowVoiceInterface(true)}>
                    <FontAwesome name="microphone" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.journalSave}
                    onPress={async () => {
                      if (!currentUser) return;
                      await DailyJournalService.saveLocalEntry(dayKey, journalText, journalPrompt);
                      
                      try {
                        // Check if we need to generate AI judgment (only if content changed and no existing score)
                        let aiScore = null, aiLabel = null, aiSummary = null, aiAnalysis = null;
                        
                        // Check if we already have AI judgment for this entry
                        const hasExistingAI = aiScore || aiSummary;
                        
                        if (journalText.trim().length > 10 && !hasExistingAI) {
                          console.log('🤖 Generating AI judgment for entry...');
                          // Get mood and sleep notes for context
                          const moodNote = await AsyncStorage.getItem(`checkin:mood_note:${dayKey}`);
                          const sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${dayKey}`);
                          console.log('📝 Context notes:', { moodNote, sleepNote });
                          
                          const aiJudgment = await DailyJournalService.generateAIJudgment(
                            currentUser.id, 
                            journalText, 
                            moodNote || undefined, 
                            sleepNote || undefined
                          );
                          
                          console.log('🤖 AI Judgment result:', aiJudgment);
                          
                          if (aiJudgment) {
                            aiScore = aiJudgment.ai_score;
                            aiLabel = aiJudgment.ai_label;
                            aiSummary = aiJudgment.ai_summary;
                            aiAnalysis = aiJudgment.ai_analysis;
                            
                            console.log('✅ AI Judgment processed:', { aiScore, aiLabel, aiSummary, aiAnalysis });
                            
                            // Update local state
                            setAiScore(aiScore);
                            setAiLabel(aiLabel);
                            setAiSummary(aiSummary);
                            setAiAnalysis(aiAnalysis);
                          } else {
                            console.log('❌ AI Judgment failed or returned null');
                          }
                        } else {
                          console.log('⏭️ Skipping AI judgment:', { 
                            hasContent: journalText.trim().length > 10, 
                            hasExistingScore: !!aiScore 
                          });
                        }

                        await DailyJournalService.syncToRemote(currentUser.id, dayKey, journalText, journalPrompt, aiSummary, aiScore, aiLabel, aiAnalysis);
                        const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
                        setJournalHistory(recent);
                        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setLastSavedAt(ts);
                        setShowSavedChip(true);
                        setTimeout(() => setShowSavedChip(false), 2000);
                        Alert.alert('Salvato', 'Journal salvato e analizzato correttamente');
                      } catch (e) {
                        Alert.alert('Offline', 'Journal salvato in locale, verrà sincronizzato');
                      }
                    }}
                  >
                    <Text style={styles.journalSaveText}>Salva</Text>
                  </TouchableOpacity>
                </View>
                {showSavedChip && lastSavedAt && (
                  <View style={styles.savedChip}><Text style={styles.savedChipText}>Salvato alle {lastSavedAt}</Text></View>
                )}
              </View>

              {/* AI Journal Insight */}
              {(() => {
                console.log('🎯 AI Judgment Box render check (Journal):', { aiSummary, aiScore, aiLabel, aiAnalysis });
                return (aiSummary || aiScore);
              })() && (
                <View style={styles.aiInsightCard}>
                  <View style={styles.aiInsightHeader}>
                    <View style={styles.aiInsightTitleRow}>
                      <View style={styles.aiInsightIcon}>
                        <Text style={styles.aiInsightIconText}>🤖</Text>
                      </View>
                      <Text style={styles.aiInsightTitle}>AI Journal Insight</Text>
                    </View>
                    {typeof aiScore === 'number' && (
                      <View style={[styles.aiInsightScore, { backgroundColor: DailyJournalService.colorForScore(aiScore) }]}>
                        <Text style={styles.aiInsightScoreText}>{aiScore}/5</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.aiInsightContent}>
                    <View style={styles.aiInsightLabelRow}>
                      <View style={[styles.aiInsightDot, { backgroundColor: DailyJournalService.colorForScore(aiScore ?? undefined) }]} />
                      <Text style={styles.aiInsightLabel}>{aiLabel || 'Analisi AI'}</Text>
                    </View>
                    
                    {!!aiSummary && (
                      <Text style={styles.aiInsightSummary}>{aiSummary}</Text>
                    )}
                    
                    {!!aiAnalysis && (
                      <TouchableOpacity onPress={() => setShowFullAnalysis(true)} style={styles.aiInsightButton}>
                        <Text style={styles.aiInsightButtonText}>Vedi analisi completa</Text>
                        <Text style={styles.aiInsightButtonIcon}>→</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Journal History */}
              {journalHistory?.length ? (
                <View style={styles.journalHistory}>
                  <Text style={styles.sectionTitle}>Ultime note</Text>
                  {journalHistory.map((it) => (
                    <View key={it.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View style={styles.dateChipSm}><Text style={styles.dateChipSmText}>{it.entry_date}</Text></View>
                        <TouchableOpacity><Text style={styles.openTxt}>Apri</Text></TouchableOpacity>
                      </View>
                      <View style={styles.historyPreviewBox}>
                        <Markdown style={chatMarkdownStyles}>{it.content}</Markdown>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Full Analysis Modal */}
        <Modal visible={showFullAnalysis} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontSize: 18 }]}>Analisi Completa</Text>
                <TouchableOpacity onPress={() => setShowFullAnalysis(false)} style={styles.modalClose}>
                  <FontAwesome name="times" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {!!aiAnalysis && (
                  <Text style={styles.modalText}>{aiAnalysis}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Input Area (Chat only) */}
        {mode === 'chat' && (
        <View 
          ref={inputContainerRef}
          style={[
            styles.inputContainer,
            // 🔧 FIX: Posizionamento fisso APPENA sopra la tastiera
            keyboardVisible && {
              position: 'absolute',
              bottom: keyboardHeight - 400,
              left: 0,
              right: 0,
              marginBottom: 0,
            },
            // 🔧 FIX: Reset completo quando tastiera chiusa
            !keyboardVisible && {
              position: 'relative',
              bottom: 'auto',
              left: 'auto',
              right: 'auto',
              marginBottom: 0,
            }
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInput, isVoiceMode && styles.voiceInput]}
              placeholder={isVoiceMode ? "Voice input detected..." : "Type your message..."}
              placeholderTextColor="#94a3b8"
              value={inputValue}
              onChangeText={setInputValue}
              multiline
              maxLength={500}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
            <TouchableOpacity
              style={[styles.micButton, !inputValue.trim() && styles.micButtonActive]}
              onPress={() => setShowVoiceInterface(true)}
            >
              <FontAwesome name="microphone" size={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, !inputValue.trim() && styles.sendButtonDisabled]}
              disabled={!inputValue.trim() || isSending}
              onPress={handleSendMessage}
            >
              <FontAwesome name="send" size={16} color={inputValue.trim() ? '#ffffff' : '#cbd5f5'} />
            </TouchableOpacity>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>

      {/* Wellness Suggestion Popup */}
      <WellnessSuggestionPopup
        visible={showWellnessPopup}
        suggestion={wellnessSuggestion?.suggestion}
        onAddToToday={handleAddToToday}
        onDismiss={handleDismissPopup}
        onStartExercise={handleStartExercise}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: '#eef2f7',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#0f172a',
  },
  fastChatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  fastChatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginRight: 12,
  },
  pillSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  pillSecondaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730a3',
  },
  voiceInterface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceGradient: {
    width: width * 0.9,
    maxHeight: height * 0.6,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  voiceContent: {
    alignItems: 'center',
  },
  closeVoiceButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  voiceAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#ffffff',
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
  voiceTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  voiceSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 40,
    textAlign: 'center',
  },
  voiceMicButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  voiceMicListening: {
    backgroundColor: '#ef4444',
  },
  voiceMicSpeaking: {
    backgroundColor: '#10b981',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  quickRepliesContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  quickRepliesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickReplyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    minWidth: (width - 60) / 2,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  monthStrip: { marginTop: 8, marginHorizontal: 12 },
  monthStripContent: { paddingHorizontal: 8, gap: 8 },
  dayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  dayText: { fontSize: 12, color: '#334155', fontWeight: '700' },
  monthHeader: { marginTop: 8, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthHeaderModal: { marginHorizontal: 0, marginTop: 0, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  monthNavTxt: { fontSize: 14, fontWeight: '800', color: '#334155' },
  monthTitleWrap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  monthTitle: { fontSize: 14, fontWeight: '800', color: '#3730a3', textTransform: 'capitalize' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  monthPickerCard: { width: '86%', borderRadius: 16, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 0, textTransform: 'capitalize' },
  yearRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  yearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  yearBtnActive: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  yearTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
  yearTxtActive: { color: '#3730a3' },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 6, paddingHorizontal: 6 },
  weekHeaderTxt: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#64748b' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 6 },
  calCell: { width: `${100/7}%`, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff' },
  calCellEmpty: { width: `${100/7}%`, height: 52, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  calDayTxt: { fontSize: 13, color: '#0f172a', marginBottom: 8 },
  calDot: { width: 10, height: 10, borderRadius: 5 },
  modalCloseBtn: { alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e0e7ff' },
  modalCloseTxt: { fontSize: 13, fontWeight: '800', color: '#3730a3' },
  journalPromptBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  journalPromptGrad: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  journalPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  journalPromptTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730a3',
    marginBottom: 6,
  },
  journalPromptText: {
    fontSize: 13,
    color: '#1f2937',
  },
  journalEditorWrap: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    padding: 12,
  },
  journalBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  journalEditorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  editorTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  dateChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#e5e7eb' },
  dateChipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  counterText: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  // toolbar removed
  journalInput: {
    minHeight: 120,
    fontSize: 14,
    color: '#0f172a',
  },
  journalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journalMic: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#6366f1',
    borderRadius: 12,
  },
  journalSave: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#10b981',
    borderRadius: 12,
  },
  journalSaveText: {
    color: '#fff',
    fontWeight: '800',
  },
  // AI Insight Card - New Design
  aiInsightCard: { 
    marginTop: 16, 
    marginHorizontal: 20, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  aiInsightHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  aiInsightTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
  },
  aiInsightIcon: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#f0f9ff', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  aiInsightIconText: { 
    fontSize: 14,
  },
  aiInsightTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  aiInsightScore: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  aiInsightScoreText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#fff',
  },
  aiInsightContent: { 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    paddingTop: 12,
  },
  aiInsightLabelRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 12,
  },
  aiInsightDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
  },
  aiInsightLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#374151',
  },
  aiInsightSummary: { 
    fontSize: 14, 
    color: '#4b5563', 
    lineHeight: 20,
    marginBottom: 16,
  },
  aiInsightButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  aiInsightButtonText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#3b82f6',
  },
  aiInsightButtonIcon: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#3b82f6',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '80%', width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalClose: { padding: 4 },
  modalBody: { padding: 16 },
  modalText: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  savedChip: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ecfeff', borderRadius: 12, borderWidth: 1, borderColor: '#cffafe' },
  savedChipText: { fontSize: 11, fontWeight: '800', color: '#0e7490' },
  journalHistory: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  historyCard: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dateChipSm: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f1f5f9' },
  dateChipSmText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  openTxt: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  historyPreviewBox: { maxHeight: 60, overflow: 'hidden' },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  historyPreview: {
    fontSize: 14,
    color: '#0f172a',
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  messageWrapper: {
    gap: 8,
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  aiWrapper: {
    alignItems: 'flex-start',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontSize: 11,
    color: '#4338ca',
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: width * 0.8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userBubble: {
    backgroundColor: '#6366f1',
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#ffffff',
  },
  aiMessageText: {
    color: '#0f172a',
  },
  timestamp: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.4)',
    textAlign: 'right',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    // 🔧 FIX: Supporto per posizionamento assoluto
    position: 'relative',
    zIndex: 1000,
    // 🔧 FIX: Ombra per separazione visiva
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: 8,
  },
  voiceInput: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#4338ca',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  micButtonActive: {
    backgroundColor: '#ef4444',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#4338ca',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e7ff',
    shadowOpacity: 0,
    elevation: 0,
  },
  // Wellness Banner Styles
  wellnessBanner: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wellnessBannerGradient: {
    padding: 16,
  },
  wellnessBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wellnessBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  wellnessBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  wellnessBannerDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  wellnessBannerButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  wellnessBannerCloseButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});

// Stili per il markdown nella chat
const chatMarkdownStyles = {
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0f172a',
  },
  heading1: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 15,
    fontWeight: '700' as any,
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 3,
  },
  strong: {
    fontWeight: '700' as any,
    color: '#0f172a',
  },
  em: {
    fontStyle: 'italic' as any,
    color: '#475569',
  },
  list_item: {
    marginBottom: 3,
  },
  bullet_list: {
    marginBottom: 6,
  },
  ordered_list: {
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
  },
  code_inline: {
    backgroundColor: '#f1f5f9',
    color: '#e11d48',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 13,
  },
  code_block: {
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
    fontSize: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
};

export default ChatScreen;