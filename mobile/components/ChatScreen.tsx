import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  AppState,
  Alert,
  Switch,
  useColorScheme,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvoidSoftInput, AvoidSoftInputView } from 'react-native-avoid-softinput';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';

import { BACKEND_URL, getBackendURL } from '../constants/env';

import { UnifiedTTSService } from '../services/unified-tts.service';
import LoadingCloud from './LoadingCloud';
import AnimatedOrbVoiceChat from './AnimatedOrbVoiceChat';
import { ModernVoiceChat } from './ModernVoiceChat';
import MessageLoadingDots from './MessageLoadingDots';
import { DailyJournalService } from '../services/daily-journal.service';
import { DailyJournalDBService } from '../services/daily-journal-db.service';
import { AnalysisActionButtons } from './AnalysisActionButtons';
// Database Services
import { ChatService, WellnessSuggestionService } from '../services/chat-wellness.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { AnalysisIntentService } from '../services/analysis-intent.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';
import { ChatSettingsService, ChatTone, ResponseLength } from '../services/chat-settings.service';
import { JournalSettingsService, JournalTemplate } from '../services/journal-settings.service';
import { ExportService } from '../services/export.service';

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
  const { t, language } = useTranslation(); // 🆕 i18n hook
  const { colors, mode: themeMode } = useTheme();
  const router = useRouter();
  const { voiceMode } = useLocalSearchParams(); // 🆕 Rimossa t da qui (era in conflitto)
  const insets = useSafeAreaInsets();
  const surfaceSecondary = (colors as any).surfaceSecondary ?? colors.surface;
  
  useEffect(() => {
    AvoidSoftInput.setEnabled(true);
    AvoidSoftInput.setShouldMimicIOSBehavior(true);
    return () => {
      AvoidSoftInput.setEnabled(false);
    };
  }, []);
  
  // 🆕 Rimossi log per performance
  useEffect(() => {
    if (voiceMode === 'true') {
      setShowVoiceInterface(true);
      voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [voiceMode]);
  
  const [mode, setMode] = useState<'chat' | 'journal'>('chat');
  // 🔥 FIX: Inizializziamo messages con un messaggio di default, poi lo aggiorniamo nel useEffect
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: t('chat.welcomeMessage.default'), // 🔥 FIX: Usa messaggio di default inizialmente
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
  const [monthJournalMap, setMonthJournalMap] = useState<Record<string, { hasEntry: boolean; aiScore?: number }>>({}); // 🆕 Map per journal entries dal DB
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthStripScrollRef = useRef<ScrollView>(null); // 🆕 Ref per scroll automatico
  const [showChatMenu, setShowChatMenu] = useState(false); // 🆕 Menu contestuale chat/journal
  const [showChatSettings, setShowChatSettings] = useState(false); // 🆕 Modal impostazioni chat
  const [showJournalSettings, setShowJournalSettings] = useState(false); // 🆕 Modal impostazioni journal
  const [chatSettings, setChatSettings] = useState({ tone: 'empathetic' as ChatTone, responseLength: 'standard' as ResponseLength, includeActionSteps: true, localHistoryEnabled: true }); // 🆕 Preferenze chat
  const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate>('free'); // 🆕 Template journal selezionato

  // 🔧 FIX: Messaggio iniziale personalizzato con traduzione
  // 🔥 FIX: Memoizziamo getInitialMessage per evitare ricreazioni
  const getInitialMessage = useCallback(() => {
    let userName: string | undefined;
    if (currentUserProfile?.first_name) {
      userName = currentUserProfile.first_name;
    } else if (user?.user_metadata?.full_name) {
      userName = user.user_metadata.full_name.split(' ')[0];
    } else if (user?.email) {
      userName = user.email.split('@')[0].split('.')[0];
    }
    
    if (userName) {
      return t('chat.welcomeMessage.withName', { name: userName });
    }
    return t('chat.welcomeMessage.default');
  }, [currentUserProfile, user, t]);

  // Persist and restore mode
  useEffect(() => {
    (async () => {
      const savedMode = await AsyncStorage.getItem('chat:mode');
      if (savedMode === 'journal' || savedMode === 'chat') setMode(savedMode as any);
    })();
  }, []);
  useEffect(() => { AsyncStorage.setItem('chat:mode', mode); }, [mode]);

  // 🆕 Carica preferenze chat e journal all'avvio
  useEffect(() => {
    (async () => {
      const settings = await ChatSettingsService.getSettings();
      setChatSettings(settings);
      const template = await JournalSettingsService.getTemplate();
      setSelectedTemplate(template);
    })();
  }, []);

  // Load journal local + remote, build prompt
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      const local = await DailyJournalService.getLocalEntry(selectedDayKey);
      setJournalText(local.content);
      setJournalPrompt(local.aiPrompt);
      // Build prompt from template or mood/sleep notes if empty
      if (!local.aiPrompt) {
        const currentTemplate = await JournalSettingsService.getTemplate();
        const templatePrompt = await JournalSettingsService.getTemplatePrompt();
        const moodNote = await AsyncStorage.getItem(`checkin:mood_note:${selectedDayKey}`);
        const sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${selectedDayKey}`);
        
        // Se c'è un template diverso da 'free', usa il prompt del template
        // Altrimenti usa il prompt tradizionale basato su mood/sleep
        const prompt = currentTemplate !== 'free' 
          ? templatePrompt
          : DailyJournalService.buildAIPrompt({ moodNote: moodNote || undefined, sleepNote: sleepNote || undefined });
        setJournalPrompt(prompt);
        await DailyJournalService.saveLocalEntry(selectedDayKey, local.content, prompt);
      } else {
        // Se c'è già un prompt ma il template è cambiato, aggiorna se non c'è contenuto
        const currentTemplate = await JournalSettingsService.getTemplate();
        if (currentTemplate !== 'free' && !local.content.trim()) {
          const templatePrompt = await JournalSettingsService.getTemplatePrompt();
          setJournalPrompt(templatePrompt);
        }
      }
      // Recent history
      try {
        const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
        setJournalHistory(recent);
      } catch (e) {
        // 🆕 Rimosso log per performance
      }
      // Try to fetch AI fields for selected day
      try {
        const existing = await DailyJournalDBService.getEntryByDate(currentUser.id, selectedDayKey);
        // 🆕 Rimossi log per performance
        setAiSummary(existing?.ai_summary ?? null);
        setAiScore((existing as any)?.ai_score ?? null);
        setAiLabel((existing as any)?.ai_label ?? null);
        setAiAnalysis((existing as any)?.ai_analysis ?? null);
      } catch (e) {
        // 🆕 Rimosso log per performance
      }
    })();
  }, [currentUser, selectedDayKey]);

  // 🆕 Scroll automatico al giorno selezionato nella barra orizzontale
  useEffect(() => {
    if (monthStripScrollRef.current && selectedDayKey && monthDays.includes(selectedDayKey)) {
      const index = monthDays.indexOf(selectedDayKey);
      // Delay per permettere al layout di completarsi
      // 🔥 FIX: Memory leak - aggiungiamo cleanup per setTimeout
      const timer = setTimeout(() => {
        monthStripScrollRef.current?.scrollTo({ 
          x: Math.max(0, index * 60 - width / 4), // Scroll per centrare approssimativamente
          animated: true 
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedDayKey, monthDays]);

  // 🆕 Helper per creare ISO date senza problemi di timezone
  const toISODateSafe = (year: number, month: number, day: number): string => {
    // Crea la stringa ISO direttamente senza conversioni timezone
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Build month days and color maps
  useEffect(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const days: string[] = [];
    for (let d = first.getDate(); d <= last.getDate(); d++) {
      // 🆕 Usa helper per evitare problemi timezone
      const iso = toISODateSafe(y, m, d);
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
      
      // 🆕 Carica journal entries dal DB per il mese corrente
      if (currentUser?.id) {
        try {
          const firstDay = days[0];
          const lastDay = days[days.length - 1];
          const journalEntries = await DailyJournalDBService.listByDateRange(currentUser.id, firstDay, lastDay);
          const journalMap: Record<string, { hasEntry: boolean; aiScore?: number }> = {};
          journalEntries.forEach(entry => {
            journalMap[entry.entry_date] = {
              hasEntry: true,
              aiScore: (entry as any).ai_score || undefined
            };
          });
          setMonthJournalMap(journalMap);
          // 🆕 Rimosso log per performance
        } catch (e) {
          console.error('❌ Error loading journal entries:', e);
          setMonthJournalMap({});
        }
      }
    })();
  }, [currentMonth, currentUser]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false);
  const [showLoadingCloud, setShowLoadingCloud] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');

  // 🔧 FIX: Aggiorna currentUser quando user cambia
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare se il componente è montato
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🔥 FIX: Usiamo useRef per tracciare l'ultimo user.id per evitare loop infiniti
  const lastUserIdRef = useRef<string | null>(null);
  const lastProfileIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // 🆕 Rimosso log per performance
    // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
    if (!isMountedRef.current) return;
    
    // 🔥 FIX: Evita setState se user.id non è cambiato
    if (user?.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user?.id || null;
      setCurrentUser(user);
    }
    
    // 🔧 Carica il profilo utente per ottenere first_name e last_name
    if (user?.id) {
      // 🔥 FIX: Evita chiamate duplicate se il profilo è già stato caricato
      if (currentUserProfile?.id === user.id) {
        // Profilo già caricato, non serve fare nulla
        return;
      }
      
      AuthService.getUserProfile(user.id).then(profile => {
        // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
        if (!isMountedRef.current) return;
        
        // 🔥 FIX: Evita setState se il profilo non è cambiato
        if (profile?.id !== lastProfileIdRef.current) {
          lastProfileIdRef.current = profile?.id || null;
          setCurrentUserProfile(profile);
          
          // Aggiorna il messaggio iniziale
          if (user) {
            const personalizedMessage = getInitialMessage();
            if (isMountedRef.current) {
              setMessages(prev => {
                const welcomeMsg = prev.find(msg => msg.id === 'welcome');
                if (welcomeMsg?.text === personalizedMessage) {
                  return prev; // Nessun cambiamento necessario
                }
                return prev.map(msg => 
                  msg.id === 'welcome' 
                    ? { ...msg, text: personalizedMessage }
                    : msg
                );
              });
            }
          }
        }
      }).catch(error => {
        // 🔥 FIX: Solo errori critici in console
        console.error('❌ Error loading user profile:', error);
      });
    } else {
      // 🔥 FIX: Verifica se il componente è ancora montato prima di setState
      if (isMountedRef.current && currentUserProfile !== null) {
        lastProfileIdRef.current = null;
        setCurrentUserProfile(null);
      }
    }
  }, [user?.id]); // 🔥 FIX: Dipendiamo solo da user.id, non da user o getInitialMessage
  const [aiContext, setAiContext] = useState<any>(null);
  const [wellnessSuggestion, setWellnessSuggestion] = useState<any>(null);
  const [showWellnessPopup, setShowWellnessPopup] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

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
      t('chat.suggestionFeedback.title'),
      t('chat.suggestionFeedback.message'),
      [
        { text: t('chat.suggestionFeedback.veryGood'), onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            5,
            t('chat.suggestionFeedback.veryEffective')
          );
        }},
        { text: t('chat.suggestionFeedback.good'), onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            4,
            t('chat.suggestionFeedback.useful')
          );
        }},
        { text: t('chat.suggestionFeedback.soSo'), onPress: async () => {
          await WellnessSuggestionService.learnFromUserInteraction(
            currentUser.id,
            suggestion.id,
            'completed',
            3,
            t('chat.suggestionFeedback.neutral')
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
  const inputContainerRef = useRef<View>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false); // 🔥 FIX: Solo per sapere se tastiera è aperta (per UI state)

  // 🆕 Rimossi log debug per performance

  const tts = useMemo(() => UnifiedTTSService.getInstance(), []);

  // Animation values
  const micScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const voiceInterfaceOpacity = useSharedValue(0);

  const quickReplies = useMemo(() => [
    { text: t('chat.quickStart.feelingStressed'), icon: 'heartbeat', color: '#ef4444' },
    { text: t('chat.quickStart.sleepBetter'), icon: 'moon-o', color: '#8b5cf6' },
    { text: t('chat.quickStart.energyTips'), icon: 'bolt', color: '#f59e0b' },
    { text: t('chat.quickStart.skinAdvice'), icon: 'tint', color: '#3b82f6' },
  ], [t]);

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

  // Initialize database services
  // 🔥 FIX: Memoizziamo initializeDatabaseServices per evitare ricreazioni
  const initializeDatabaseServices = useCallback(async () => {
    try {
      // 🆕 Rimosso log per performance
      
      // Get AI context
      const context = await AIContextService.getCompleteContext(currentUser.id);
      setAiContext(context);
      
      // 🔧 RIMOSSO: Non mostrare banner iniziale automatico
      // Il banner apparirà solo dopo conversazioni contestuali
      // 🆕 Rimosso log per performance
      setWellnessSuggestion(null);
      
      // Create or get current chat session
      // 🔥 FIX: Usa la lingua dell'utente per il formato data
      const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
      const sessionDate = new Date().toLocaleDateString(dateLocale);
      const session = await ChatService.createChatSession(
        currentUser.id,
        t('chat.sessionName', { date: sessionDate }),
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
        // 🆕 Rimosso log per performance
      }
      
    } catch (error) {
      console.error('Error initializing database services:', error);
    }
  }, [currentUser]);

  // Initialize TTS and Database
  useEffect(() => {
    const initializeServices = async () => {
      try {
        await tts.initialize();
        // 🆕 Rimosso log per performance
        
        // Initialize database services if user is authenticated
        if (currentUser) {
          await initializeDatabaseServices();
        }
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };
    initializeServices();
  }, [currentUser, tts, initializeDatabaseServices]);

  // Auto-start voice mode when coming from Avatar mic button
  useEffect(() => {
    // 🆕 Rimosso log per performance
    if (voiceMode === 'true') {
      const timer = setTimeout(() => {
        setShowVoiceInterface(true);
        voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [voiceMode]);

  // Also check voiceMode on component mount/focus
  useEffect(() => {
    // 🆕 Rimosso log per performance
    if (voiceMode === 'true' && !showVoiceInterface) {
      const timer = setTimeout(() => {
        setShowVoiceInterface(true);
        voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [voiceMode, showVoiceInterface]);

  // Listen for app state changes to handle navigation
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare i timeout
    const timeoutRefs: ReturnType<typeof setTimeout>[] = [];
    
    const handleAppStateChange = (nextAppState: string) => {
      // 🆕 Rimosso log per performance
      if (nextAppState === 'active' && voiceMode === 'true' && !showVoiceInterface) {
        // 🔥 FIX: Memory leak - salviamo il timeout per cleanup
        const timer = setTimeout(() => {
          setShowVoiceInterface(true);
          voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
        }, 200);
        timeoutRefs.push(timer);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
      // 🔥 FIX: Memory leak - puliamo tutti i timeout
      timeoutRefs.forEach(timer => clearTimeout(timer));
    };
  }, [voiceMode, showVoiceInterface]);

  // Keyboard management via AvoidSoftInput events
  useEffect(() => {
    const showSubscription = AvoidSoftInput.onSoftInputShown(() => setIsKeyboardVisible(true));
    const hideSubscription = AvoidSoftInput.onSoftInputHidden(() => setIsKeyboardVisible(false));
    const offsetSubscription = AvoidSoftInput.onSoftInputAppliedOffsetChange(() => {});

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      offsetSubscription.remove();
    };
  }, []);

  // 🆕 Funzioni per navigazione alle analisi
  const handleEmotionAnalysis = useCallback(() => {
    router.push('/(tabs)/analysis');
  }, [router]);

  const handleSkinAnalysis = useCallback(() => {
    router.push('/(tabs)/skin');
  }, [router]);

  // 🆕 Handle voice messages through the same pipeline as text
  const handleVoiceMessage = useCallback(async (voiceText: string) => {
    try {
      // 🆕 Rimossi log per performance
      
      // 🆕 Rileva intent di analisi dal messaggio vocale
      const analysisIntent = AnalysisIntentService.detectAnalysisIntent(voiceText);
      // 🆕 Rimosso log per performance

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

      // 🆕 Rimossi log per performance
      
      // 🔧 AUTO-DISCOVERY: Ottieni URL dinamico del backend
      const dynamicBackendURL = await getBackendURL();
      // 🆕 Rimosso log per performance
      
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
          // 🆕 Invia preferenze chat
          tone: chatSettings.tone,
          responseLength: chatSettings.responseLength,
          includeActionSteps: chatSettings.includeActionSteps,
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
        // 🔥 FIX: Usa la lingua dell'utente invece di 'it-IT' hardcoded
        const ttsLanguage = language === 'it' ? 'it-IT' : 'en-US';
        await tts.speak(reply, {
          rate: 0.5,
          pitch: 1.0,
          language: ttsLanguage,
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
              // 🆕 Rimossi log per performance
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
                // 🆕 Rimossi log per performance
              }
            }
          } else {
            // 🆕 Rimossi log per performance
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
  }, [aiContext, currentUser, currentUserProfile, currentSessionId, messages, setMessages, setIsProcessing, setWellnessSuggestion]);

  // Keyboard management functions (non più necessari con FlatList invertita)
  const handleInputFocus = useCallback(() => {
    // FlatList invertita gestisce automaticamente lo scroll
  }, []);

  const handleInputBlur = useCallback(() => {
    // FlatList invertita gestisce automaticamente lo scroll
  }, []);

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

      // 🔄 Use Traditional Chat System (OpenAI) for all text messages
      // 🆕 Rimossi log per performance
      
      // 🆕 Rileva intent di analisi dal messaggio dell'utente
      const analysisIntent = AnalysisIntentService.detectAnalysisIntent(trimmed);

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

      // 🆕 Rimossi log per performance
      
      // 🔧 AUTO-DISCOVERY: Ottieni URL dinamico del backend
      const dynamicBackendURL = await getBackendURL();
      // 🆕 Rimosso log per performance
      
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
          // 🆕 Invia preferenze chat
          tone: chatSettings.tone,
          responseLength: chatSettings.responseLength,
          includeActionSteps: chatSettings.includeActionSteps,
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
          // 🔥 FIX: Usa la lingua dell'utente invece di 'it-IT' hardcoded
          const ttsLanguage = language === 'it' ? 'it-IT' : 'en-US';
          await tts.speak(reply, {
            rate: 0.5,
            pitch: 1.0,
            language: ttsLanguage,
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
              // 🆕 Rimossi log per performance
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
                // 🆕 Rimossi log per performance
              }
            }
          } else {
            // 🆕 Rimossi log per performance
          }
        } catch (error) {
          console.error('Error getting wellness suggestion:', error);
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

  const handleQuickReply = useCallback((reply: string) => {
    setInputValue(reply);
  }, []);

  // 🆕 Gestione menu contestuale chat/journal
  const handleClearChat = () => {
    Alert.alert(
      t('chat.clearChat.title') || 'Cancella conversazione',
      t('chat.clearChat.message') || 'Vuoi cancellare tutti i messaggi della conversazione?',
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        {
          text: t('common.delete') || 'Cancella',
          style: 'destructive',
          onPress: () => {
            const welcomeMessage = getInitialMessage();
            setMessages([{
              id: 'welcome',
              text: welcomeMessage,
              sender: 'ai',
              timestamp: new Date(Date.now() - 60000),
            }]);
            setShowChatMenu(false);
            Alert.alert(t('common.success') || 'Successo', t('chat.clearChat.success') || 'Conversazione cancellata');
          },
        },
      ]
    );
  };

  const handleClearJournalEntry = () => {
    Alert.alert(
      t('journal.clearEntry.title') || 'Cancella entry',
      t('journal.clearEntry.message') || `Vuoi cancellare l'entry del ${selectedDayKey}?`,
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        {
          text: t('common.delete') || 'Cancella',
          style: 'destructive',
          onPress: async () => {
            try {
              if (currentUser?.id) {
                await DailyJournalDBService.deleteEntry(currentUser.id, selectedDayKey);
                setJournalText('');
                setJournalPrompt('');
                setAiSummary(null);
                setAiScore(null);
                setAiLabel(null);
                setAiAnalysis(null);
                await DailyJournalService.saveLocalEntry(selectedDayKey, '', '');
                setMonthJournalMap(prev => {
                  const updated = { ...prev };
                  delete updated[selectedDayKey];
                  return updated;
                });
                Alert.alert(t('common.success') || 'Successo', t('journal.clearEntry.success') || 'Entry cancellata');
              }
            } catch (error) {
              console.error('Error clearing journal entry:', error);
              Alert.alert(t('common.error') || 'Errore', t('journal.clearEntry.error') || 'Errore durante la cancellazione');
            }
            setShowChatMenu(false);
          },
        },
      ]
    );
  };

  const handleResetAIContext = async () => {
    Alert.alert(
      t('chat.resetContext.title') || 'Reset contesto AI',
      t('chat.resetContext.message') || 'Vuoi resettare il contesto AI? Questo permetterà all\'assistente di iniziare con informazioni aggiornate.',
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        {
          text: t('common.reset') || 'Reset',
          onPress: async () => {
            try {
              if (currentUser?.id) {
                // Ricarica il contesto AI
                const context = await AIContextService.getCompleteContext(currentUser.id);
                setAiContext(context);
                Alert.alert(t('common.success') || 'Successo', t('chat.resetContext.success') || 'Contesto AI resettato');
              }
            } catch (error) {
              console.error('Error resetting AI context:', error);
              Alert.alert(t('common.error') || 'Errore', t('chat.resetContext.error') || 'Errore durante il reset');
            }
            setShowChatMenu(false);
          },
        },
      ]
    );
  };

  // 🆕 Funzioni per esportazione
  const handleExportChat = async (format: 'txt' | 'md') => {
    try {
      if (format === 'txt') {
        await ExportService.exportChatToTXT(messages);
      } else {
        await ExportService.exportChatToMD(messages);
      }
      setShowChatMenu(false);
    } catch (error) {
      console.error('Error exporting chat:', error);
    }
  };

  const handleExportJournal = async (format: 'txt' | 'md') => {
    try {
      const entry = {
        date: selectedDayKey,
        content: journalText,
        aiSummary: aiSummary || undefined,
        aiScore: aiScore || undefined,
        aiLabel: aiLabel || undefined,
      };
      if (format === 'txt') {
        await ExportService.exportJournalToTXT(entry);
      } else {
        await ExportService.exportJournalToMD(entry);
      }
      setShowChatMenu(false);
    } catch (error) {
      console.error('Error exporting journal:', error);
    }
  };

  // 🆕 Funzione per cancellare cronologia locale
  const handleClearLocalHistory = () => {
    Alert.alert(
      t('chat.clearHistory.title') || 'Cancella cronologia',
      t('chat.clearHistory.message') || 'Vuoi cancellare tutta la cronologia locale? I messaggi salvati nel database non verranno eliminati.',
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        {
          text: t('common.delete') || 'Cancella',
          style: 'destructive',
          onPress: () => {
            const welcomeMessage = getInitialMessage();
            setMessages([{
              id: 'welcome',
              text: welcomeMessage,
              sender: 'ai',
              timestamp: new Date(Date.now() - 60000),
            }]);
            setShowChatMenu(false);
            Alert.alert(t('common.success') || 'Successo', t('chat.clearHistory.success') || 'Cronologia locale cancellata');
          },
        },
      ]
    );
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
            // 🔥 FIX: Rimuoviamo console.log eccessivi
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
            // 🔥 FIX: Usa traduzione invece di stringa hardcoded
            const errorMessage: Message = {
              id: `${Date.now()}-voice-error`,
              text: t('chat.speechError'),
              sender: 'ai',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          },
          {
            // 🔥 FIX: Usa la lingua dell'utente invece di 'it-IT' hardcoded
            language: language === 'it' ? 'it-IT' : 'en-US',
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

  const dynamicStyles = useMemo(() => ({
    container: {
      backgroundColor: colors.background,
    },
  }), [colors.background]);

  // scrollContentStyle non più necessario per FlatList; il paddingBottom viene messo direttamente in contentContainerStyle della FlatList

  // 🆕 Voice input handler memoizzato
  const handleVoiceInput = useCallback(async (text: string) => {
    // ✅ REAL VOICE INPUT - No more simulation!
    // 🆕 Rimosso log per performance
    
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
  }, [mode, handleVoiceMessage]);

  // 🆕 Wellness activity handler memoizzato
  const handleAddWellnessActivity = useCallback((suggestion: any) => {
    // 🆕 Rimosso log per performance
    // TODO: Implement adding to today's activities
    // This will be implemented later with proper data storage
  }, []);

  // 🔥 FIX: Fallback color per SafeAreaView per evitare flash bianco
  const systemColorScheme = useColorScheme();
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const safeAreaBackground = colors?.background || fallbackBackground;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, dynamicStyles.container, { backgroundColor: safeAreaBackground }]}
    > 
      <AvoidSoftInputView
        style={styles.flex}
        avoidOffset={36}
        showAnimationDelay={0}
        hideAnimationDelay={0}
        showAnimationDuration={100}
        hideAnimationDuration={100}
        easing="easeOut"
      >
        {/* Header */}
        <View
          style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onLayout={({ nativeEvent }) => {
            const { height } = nativeEvent.layout;
            if (Math.abs(height - headerHeight) > 0.5) {
              setHeaderHeight(height);
            }
          }}
        >
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}>
            <FontAwesome name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {/* Segmented toggle: Chat | Journal */}
            <View style={[styles.segmentedWrap, { backgroundColor: surfaceSecondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'chat' && [styles.segmentBtnActive, { backgroundColor: colors.surface }]]}
                onPress={() => setMode('chat')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'chat' }}
              >
                <Text style={[styles.segmentText, { color: colors.textSecondary }, mode === 'chat' && [styles.segmentTextActive, { color: colors.text }]]}>{t('chat.title')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'journal' && [styles.segmentBtnActive, { backgroundColor: colors.surface }]]}
                onPress={() => setMode('journal')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'journal' }}
              >
                <Text style={[styles.segmentText, { color: colors.textSecondary }, mode === 'journal' && [styles.segmentTextActive, { color: colors.text }]]}>{t('journal.title')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
            onPress={() => setShowChatMenu(true)}
          >
            <FontAwesome name="cog" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

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

        {/* Modern Voice Chat in full-screen modal */}
        <ModernVoiceChat
          visible={showVoiceInterface}
          onClose={() => setShowVoiceInterface(false)}
          onVoiceInput={handleVoiceInput}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          transcript={transcript}
          userContext={aiContext ? {
            emotionHistory: aiContext.emotionHistory || [],
            skinHistory: aiContext.skinHistory || [],
            emotionTrend: aiContext.emotionTrend || null,
            skinTrend: aiContext.skinTrend || null,
            insights: aiContext.insights || [],
            temporalPatterns: aiContext.temporalPatterns || null,
            behavioralInsights: aiContext.behavioralInsights || null,
            contextualFactors: aiContext.contextualFactors || null,
          } : undefined}
          aiContext={aiContext}
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          onAddWellnessActivity={handleAddWellnessActivity}
        />

        {/* Chat/Journal Content */}
        <View style={styles.scrollArea}>
          {mode === 'chat' ? (
            <>
              {/* Quick Replies */}
              <View style={styles.quickRepliesContainer}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('chat.quickStart.title')}</Text>
                <View style={styles.quickRepliesGrid}>
                  {quickReplies.map((reply) => (
                    <TouchableOpacity
                      key={reply.text}
                      style={[styles.quickReplyCard, { backgroundColor: themeMode === 'dark' ? `${reply.color}20` : `${reply.color}15` }]}
                      onPress={() => handleQuickReply(reply.text)}
                    >
                      <FontAwesome name={reply.icon as any} size={16} color={reply.color} />
                      <Text style={[styles.quickReplyText, { color: reply.color }]}>{reply.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Messages - FlatList invertita */}
              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                inverted
                contentContainerStyle={[
                  styles.messagesContainer,
                  // lasciamo sempre un "respiro" pari all'altezza dell'input
                  { paddingBottom: inputBarHeight + (isKeyboardVisible ? 0 : insets.bottom) + 20 },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 1, // mantiene la posizione quando si aggiungono nuovi messaggi
                }}
                renderItem={({ item: message }) => (
                  <View
                    style={[
                      styles.messageWrapper,
                      message.sender === 'user' ? styles.userWrapper : styles.aiWrapper,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        message.sender === 'user'
                          ? styles.userBubble
                          : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
                      ]}
                    >
                      {message.sender === 'ai' ? (
                        <Markdown style={chatMarkdownStyles(themeMode, colors)}>{message.text}</Markdown>
                      ) : (
                        <Text style={[styles.messageText, styles.userMessageText]}>
                          {message.text}
                        </Text>
                      )}
                      <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatTime(message.timestamp)}</Text>
                      {message.sender === 'ai' && (
                        <AnalysisActionButtons
                          message={message.text}
                          onEmotionAnalysis={handleEmotionAnalysis}
                          onSkinAnalysis={handleSkinAnalysis}
                        />
                      )}
                    </View>
                  </View>
                )}
                ListFooterComponent={
                  showLoadingCloud ? (
                    <View style={[styles.messageWrapper, styles.aiWrapper]}>
                      <View style={[styles.messageBubble, styles.aiBubble]}>
                        <MessageLoadingDots isVisible={showLoadingCloud} />
                      </View>
                    </View>
                  ) : null
                }
              />
            </>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Month header + navigation */}
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={styles.monthNavBtn}>
                  <Text style={styles.monthNavTxt}>{'<'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={[styles.monthTitleWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>{currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} style={styles.monthNavBtn}>
                  <Text style={styles.monthNavTxt}>{'>'}</Text>
                </TouchableOpacity>
              </View>

              {/* Month day strip */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.monthStrip} 
                contentContainerStyle={styles.monthStripContent}
                ref={monthStripScrollRef} // 🆕 Ref per scroll automatico
              >
                {monthDays.map((iso) => {
                  const mood = monthMoodMap[iso];
                  const rest = monthRestMap[iso];
                  const journal = monthJournalMap[iso]; // 🆕 Journal entry dal DB
                  
                  // 🆕 Priorità: journal entry (ai_score) > mood > rest > grigio
                  let color = '#e2e8f0'; // Default grigio
                  if (journal?.hasEntry && journal.aiScore) {
                    color = DailyJournalService.colorForScore(journal.aiScore);
                  } else if (mood) {
                    color = mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981';
                  } else if (rest) {
                    color = rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399';
                  } else if (journal?.hasEntry) {
                    // 🆕 Giorno con entry ma senza ai_score
                    color = '#6366f1'; // Blu per indicare presenza entry
                  }
                  
                  const active = iso === selectedDayKey;
                  const dayNum = parseInt(iso.slice(8,10), 10);
                  const hasEntry = journal?.hasEntry || false;
                  
                  return (
                    <TouchableOpacity key={iso} onPress={() => setSelectedDayKey(iso)} style={[styles.dayPill, { backgroundColor: colors.surface, borderColor: colors.border }, active && { borderColor: '#6366f1', backgroundColor: '#eef2ff' }]}> 
                      {hasEntry && <View style={[styles.colorDot, { backgroundColor: color }]} />}
                      <Text style={[styles.dayText, { color: colors.text }, active && { color: '#3730a3', fontWeight: '800' }]}>{String(dayNum)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Month Picker Modal (calendar view) */}
              <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
                <View style={styles.modalBackdrop}>
                  <View style={[styles.monthPickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Modal header with month navigation */}
                    <View style={styles.monthHeaderModal}>
                      <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavTxt}>{'<'}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>{currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}</Text>
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
                          <TouchableOpacity 
                            key={year} 
                            style={[
                              styles.yearBtn, 
                              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                              active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary }
                            ]}
                            onPress={() => setCurrentMonth(new Date(year, currentMonth.getMonth(), 1))}
                          >
                            <Text style={[styles.yearTxt, { color: colors.textSecondary }, active && { color: colors.primary }]}>{year}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Weekday headers */}
                    <View style={styles.weekHeaderRow}>
                      {[
                        t('journal.weekdays.mon'),
                        t('journal.weekdays.tue'),
                        t('journal.weekdays.wed'),
                        t('journal.weekdays.thu'),
                        t('journal.weekdays.fri'),
                        t('journal.weekdays.sat'),
                        t('journal.weekdays.sun')
                      ].map((wd) => (
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
                        const cells: React.ReactNode[] = [];
                        for (let i=0;i<totalCells;i++){
                          const dayNum = i - startOffset + 1;
                          if (dayNum < 1 || dayNum > daysInMonth) {
                            cells.push(<View key={`e-${i}`} style={[styles.calCellEmpty, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderLight }]} />);
                          } else {
                            // 🆕 Usa helper per evitare problemi timezone
                            const iso = toISODateSafe(y, m, dayNum);
                            const mood = monthMoodMap[iso];
                            const rest = monthRestMap[iso];
                            const journal = monthJournalMap[iso]; // 🆕 Journal entry dal DB
                            
                            // 🆕 Priorità: journal entry (ai_score) > mood > rest > grigio
                            let color = '#e2e8f0'; // Default grigio
                            if (journal?.hasEntry && journal.aiScore) {
                              color = DailyJournalService.colorForScore(journal.aiScore);
                            } else if (mood) {
                              color = mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981';
                            } else if (rest) {
                              color = rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399';
                            } else if (journal?.hasEntry) {
                              // 🆕 Giorno con entry ma senza ai_score
                              color = '#6366f1'; // Blu per indicare presenza entry
                            }
                            
                            const active = iso === selectedDayKey;
                            const hasEntry = journal?.hasEntry || false; // 🆕 Mostra pallino solo se c'è entry
                            
                            cells.push(
                              <TouchableOpacity 
                                key={`d-${i}`} 
                                style={[
                                  styles.calCell, 
                                  { backgroundColor: colors.surface, borderColor: colors.border }, 
                                  active && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
                                ]} 
                                onPress={() => { 
                                  setSelectedDayKey(iso); 
                                  setShowMonthPicker(false); 
                                }}
                              >
                                <Text style={[styles.calDayTxt, { color: colors.text }, active && { color: colors.primary, fontWeight:'800' }]}>{String(dayNum)}</Text>
                                {hasEntry && <View style={[styles.calDot, { backgroundColor: color }]} />}
                              </TouchableOpacity>
                            );
                          }
                        }
                        return <>{cells}</>;
                      })()}
                    </View>

                    <TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseTxt}>{t('common.close')}</Text></TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* Journal Prompt */}
              {journalPrompt ? (
                <LinearGradient
                  colors={themeMode === 'dark' ? ["rgba(99,102,241,0.2)", "rgba(99,102,241,0.1)"] : ["#EEF2FF", "#FFFFFF"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.journalPromptGrad, { borderColor: colors.border }]}
                >
                  <View style={styles.journalPromptHeader}>
                    <Text style={[styles.journalPromptTitle, { color: colors.text }]}>{t('journal.dailyPrompt')}</Text>
                    <TouchableOpacity style={[styles.pillSecondary, { backgroundColor: surfaceSecondary, borderColor: colors.border }]} onPress={() => setJournalPrompt(journalPrompt)}>
                      <Text style={[styles.pillSecondaryText, { color: colors.primary }]}>{t('journal.regeneratePrompt')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.journalPromptText, { color: colors.text }]}>{journalPrompt}</Text>
                </LinearGradient>
              ) : null}

              {/* Journal Editor */}
              <View style={styles.journalEditorWrap}>
                <BlurView intensity={12} tint="light" style={styles.journalBlur} />
                  <View style={styles.journalEditorHeader}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={[styles.editorTitle, { color: colors.text }]}>{t('journal.entryTitle')}</Text>
                    <View style={[styles.dateChip, { backgroundColor: surfaceSecondary }]}>
                      <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>{selectedDayKey}</Text>
                    </View>
                  </View>
                  <Text style={[styles.counterText, { color: colors.textTertiary }]}>{journalText.length}/2000</Text>
                </View>
                <TextInput
                  style={[styles.journalInput, { color: colors.text }]}
                  multiline
                  placeholder={t('journal.placeholder')}
                  placeholderTextColor={colors.textTertiary}
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
                          // 🆕 Rimossi log per performance
                          // Get mood and sleep notes for context
                          const moodNote = await AsyncStorage.getItem(`checkin:mood_note:${dayKey}`);
                          const sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${dayKey}`);
                          
                          const aiJudgment = await DailyJournalService.generateAIJudgment(
                            currentUser.id, 
                            journalText, 
                            moodNote || undefined, 
                            sleepNote || undefined
                          );
                          
                          if (aiJudgment) {
                            aiScore = aiJudgment.ai_score;
                            aiLabel = aiJudgment.ai_label;
                            aiSummary = aiJudgment.ai_summary;
                            aiAnalysis = aiJudgment.ai_analysis;
                            
                            // Update local state
                            setAiScore(aiScore);
                            setAiLabel(aiLabel);
                            setAiSummary(aiSummary);
                            setAiAnalysis(aiAnalysis);
                          }
                        }

                        await DailyJournalService.syncToRemote(currentUser.id, selectedDayKey, journalText, journalPrompt, aiSummary, aiScore, aiLabel, aiAnalysis); // 🆕 Usa selectedDayKey
                        const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
                        setJournalHistory(recent);
                        
                        // 🆕 Aggiorna monthJournalMap quando si salva una entry
                        setMonthJournalMap(prev => ({
                          ...prev,
                          [selectedDayKey]: {
                            hasEntry: true,
                            aiScore: aiScore || undefined
                          }
                        }));
                        
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
                    <Text style={styles.journalSaveText}>{t('journal.save')}</Text>
                  </TouchableOpacity>
                </View>
                {showSavedChip && lastSavedAt && (
                  <View style={styles.savedChip}><Text style={styles.savedChipText}>{t('journal.savedAt', { time: lastSavedAt })}</Text></View>
                )}
              </View>

              {/* AI Journal Insight */}
              {(() => {
        // 🆕 Rimosso log per performance
        return (aiSummary || aiScore);
              })() && (
                <View style={[styles.aiInsightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.aiInsightHeader}>
                    <View style={styles.aiInsightTitleRow}>
                      <View style={styles.aiInsightIcon}>
                        <Text style={styles.aiInsightIconText}>🤖</Text>
                      </View>
                      <Text style={[styles.aiInsightTitle, { color: colors.text }]}>{t('journal.aiInsight')}</Text>
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
                      <Text style={[styles.aiInsightLabel, { color: colors.text }]}>{aiLabel || t('journal.aiAnalysis')}</Text>
                    </View>
                    
                    {!!aiSummary && (
                      <Text style={[styles.aiInsightSummary, { color: colors.textSecondary }]}>{aiSummary}</Text>
                    )}
                    
                    {!!aiAnalysis && (
                      <TouchableOpacity onPress={() => setShowFullAnalysis(true)} style={styles.aiInsightButton}>
                        <Text style={styles.aiInsightButtonText}>{t('journal.seeFullAnalysis')}</Text>
                        <Text style={styles.aiInsightButtonIcon}>→</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Journal History */}
              {journalHistory?.length ? (
                <View style={styles.journalHistory}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journal.latestNotes')}</Text>
                  {journalHistory.map((it) => (
                    <View key={it.id} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.historyHeader}>
                        <View style={styles.dateChipSm}><Text style={styles.dateChipSmText}>{it.entry_date}</Text></View>
                        <TouchableOpacity><Text style={styles.openTxt}>{t('journal.open')}</Text></TouchableOpacity>
                      </View>
                      <View style={styles.historyPreviewBox}>
                        <Markdown style={chatMarkdownStyles(themeMode, colors)}>{it.content}</Markdown>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>

        {/* Full Analysis Modal */}
        <Modal visible={showFullAnalysis} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontSize: 18, color: colors.text }]}>{t('journal.completeAnalysis')}</Text>
                <TouchableOpacity onPress={() => setShowFullAnalysis(false)} style={styles.modalClose}>
                  <FontAwesome name="times" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                {!!aiAnalysis && (
                  <Text style={[styles.modalText, { color: colors.text }]}>{aiAnalysis}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Input Area (Chat only) - hidden when voice interface is visible */}
        {mode === 'chat' && !showVoiceInterface && (
        <View 
          ref={inputContainerRef}
          onLayout={({ nativeEvent }) => {
            const { height } = nativeEvent.layout;
            if (Math.abs(height - inputBarHeight) > 0.5) {
              setInputBarHeight(height);
            }
          }}
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              // 🔥 FIX: Quando la tastiera è aperta, non aggiungere padding extra (KAV gestisce già lo spazio)
              // Quando la tastiera è chiusa, usa solo insets.bottom per rispettare safe area
              paddingBottom: isKeyboardVisible ? 0 : insets.bottom,
            },
          ]}
        >
          <View style={[styles.inputWrapper, { backgroundColor: surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }, isVoiceMode && styles.voiceInput]}
              placeholder={isVoiceMode ? t('chat.voicePlaceholder') : t('chat.placeholder')}
              placeholderTextColor={colors.textTertiary}
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
              <FontAwesome name="send" size={16} color={inputValue.trim() ? '#ffffff' : (themeMode === 'dark' ? '#94a3b8' : '#cbd5f5')} />
            </TouchableOpacity>
          </View>
        </View>
        )}
      </AvoidSoftInputView>

      {/* Wellness Suggestion Popup */}
      <WellnessSuggestionPopup
        visible={showWellnessPopup}
        suggestion={wellnessSuggestion?.suggestion}
        onAddToToday={handleAddToToday}
        onDismiss={handleDismissPopup}
        onStartExercise={handleStartExercise}
      />

      {/* Chat/Journal Menu Modal */}
      <Modal visible={showChatMenu} transparent animationType="fade" onRequestClose={() => setShowChatMenu(false)}>
        <TouchableOpacity 
          style={styles.menuModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowChatMenu(false)}
        >
          <View style={[styles.menuModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.menuModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.menuModalTitle, { color: colors.text }]}>
                {mode === 'chat' ? 'Opzioni Chat' : 'Opzioni Journal'}
              </Text>
              <TouchableOpacity onPress={() => setShowChatMenu(false)}>
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuOptions}>
              {mode === 'chat' ? (
                <>
                  {/* Comportamento Assistente */}
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setShowChatMenu(false);
                      setShowChatSettings(true);
                    }}
                  >
                    <FontAwesome name="sliders" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Comportamento Assistente
                    </Text>
                    <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  
                  {/* Cronologia & Esportazione */}
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      Alert.alert(
                        'Esporta conversazione',
                        'Scegli il formato:',
                        [
                          { text: 'Annulla', style: 'cancel' },
                          { text: 'TXT', onPress: () => handleExportChat('txt') },
                          { text: 'Markdown', onPress: () => handleExportChat('md') },
                        ]
                      );
                    }}
                  >
                    <FontAwesome name="download" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Esporta conversazione
                    </Text>
                    <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setShowChatMenu(false);
                      handleClearLocalHistory();
                    }}
                  >
                    <FontAwesome name="trash" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Cancella cronologia locale
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setShowChatMenu(false);
                      handleResetAIContext();
                    }}
                  >
                    <FontAwesome name="refresh" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Reset contesto AI
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Template di scrittura */}
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setShowChatMenu(false);
                      setShowJournalSettings(true);
                    }}
                  >
                    <FontAwesome name="file-text" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Template di scrittura
                    </Text>
                    <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  
                  {/* Esporta diario */}
                  <TouchableOpacity
                    style={[styles.menuOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      Alert.alert(
                        'Esporta diario',
                        'Scegli il formato:',
                        [
                          { text: 'Annulla', style: 'cancel' },
                          { text: 'TXT', onPress: () => handleExportJournal('txt') },
                          { text: 'Markdown', onPress: () => handleExportJournal('md') },
                        ]
                      );
                    }}
                  >
                    <FontAwesome name="download" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Esporta diario
                    </Text>
                    <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.menuOption]}
                    onPress={() => {
                      setShowChatMenu(false);
                      handleClearJournalEntry();
                    }}
                  >
                    <FontAwesome name="trash" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      Cancella entry corrente
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Chat Settings Modal */}
      <Modal visible={showChatSettings} transparent animationType="slide" onRequestClose={() => setShowChatSettings(false)}>
        <View style={styles.settingsModalBackdrop}>
          <View style={[styles.settingsModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingsModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.settingsModalTitle, { color: colors.text }]}>Comportamento Assistente</Text>
              <TouchableOpacity onPress={() => setShowChatSettings(false)}>
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsModalBody} showsVerticalScrollIndicator={false}>
              {/* Tono del coach */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Tono del coach</Text>
                <View style={styles.settingsOptions}>
                  {(['empathetic', 'neutral', 'motivational', 'professional'] as ChatTone[]).map((tone) => (
                    <TouchableOpacity
                      key={tone}
                      style={[
                        styles.settingsOption,
                        { borderColor: colors.border },
                        chatSettings.tone === tone && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
                      ]}
                      onPress={async () => {
                        const updated = { ...chatSettings, tone };
                        setChatSettings(updated);
                        await ChatSettingsService.saveSettings(updated);
                      }}
                    >
                      <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.tone === tone && { color: colors.primary, fontWeight: '700' }]}>
                        {tone === 'empathetic' ? 'Empatico' : tone === 'neutral' ? 'Neutro' : tone === 'motivational' ? 'Motivante breve' : 'Professionale'}
                      </Text>
                      {chatSettings.tone === tone && <FontAwesome name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Lunghezza risposta */}
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Lunghezza risposta</Text>
                <View style={styles.settingsOptions}>
                  {(['short', 'standard', 'detailed'] as ResponseLength[]).map((length) => (
                    <TouchableOpacity
                      key={length}
                      style={[
                        styles.settingsOption,
                        { borderColor: colors.border },
                        chatSettings.responseLength === length && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
                      ]}
                      onPress={async () => {
                        const updated = { ...chatSettings, responseLength: length };
                        setChatSettings(updated);
                        await ChatSettingsService.saveSettings(updated);
                      }}
                    >
                      <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.responseLength === length && { color: colors.primary, fontWeight: '700' }]}>
                        {length === 'short' ? 'Breve' : length === 'standard' ? 'Standard' : 'Dettagliata'}
                      </Text>
                      {chatSettings.responseLength === length && <FontAwesome name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Passi d'azione automatici */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsToggleRow}>
                  <View style={styles.settingsToggleLabel}>
                    <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Passi d'azione automatici</Text>
                    <Text style={[styles.settingsSectionSubtitle, { color: colors.textSecondary }]}>
                      Aggiungi "Prossimo passo" alla fine delle risposte
                    </Text>
                  </View>
                  <Switch
                    value={chatSettings.includeActionSteps}
                    onValueChange={async (value) => {
                      const updated = { ...chatSettings, includeActionSteps: value };
                      setChatSettings(updated);
                      await ChatSettingsService.saveSettings(updated);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={chatSettings.includeActionSteps ? '#fff' : colors.textTertiary}
                  />
                </View>
              </View>

              {/* Cronologia locale */}
              <View style={[styles.settingsSection, { borderBottomWidth: 0 }]}>
                <View style={styles.settingsToggleRow}>
                  <View style={styles.settingsToggleLabel}>
                    <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Cronologia locale</Text>
                    <Text style={[styles.settingsSectionSubtitle, { color: colors.textSecondary }]}>
                      Salva i messaggi localmente per visualizzarli offline
                    </Text>
                  </View>
                  <Switch
                    value={chatSettings.localHistoryEnabled}
                    onValueChange={async (value) => {
                      const updated = { ...chatSettings, localHistoryEnabled: value };
                      setChatSettings(updated);
                      await ChatSettingsService.saveSettings(updated);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={chatSettings.localHistoryEnabled ? '#fff' : colors.textTertiary}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Journal Settings Modal */}
      <Modal visible={showJournalSettings} transparent animationType="slide" onRequestClose={() => setShowJournalSettings(false)}>
        <View style={styles.settingsModalBackdrop}>
          <View style={[styles.settingsModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingsModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.settingsModalTitle, { color: colors.text }]}>Template di scrittura</Text>
              <TouchableOpacity onPress={() => setShowJournalSettings(false)}>
                <FontAwesome name="times" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsModalBody} showsVerticalScrollIndicator={false}>
              {JournalSettingsService.getAvailableTemplates().map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateOption,
                    { borderColor: colors.border },
                    selectedTemplate === template.id && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
                  ]}
                  onPress={async () => {
                    setSelectedTemplate(template.id);
                    await JournalSettingsService.saveTemplate(template.id);
                    // Aggiorna il prompt se non c'è contenuto
                    if (!journalText.trim()) {
                      const prompt = template.prompt;
                      setJournalPrompt(prompt);
                      await DailyJournalService.saveLocalEntry(selectedDayKey, journalText, prompt);
                    }
                  }}
                >
                  <View style={styles.templateOptionContent}>
                    <Text style={[styles.templateOptionName, { color: colors.text }, selectedTemplate === template.id && { color: colors.primary, fontWeight: '700' }]}>
                      {template.name}
                    </Text>
                    <Text style={[styles.templateOptionDescription, { color: colors.textSecondary }]}>
                      {template.description}
                    </Text>
                  </View>
                  {selectedTemplate === template.id && <FontAwesome name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente con colors.background
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderBottomWidth: 1,
    // 🔥 FIX: borderBottomColor rimosso - viene applicato dinamicamente
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
  dayText: { fontSize: 12, fontWeight: '700' }, // Colore gestito dinamicamente con colors.text
  monthHeader: { marginTop: 8, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthHeaderModal: { marginHorizontal: 0, marginTop: 0, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  monthNavTxt: { fontSize: 14, fontWeight: '800', color: '#334155' },
  monthTitleWrap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  monthTitle: { fontSize: 14, fontWeight: '800', textTransform: 'capitalize' }, // Colore gestito dinamicamente con colors.text
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  monthPickerCard: { width: '86%', borderRadius: 16, padding: 16, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 0, textTransform: 'capitalize' }, // Colore gestito dinamicamente con colors.text
  yearRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  yearBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  yearBtnActive: { },
  yearTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
  yearTxtActive: { color: '#3730a3' },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 6, paddingHorizontal: 6 },
  weekHeaderTxt: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#64748b' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 6 },
  calCell: { width: `${100/7}%`, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  calCellEmpty: { width: `${100/7}%`, height: 52, borderWidth: 1 },
  calDayTxt: { fontSize: 13, marginBottom: 8 }, // Colore gestito dinamicamente con colors.text
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
    marginBottom: 6,
  },
  journalPromptText: {
    fontSize: 13,
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
  editorTitle: { fontSize: 14, fontWeight: '800' },
  dateChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  dateChipText: { fontSize: 11, fontWeight: '700' },
  counterText: { fontSize: 11, fontWeight: '700' },
  // toolbar removed
  journalInput: {
    minHeight: 120,
    fontSize: 14,
    // color sarà sovrascritto dinamicamente con colors.text
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
  },
  aiInsightSummary: { 
    fontSize: 14,
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
    // backgroundColor e borderColor saranno sovrascritti dinamicamente
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#ffffff',
  },
  aiMessageText: {
    // color sarà sovrascritto dinamicamente con colors.text
  },
  timestamp: {
    marginTop: 6,
    fontSize: 11,
    // color sarà sovrascritto dinamicamente con colors.textTertiary
    textAlign: 'right',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderTopWidth: 1,
    // 🔥 FIX: borderTopColor rimosso - viene applicato dinamicamente
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
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    // 🔥 FIX: borderColor rimosso - viene applicato dinamicamente
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    // color sarà sovrascritto dinamicamente con colors.text
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
  // Chat/Journal Menu Modal Styles
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuModalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  menuModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    // borderBottomColor gestito dinamicamente
  },
  menuModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  menuOptions: {
    paddingVertical: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    // borderBottomColor gestito dinamicamente
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  // Settings Modal Styles
  settingsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsModalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  settingsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  settingsModalBody: {
    padding: 20,
    maxHeight: 500,
  },
  settingsSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    paddingBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  settingsSectionSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  settingsOptions: {
    gap: 10,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsToggleLabel: {
    flex: 1,
    marginRight: 16,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  templateOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  templateOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateOptionDescription: {
    fontSize: 13,
  },
});

// Stili per il markdown nella chat (dinamici basati sul tema)
const chatMarkdownStyles = (mode: 'light' | 'dark', colors: any) => ({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  heading1: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 15,
    fontWeight: '700' as any,
    color: colors.text,
    marginTop: 8,
    marginBottom: 3,
  },
  strong: {
    fontWeight: '700' as any,
    color: colors.text,
  },
  em: {
    fontStyle: 'italic' as any,
    color: colors.textSecondary,
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
    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    color: '#e11d48',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 13,
  },
  code_block: {
    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    color: colors.text,
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
    fontSize: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
});

export default ChatScreen;