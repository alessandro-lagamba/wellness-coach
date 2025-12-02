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
  Platform,
  ActivityIndicator, // Added
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Added
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
// import { AvoidSoftInput, AvoidSoftInputView } from 'react-native-avoid-softinput';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';
import { TimePickerModal } from './TimePickerModal';
import { CopilotProvider, walkthroughable, CopilotStep, useCopilot } from 'react-native-copilot';
import { TutorialTooltip } from './TutorialTooltip';
import { OnboardingService } from '../services/onboarding.service';

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
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { ChatSettingsService, ChatTone, ResponseLength } from '../services/chat-settings.service';
import { JournalSettingsService, JournalTemplate, JOURNAL_TEMPLATES } from '../services/journal-settings.service';
import { ExportService } from '../services/export.service';
import { EmptyStateCard } from './EmptyStateCard';

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

type JournalPromptContext = {
  mood?: number | null;
  moodNote?: string | null;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  sleepNote?: string | null;
  energy?: string | null;
  focus?: string | null;
};

const isLegacyJournalPrompt = (prompt?: string | null) => {
  if (!prompt) return false;
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes('suggerimento per il diario') ||
    normalized.includes('suggestion for the journal') ||
    normalized.includes('rispondi con una domanda') ||
    normalized.includes('answer with a prompt')
  );
};

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

const WalkthroughableView = walkthroughable(View);

export const ChatScreen: React.FC<ChatScreenProps> = ({ user, onLogout }) => {
  return (
    <CopilotProvider
      overlay="view"
      tooltipComponent={TutorialTooltip}
      verticalOffset={Platform.OS === 'ios' ? 40 : 0}
      arrowColor="transparent"
      backdropColor="rgba(0, 0, 0, 0.6)"
      labels={{
        previous: "Indietro",
        next: "Avanti",
        skip: "Salta",
        finish: "Finito"
      }}
    >
      <ChatScreenContent user={user} onLogout={onLogout} />
    </CopilotProvider>
  );
};

const ChatScreenContent: React.FC<ChatScreenProps> = ({ user, onLogout }) => {
  const { start: startCopilot } = useCopilot();
  const { t, language } = useTranslation(); // 🆕 i18n hook
  const { colors, mode: themeMode } = useTheme();
  const { hideTabBar, showTabBar } = useTabBarVisibility();
  const router = useRouter();
  const { voiceMode } = useLocalSearchParams(); // 🆕 Rimossa t da qui (era in conflitto)
  const insets = useSafeAreaInsets();
  const surfaceSecondary = (colors as any).surfaceSecondary ?? colors.surface;

  useFocusEffect(
    useCallback(() => {
      hideTabBar();
      // 🆕 Configurazione minimale: solo setShouldMimicIOSBehavior se necessario
      // AvoidSoftInputView gestisce tutto a livello di view
      // AvoidSoftInput.setShouldMimicIOSBehavior(true);

      return () => {
        showTabBar();
      };
    }, [hideTabBar, showTabBar]),
  );

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
  const [originalJournalText, setOriginalJournalText] = useState(''); // 🆕 Traccia il testo originale per verificare modifiche
  const [journalPrompt, setJournalPrompt] = useState('');
  const [promptContext, setPromptContext] = useState<JournalPromptContext | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [journalHistory, setJournalHistory] = useState<any[]>([]);
  // 🔥 FIX: Usa una funzione per ottenere la data odierna invece di una costante
  const getTodayKey = () => DailyJournalService.todayKey();
  // Database state (must be declared before effects using it)
  const [currentUser, setCurrentUser] = useState<any>(user);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSavedChip, setShowSavedChip] = useState(false);
  // 🔥 FIX: Inizializza sempre con la data odierna corrente
  const [selectedDayKey, setSelectedDayKey] = useState(() => DailyJournalService.todayKey());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [aiScore, setAiScore] = useState<number | null>(null);
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
  const [chatHistory, setChatHistory] = useState<any[]>([]); // 🆕 History delle chat sessions
  const [showChatHistory, setShowChatHistory] = useState(false); // 🆕 Mostra/nascondi history
  const [quickRepliesExpanded, setQuickRepliesExpanded] = useState(false); // 🆕 Quick replies expandible/collapsible
  const messagesListRef = useRef<FlatList>(null); // 🆕 Ref per auto-scroll dei messaggi

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

  // Check for walkthrough on mount
  useEffect(() => {
    const checkWalkthrough = async () => {
      const isCompleted = await OnboardingService.isChatWalkthroughCompleted();
      const onboardingCompleted = await OnboardingService.isOnboardingCompleted();

      if (onboardingCompleted && !isCompleted) {
        // Small delay to ensure layout is ready
        setTimeout(() => {
          startCopilot();
        }, 1000);
      }
    };

    checkWalkthrough();
  }, []);

  // Handle walkthrough completion
  useEffect(() => {
    try {
      // ✅ FIX: Verifica se copilotEvents esiste prima di usarlo
      const copilotModule = require('react-native-copilot');
      const copilotEvents = copilotModule.copilotEvents;
      
      if (copilotEvents && typeof copilotEvents.on === 'function') {
        const listener = copilotEvents.on('stop', async () => {
          await OnboardingService.completeChatWalkthrough();
        });

        return () => {
          if (listener && typeof listener.remove === 'function') {
            listener.remove();
          }
        };
      }
    } catch (error) {
      // ✅ FIX: Se copilotEvents non è disponibile, non bloccare l'app
      console.warn('⚠️ copilotEvents not available, walkthrough completion tracking disabled');
    }
  }, []);

  // Load journal local + remote, build prompt
  useEffect(() => {
    let cancelled = false;
    const loadJournal = async () => {
      if (!currentUser) return;

      const local = await DailyJournalService.getLocalEntry(selectedDayKey);
      const localContent = local.content ?? '';
      const localPrompt = local.aiPrompt ?? '';
      const sanitizedLocalPrompt = isLegacyJournalPrompt(localPrompt) ? '' : localPrompt;
      const hasLocalContent = localContent.trim().length > 0;

      if (!cancelled) {
        setJournalText(localContent);
        setOriginalJournalText(localContent);
        setJournalPrompt(sanitizedLocalPrompt);
      }

      // Recupera note e contesto dal database
      let moodNote: string | null = null;
      let sleepNote: string | null = null;
      let moodScore: number | null = null;
      let sleepHours: number | null = null;
      let sleepQuality: number | null = null;
      let summaryFocus: string | null = null;
      let summaryEnergy: string | null = null;

      try {
        const { supabase } = await import('../lib/supabase');
        const { data: checkinData } = await supabase
          .from('daily_copilot_analyses')
          .select('mood_note, sleep_note, mood, sleep_hours, sleep_quality, summary')
          .eq('user_id', currentUser.id)
          .eq('date', selectedDayKey)
          .maybeSingle();

        if (checkinData) {
          moodNote = checkinData.mood_note || null;
          sleepNote = checkinData.sleep_note || null;
          moodScore = typeof checkinData.mood === 'number' ? checkinData.mood : null;
          sleepHours = typeof checkinData.sleep_hours === 'number' ? checkinData.sleep_hours : null;
          sleepQuality = typeof checkinData.sleep_quality === 'number' ? checkinData.sleep_quality : null;

          const summaryData =
            typeof checkinData.summary === 'string'
              ? (() => {
                try {
                  return JSON.parse(checkinData.summary);
                } catch {
                  return null;
                }
              })()
              : checkinData.summary;
          if (summaryData) {
            summaryFocus = summaryData.focus || null;
            summaryEnergy = summaryData.energy || null;
          }
        }
      } catch (error) {
        moodNote = (await AsyncStorage.getItem(`checkin:mood_note:${selectedDayKey}`)) || null;
        sleepNote = (await AsyncStorage.getItem(`checkin:sleep_note:${selectedDayKey}`)) || null;
      }

      if (!moodNote) {
        moodNote = (await AsyncStorage.getItem(`checkin:mood_note:${selectedDayKey}`)) || null;
      }
      if (!sleepNote) {
        sleepNote = (await AsyncStorage.getItem(`checkin:sleep_note:${selectedDayKey}`)) || null;
      }

      const contextPayload: JournalPromptContext = {
        mood: moodScore,
        moodNote,
        sleepHours,
        sleepQuality,
        sleepNote,
        energy: summaryEnergy,
        focus: summaryFocus,
      };

      if (!cancelled) {
        setPromptContext(contextPayload);
      }

      if (!sanitizedLocalPrompt) {
        const templatePrompt =
          JOURNAL_TEMPLATES[selectedTemplate]?.prompt ?? JOURNAL_TEMPLATES.free.prompt;
        let nextPrompt = templatePrompt;

        if (selectedTemplate === 'free') {
          if (!cancelled) setIsPromptLoading(true);
          try {
            const smartPrompt = await DailyJournalService.generateDailyPrompt({
              userId: currentUser.id,
              language,
              ...contextPayload,
            });
            if (!cancelled && smartPrompt) {
              nextPrompt = smartPrompt;
            }
          } catch (error) {
            console.error('Error generating journal prompt:', error);
          } finally {
            if (!cancelled) setIsPromptLoading(false);
          }
        }

        if (!cancelled) {
          setJournalPrompt(nextPrompt);
        }
        await DailyJournalService.saveLocalEntry(selectedDayKey, localContent, nextPrompt);
      }

      // Recent history
      try {
        const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
        if (!cancelled) {
          setJournalHistory(recent);
        }
      } catch (e) {
        // ignore
      }

      // Try to fetch AI fields for selected day
      let remoteEntry: any = null;
      try {
        remoteEntry = await DailyJournalDBService.getEntryByDate(currentUser.id, selectedDayKey);
        if (!cancelled) {
          setAiScore((remoteEntry as any)?.ai_score ?? null);
          setAiAnalysis((remoteEntry as any)?.ai_analysis ?? null);
        }
      } catch (e) {
        // ignore
      }

      if (remoteEntry) {
        const remoteContent = remoteEntry.content ?? '';
        const remotePromptRaw = remoteEntry.ai_prompt ?? remoteEntry.prompt ?? sanitizedLocalPrompt ?? '';
        const remotePrompt = isLegacyJournalPrompt(remotePromptRaw) ? '' : remotePromptRaw;
        const shouldHydrateFromRemote = remoteContent.trim().length > 0 && !hasLocalContent;

        if (shouldHydrateFromRemote) {
          if (!cancelled) {
            setJournalText(remoteContent);
            setOriginalJournalText(remoteContent);
            setJournalPrompt(remotePrompt || sanitizedLocalPrompt);
          }
          await DailyJournalService.saveLocalEntry(
            selectedDayKey,
            remoteContent,
            remotePrompt || sanitizedLocalPrompt
          );
        }
      }
    };

    loadJournal();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedDayKey, selectedTemplate, language]);

  // 🆕 Helper per verificare se una data è nel futuro
  const isFutureDate = (isoDate: string): boolean => {
    const today = getTodayKey();
    return isoDate > today;
  };

  // 🆕 Helper per verificare se una data è nel passato
  const isPastDate = (isoDate: string): boolean => {
    const today = getTodayKey();
    return isoDate < today;
  };

  // 🔥 FIX: Aggiorna selectedDayKey quando cambia il giorno del sistema (solo se non è un giorno passato selezionato manualmente)
  useEffect(() => {
    const updateToday = () => {
      const today = getTodayKey();
      // 🆕 Aggiorna solo se selectedDayKey è già oggi o è un giorno futuro
      // Non forzare il reset se l'utente ha selezionato manualmente un giorno passato
      const isPast = isPastDate(selectedDayKey);
      if (!isPast && selectedDayKey !== today) {
        setSelectedDayKey(today);
      }
    };

    // Aggiorna immediatamente (solo se non è un giorno passato)
    const today = getTodayKey();
    const isPast = isPastDate(selectedDayKey);
    if (!isPast && selectedDayKey !== today) {
      setSelectedDayKey(today);
    }

    // Aggiorna ogni minuto per catturare il cambio di giorno (solo se non è un giorno passato)
    const interval = setInterval(updateToday, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, [selectedDayKey]);

  // 🆕 Scroll automatico al giorno selezionato nella barra orizzontale
  // 🔥 FIX: Centra sempre la data odierna quando si apre il Journal o quando cambia selectedDayKey
  useEffect(() => {
    if (monthStripScrollRef.current && monthDays.length > 0) {
      const today = getTodayKey();
      // 🔥 FIX: Quando si apre il Journal, usa sempre la data odierna per centrare
      const targetDate = selectedDayKey || today;
      const targetIndex = monthDays.indexOf(targetDate);

      // Se il giorno target è nel mese corrente, centrarlo
      if (targetIndex >= 0) {
        // 🔥 FIX: Aumentato il delay e migliorato il calcolo dello scroll
        // Usa requestAnimationFrame per assicurarsi che il layout sia completato
        const timer = setTimeout(() => {
          if (monthStripScrollRef.current) {
            // 🔥 FIX: Calcolo più preciso dello scroll
            // Ogni pill ha larghezza ~52px + gap 8px = ~60px totale
            // Per centrare: scrollX = (indice * larghezza_totale) - (larghezza_schermo / 2) + (larghezza_totale / 2)
            const pillWidth = 52; // Larghezza del pill (senza gap)
            const gap = 8; // Gap tra i pill
            const totalWidth = pillWidth + gap;
            const offsetRight = 20; // 🆕 Offset per spostare più a destra (in pixel)
            const scrollX = Math.max(0, targetIndex * totalWidth - (width / 2) + (totalWidth / 2) + offsetRight);

            monthStripScrollRef.current.scrollTo({
              x: scrollX,
              animated: true
            });
          }
        }, 500); // 🔥 FIX: Aumentato delay per permettere al layout di completarsi completamente

        return () => clearTimeout(timer);
      }
    }
  }, [monthDays, selectedDayKey]); // 🔥 FIX: Esegui quando cambiano monthDays o selectedDayKey

  const journalScrollRef = useRef<ScrollView>(null);
  const scrollJournalToTop = useCallback(() => {
    requestAnimationFrame(() => {
      journalScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const handleOpenJournal = useCallback(
    (targetDay?: string) => {
      if (targetDay) {
        setSelectedDayKey(targetDay);
        // 🆕 Aggiorna il mese del calendario se l'entry è di un mese diverso
        try {
          const [year, month, day] = targetDay.split('-').map(Number);
          const targetDate = new Date(year, month - 1, day);
          const currentMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
          const targetMonthDate = new Date(year, month - 1, 1);

          // Aggiorna solo se il mese è diverso
          if (currentMonthDate.getTime() !== targetMonthDate.getTime()) {
            setCurrentMonth(targetMonthDate);
          }
        } catch (error) {
          console.error('Error parsing targetDay date:', error);
        }
      } else {
        const todayKey = DailyJournalService.todayKey();
        if (selectedDayKey !== todayKey) {
          setSelectedDayKey(todayKey);
        }
        // 🆕 Se non c'è un targetDay, torna al mese corrente
        const today = new Date();
        const currentMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const todayMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

        if (currentMonthDate.getTime() !== todayMonthDate.getTime()) {
          setCurrentMonth(todayMonthDate);
        }
      }
      setMode('journal');
      scrollJournalToTop();
    },
    [selectedDayKey, scrollJournalToTop, currentMonth],
  );

  const handleRegeneratePrompt = useCallback(async () => {
    if (!currentUser?.id) return;
    const fallbackPrompt =
      JOURNAL_TEMPLATES[selectedTemplate]?.prompt ?? JOURNAL_TEMPLATES.free.prompt;

    if (selectedTemplate !== 'free') {
      setJournalPrompt(fallbackPrompt);
      await DailyJournalService.saveLocalEntry(selectedDayKey, journalText, fallbackPrompt);
      return;
    }

    setIsPromptLoading(true);
    try {
      const smartPrompt = await DailyJournalService.generateDailyPrompt({
        userId: currentUser.id,
        language,
        ...(promptContext || {}),
      });
      const nextPrompt = smartPrompt || fallbackPrompt;
      setJournalPrompt(nextPrompt);
      await DailyJournalService.saveLocalEntry(selectedDayKey, journalText, nextPrompt);
    } catch (error) {
      console.error('Error regenerating journal prompt:', error);
      setJournalPrompt(fallbackPrompt);
    } finally {
      setIsPromptLoading(false);
    }
  }, [currentUser?.id, selectedTemplate, promptContext, selectedDayKey, journalText, language]);

  // 🔥 FIX: Centra il giorno selezionato quando si passa alla modalità Journal (solo se non c'è già una selezione)
  useEffect(() => {
    if (mode === 'journal') {
      // 🆕 Non forzare il reset se l'utente ha già selezionato un giorno specifico
      // Solo centra il giorno selezionato (che potrebbe essere oggi o un giorno passato)

      // 🔥 FIX: Forza anche il centraggio dopo un breve delay per assicurarsi che monthDays sia popolato
      const timer = setTimeout(() => {
        if (monthStripScrollRef.current && monthDays.length > 0 && selectedDayKey) {
          const selectedIndex = monthDays.indexOf(selectedDayKey);
          if (selectedIndex >= 0) {
            const pillWidth = 52; // Larghezza del pill (senza gap)
            const gap = 8; // Gap tra i pill
            const totalWidth = pillWidth + gap;
            const offsetRight = 205; // 🆕 Offset per spostare più a destra (in pixel)
            const scrollX = Math.max(0, selectedIndex * totalWidth - (width / 2) + (totalWidth / 2) - offsetRight);
            monthStripScrollRef.current.scrollTo({
              x: scrollX,
              animated: true
            });
          }
        }
      }, 600); // 🔥 FIX: Delay più lungo per assicurarsi che tutto sia pronto

      return () => clearTimeout(timer);
    }
  }, [mode, monthDays, selectedDayKey]); // 🔥 FIX: Esegui quando si cambia modalità, monthDays o selectedDayKey

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
  const [voiceModeDismissed, setVoiceModeDismissed] = useState(false);

  useEffect(() => {
    if (voiceMode === 'true') {
      setVoiceModeDismissed(false);
    }
  }, [voiceMode]);

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

  // Keyboard Handler for smooth animation
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        keyboardHeight.value = event.height;
      },
    },
    []
  );

  const fakeViewStyle = useAnimatedStyle(() => {
    return {
      height: Math.abs(keyboardHeight.value),
    };
  });

  // Wellness popup handlers
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<any>(null);

  const handleAddToToday = async (suggestion: any) => {
    // 🎓 Learn from user interaction
    await WellnessSuggestionService.learnFromUserInteraction(
      currentUser.id,
      suggestion.id,
      'accepted'
    );

    // Mostra il modal per selezionare l'orario
    setPendingSuggestion(suggestion);
    setShowTimePicker(true);
    setShowWellnessPopup(false);
  };

  const handleTimeSelected = async (selectedTime: Date) => {
    if (!pendingSuggestion || !currentUser?.id) return;

    try {
      const WellnessActivitiesService = (await import('../services/wellness-activities.service')).default;
      const { default: WellnessSyncServiceClass } = await import('../services/wellness-sync.service');
      const WellnessSyncService = WellnessSyncServiceClass.getInstance();

      // Determina la categoria dall'attività
      const categoryMap: Record<string, 'mindfulness' | 'movement' | 'nutrition' | 'recovery'> = {
        'breathing-exercises': 'mindfulness',
        'meditation': 'mindfulness',
        'gentle-stretching': 'movement', // 🆕 Aggiunto mapping per gentle-stretching
        'stretching': 'movement',
        'walk': 'movement',
        'exercise': 'movement',
        'water': 'nutrition',
        'hydration': 'nutrition',
        'sleep': 'recovery',
        'rest': 'recovery',
      };

      // 🆕 Normalizza l'ID per gestire varianti (es. 'gentle-stretching' -> 'stretching')
      const normalizedId = pendingSuggestion.id?.toLowerCase() || '';
      let category = categoryMap[normalizedId];

      // Se non trovato, prova a cercare per parola chiave
      if (!category) {
        if (normalizedId.includes('stretch') || normalizedId.includes('allungamento')) {
          category = 'movement';
        } else if (normalizedId.includes('breath') || normalizedId.includes('meditation') || normalizedId.includes('mindful')) {
          category = 'mindfulness';
        } else if (normalizedId.includes('water') || normalizedId.includes('hydration') || normalizedId.includes('nutrition')) {
          category = 'nutrition';
        } else if (normalizedId.includes('sleep') || normalizedId.includes('rest') || normalizedId.includes('recovery')) {
          category = 'recovery';
        }
      }

      // Fallback: usa category dal suggestion o default
      // 🆕 Assicurati che category sia sempre una stringa valida
      if (!category && pendingSuggestion.category) {
        const suggestionCategory = typeof pendingSuggestion.category === 'string'
          ? pendingSuggestion.category
          : String(pendingSuggestion.category);
        if (['mindfulness', 'movement', 'nutrition', 'recovery'].includes(suggestionCategory)) {
          category = suggestionCategory as 'mindfulness' | 'movement' | 'nutrition' | 'recovery';
        }
      }

      // Fallback finale
      category = category || 'mindfulness';

      // 🆕 Verifica finale che category sia valida (safety check)
      if (!['mindfulness', 'movement', 'nutrition', 'recovery'].includes(category)) {
        console.warn(`Invalid category "${category}", defaulting to "mindfulness"`);
        category = 'mindfulness';
      }

      // Imposta l'orario selezionato dall'utente
      const today = new Date();
      const scheduledTime = new Date(today);
      scheduledTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

      // Se l'orario è già passato oggi, programma per domani
      if (scheduledTime < new Date()) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const endTime = new Date(scheduledTime.getTime() + 30 * 60 * 1000); // 30 minuti

      // Crea l'attività wellness per la notifica
      const wellnessActivity = {
        id: `wellness-${Date.now()}-${pendingSuggestion.id}`,
        title: pendingSuggestion.title,
        description: pendingSuggestion.description || '',
        startTime: scheduledTime,
        endTime: endTime,
        category,
        reminderMinutes: 15, // 15 minuti prima
        syncToCalendar: false,
        syncToReminders: true,
      };

      // Schedula la notifica
      const syncResult = await WellnessSyncService.addWellnessActivity(wellnessActivity);

      // Salva l'attività nel database
      const saveResult = await WellnessActivitiesService.saveActivity({
        title: pendingSuggestion.title,
        description: pendingSuggestion.description || '',
        category,
        scheduledTime,
        reminderId: syncResult.reminderId,
        calendarEventId: syncResult.calendarEventId,
      });

      if (saveResult.success) {
        // Mostra feedback positivo
        Alert.alert(
          t('chat.activityAdded.title') || 'Attività aggiunta',
          t('chat.activityAdded.message', {
            time: selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          }) || `Attività aggiunta per le ${selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}. Riceverai un promemoria 15 minuti prima.`,
          [{ text: t('common.ok') || 'OK' }]
        );
      } else {
        Alert.alert(
          t('common.error') || 'Errore',
          t('chat.activityAdded.error') || 'Errore durante il salvataggio dell\'attività',
          [{ text: t('common.ok') || 'OK' }]
        );
      }

      // 🆕 Rimossa l'alert di feedback immediato - sarà mostrato solo quando l'utente completa l'attività
      setPendingSuggestion(null);
      setWellnessSuggestion(null);
    } catch (error) {
      // 🆕 Gestione errori per evitare rebuild dell'app
      console.error('Error adding wellness activity:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      Alert.alert(
        t('common.error') || 'Errore',
        t('chat.activityAdded.error') || `Errore durante il salvataggio dell'attività: ${errorMessage}`,
        [{ text: t('common.ok') || 'OK' }]
      );
      setPendingSuggestion(null);
      setWellnessSuggestion(null);
    }
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

  // 🆕 Carica chat history quando cambia currentUser o quando si apre la modalità chat
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!currentUser?.id || mode !== 'chat') return;

      try {
        const sessions = await ChatService.getUserChatSessions(currentUser.id, 20);
        setChatHistory(sessions);
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };

    loadChatHistory();
  }, [currentUser?.id, mode]);

  // 🆕 Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesListRef.current && messages.length > 0 && mode === 'chat') {
      setTimeout(() => {
        messagesListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, mode]);

  useEffect(() => {
    if (voiceMode === 'true' && !voiceModeDismissed) {
      setShowVoiceInterface(true);
      voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [voiceMode, voiceModeDismissed, voiceInterfaceOpacity]);

  // Listen for app state changes to handle navigation
  useEffect(() => {
    // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare i timeout
    const timeoutRefs: ReturnType<typeof setTimeout>[] = [];

    const handleAppStateChange = (nextAppState: string) => {
      // 🆕 Rimosso log per performance
      if (nextAppState === 'active' && voiceMode === 'true' && !showVoiceInterface && !voiceModeDismissed) {
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
  }, [voiceMode, showVoiceInterface, voiceModeDismissed, voiceInterfaceOpacity]);

  // 🆕 Rimossi listener manuali della tastiera - AvoidSoftInputView gestisce tutto nativamente

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

      // 🆕 Recupera contesto ciclo mestruale se disponibile
      let cycleContext = '';
      try {
        const { menstrualCycleService } = await import('../services/menstrual-cycle.service');
        cycleContext = await menstrualCycleService.getRecentNotesForAI();
      } catch (error) {
        // Ignora errori - il ciclo è opzionale
      }

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
        // 🆕 Contesto ciclo mestruale
        menstrualCycleContext: cycleContext || undefined,
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
        menstrualCycleContext: undefined,
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

  // Keyboard management functions - scroll automatico quando l'input riceve il focus
  const handleInputFocus = useCallback(() => {
    // Scroll automatico quando l'input riceve il focus (comportamento chat-like)
    setTimeout(() => {
      if (messagesListRef.current && messages.length > 0) {
        messagesListRef.current.scrollToEnd({ animated: true });
      }
    }, Platform.OS === 'ios' ? 300 : 100);
  }, [messages.length]);

  const handleInputBlur = useCallback(() => {
    // Nessuna azione necessaria quando l'input perde il focus
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

      // 🆕 Recupera contesto ciclo mestruale se disponibile
      let cycleContextForChat = '';
      try {
        const { menstrualCycleService } = await import('../services/menstrual-cycle.service');
        cycleContextForChat = await menstrualCycleService.getRecentNotesForAI();
      } catch (error) {
        // Ignora errori - il ciclo è opzionale
      }

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
        // 🆕 Contesto ciclo mestruale
        menstrualCycleContext: cycleContextForChat || undefined,
        // 🔧 Aggiungi nome utente per personalizzazione (usa first_name se disponibile)
        firstName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        lastName: currentUserProfile?.last_name || currentUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || undefined,
        userName: currentUserProfile?.first_name || currentUser?.user_metadata?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0]?.split('.')[0] || 'Utente',
        language: language // 🔥 FIX: Includi la lingua per il backend
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
        menstrualCycleContext: undefined,
        userName: 'Utente',
        isAnonymous: true,
        language: language // 🔥 FIX: Includi la lingua anche per utenti anonimi
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

  const handleClearJournalEntry = async () => {
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
                // Cancella da Supabase
                await DailyJournalDBService.deleteEntry(currentUser.id, selectedDayKey);

                // Reset tutti gli stati locali
                setJournalText('');
                setJournalPrompt('');
                setAiScore(null);
                setAiAnalysis(null);

                // Cancella anche da AsyncStorage
                await DailyJournalService.saveLocalEntry(selectedDayKey, '', '');

                // Aggiorna monthJournalMap per rimuovere l'entry
                setMonthJournalMap(prev => {
                  const updated = { ...prev };
                  delete updated[selectedDayKey];
                  return updated;
                });

                // Ricarica la lista delle entry recenti per aggiornare la sezione "Ultime note"
                try {
                  const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
                  setJournalHistory(recent);
                } catch (e) {
                  console.error('Error reloading journal history:', e);
                }

                // Forza il refresh dei dati per il giorno selezionato
                // Verifica che non ci siano più dati nel database
                try {
                  const existing = await DailyJournalDBService.getEntryByDate(currentUser.id, selectedDayKey);
                  if (!existing) {
                    // Conferma che è stata cancellata - resetta anche gli stati AI
                    setAiScore(null);
                    setAiAnalysis(null);
                  }
                } catch (e) {
                  // Se non esiste, va bene - significa che è stata cancellata
                  setAiScore(null);
                  setAiAnalysis(null);
                }

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
      t('chat.resetContext.title') || 'Reset Contesto AI',
      t('chat.resetContext.message') || 'Vuoi resettare il contesto dell\'assistente? L\'AI non conoscerà più la tua storia (emozioni, analisi pelle, ecc.) per questa sessione. I tuoi dati nel database non verranno eliminati.',
      [
        { text: t('common.cancel') || 'Annulla', style: 'cancel' },
        {
          text: t('common.reset') || 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // 🔥 RESET: Imposta il contesto a null
              // L'AI risponderà senza conoscere la storia dell'utente
              // I dati nel database rimangono intatti
              setAiContext(null);
              Alert.alert(t('common.success') || 'Successo', t('chat.resetContext.success') || 'Contesto AI resettato. L\'assistente non conoscerà più la tua storia per questa sessione.');
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
        aiScore: aiScore || undefined,
        aiAnalysis: aiAnalysis || undefined,
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


  const closeVoiceInterface = useCallback(() => {
    setVoiceModeDismissed(true);
    if (voiceMode === 'true') {
      router.replace('/(tabs)/coach');
    }
    voiceInterfaceOpacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(setShowVoiceInterface)(false);
    });
  }, [voiceMode, router, voiceInterfaceOpacity]);

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Animation styles
  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const dynamicStyles = useMemo(() => ({
    container: {
      backgroundColor: colors.background,
    },
  }), [colors.background]);

  const isHomeVoiceLaunch = voiceMode === 'true' && !voiceModeDismissed;

  const renderModernVoiceChat = (forceVisible = false) => (
    <ModernVoiceChat
      visible={forceVisible || showVoiceInterface}
      onClose={closeVoiceInterface}
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
  );

  // scrollContentStyle non più necessario per FlatList; il paddingBottom viene messo direttamente in contentContainerStyle della FlatList


  // 🆕 Funzione helper per salvare l'entry del journal
  const saveJournalEntry = useCallback(async (dayKey: string) => {
    if (!currentUser) return;

    await DailyJournalService.saveLocalEntry(dayKey, journalText, journalPrompt);

    try {
      // Check if we need to generate AI judgment (only if content changed and no existing score)
      let aiScore = null, aiAnalysis = null;

      // Check if we already have AI judgment for this entry
      const hasExistingAI = aiScore || aiAnalysis;

      if (journalText.trim().length > 10 && !hasExistingAI) {
        // 🆕 Rimossi log per performance
        // 🔥 FIX: Recupera le note dal database invece che da AsyncStorage
        let moodNote: string | null = null;
        let sleepNote: string | null = null;

        try {
          const { supabase } = await import('../lib/supabase');
          const { data: checkinData } = await supabase
            .from('daily_copilot_analyses')
            .select('mood_note, sleep_note')
            .eq('user_id', currentUser.id)
            .eq('date', dayKey)
            .maybeSingle();

          if (checkinData) {
            moodNote = checkinData.mood_note || null;
            sleepNote = checkinData.sleep_note || null;
          }
        } catch (error) {
          // Fallback ad AsyncStorage per retrocompatibilità
          moodNote = await AsyncStorage.getItem(`checkin:mood_note:${dayKey}`);
          sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${dayKey}`);
        }

        const aiJudgment = await DailyJournalService.generateAIJudgment(
          currentUser.id,
          journalText,
          moodNote || undefined,
          sleepNote || undefined
        );

        if (aiJudgment) {
          aiScore = aiJudgment.ai_score;
          aiAnalysis = aiJudgment.ai_analysis;

          // Update local state
          setAiScore(aiScore);
          setAiAnalysis(aiAnalysis);
        }
      }

      await DailyJournalService.syncToRemote(currentUser.id, dayKey, journalText, journalPrompt, aiScore, aiAnalysis);
      const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
      setJournalHistory(recent);

      // 🆕 Aggiorna monthJournalMap quando si salva una entry
      setMonthJournalMap(prev => ({
        ...prev,
        [dayKey]: {
          hasEntry: true,
          aiScore: aiScore || undefined
        }
      }));

      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(ts);
      setShowSavedChip(true);
      setTimeout(() => setShowSavedChip(false), 2000);
      // Aggiorna il testo originale dopo il salvataggio
      setOriginalJournalText(journalText);
      Alert.alert('Salvato', 'Journal salvato e analizzato correttamente');
    } catch (e) {
      // 🆕 Log dell'errore per debugging
      console.error('Error saving journal entry:', e);
      // 🆕 Mostra messaggio più specifico se possibile
      const errorMessage = e instanceof Error ? e.message : 'Errore sconosciuto';
      Alert.alert(
        'Offline',
        `Journal salvato in locale, verrà sincronizzato. ${errorMessage.includes('network') || errorMessage.includes('fetch') ? '(Problema di connessione)' : ''}`
      );
    }
  }, [currentUser, journalText, journalPrompt]);

  // 🆕 Voice input handler memoizzato (solo per chat, non per journal)
  const handleVoiceInput = useCallback(async (text: string) => {
    // ✅ REAL VOICE INPUT - No more simulation!
    // 🆕 Rimosso log per performance

    if (mode === 'journal') {
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
    <SafeAreaWrapper
      style={[styles.container, dynamicStyles.container, { backgroundColor: safeAreaBackground }]}
    >
      {/* HEADER FISSO - Fuori da AvoidSoftInputView */}
      <View
        style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}>
          <FontAwesome name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {/* Segmented toggle: Chat | Journal */}
          <CopilotStep text="Modalità Chat o Journal" order={1} name="modeToggle">
            <WalkthroughableView style={[styles.segmentedControl, { backgroundColor: surfaceSecondary }]}>
              <TouchableOpacity
                onPress={() => setMode('chat')}
                style={[styles.segmentBtn, mode === 'chat' && [styles.segmentBtnActive, { backgroundColor: colors.surface }]]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'chat' }}
              >
                <Text style={[styles.segmentText, { color: colors.textSecondary }, mode === 'chat' && [styles.segmentTextActive, { color: colors.text }]]}>{t('chat.title')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('journal')}
                style={[styles.segmentBtn, mode === 'journal' && [styles.segmentBtnActive, { backgroundColor: colors.surface }]]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'journal' }}
              >
                <Text style={[styles.segmentText, { color: colors.textSecondary }, mode === 'journal' && [styles.segmentTextActive, { color: colors.text }]]}>{t('journal.title')}</Text>
              </TouchableOpacity>
            </WalkthroughableView>
          </CopilotStep>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Cronologia Chat Button */}
          {mode === 'chat' && chatHistory.length > 0 && (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
              onPress={() => setShowChatHistory(!showChatHistory)}
            >
              <FontAwesome name="history" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
          {/* Impostazioni Button */}
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
            onPress={() => setShowChatMenu(true)}
          >
            <FontAwesome name="cog" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* AREA CHE SI MUOVE CON LA TASTIERA - KeyboardController */}
      <View style={styles.flex}>
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
        {renderModernVoiceChat()}

        {/* Chat/Journal Content */}
        <View style={styles.scrollArea}>
          {mode === 'chat' ? (
            <>
              {/* Chat History Dropdown - Mostrato solo quando showChatHistory è true */}
              {showChatHistory && chatHistory.length > 0 && (
                <View style={styles.chatHistoryContainer}>
                  <View style={[styles.chatHistoryList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chatHistoryScrollContent}
                    >
                      {chatHistory.map((session: any) => {
                        const firstMessage = session.firstUserMessage || '';
                        const truncatedMessage = firstMessage.length > 50
                          ? firstMessage.substring(0, 50) + '...'
                          : firstMessage;

                        return (
                          <TouchableOpacity
                            key={session.id}
                            style={[
                              styles.chatHistoryItem,
                              { backgroundColor: surfaceSecondary, borderColor: colors.border },
                              currentSessionId === session.id && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
                            ]}
                            onPress={async () => {
                              // Carica i messaggi della sessione selezionata
                              const sessionMessages = await ChatService.getChatMessages(session.id);
                              const formattedMessages: Message[] = sessionMessages.map((msg: any) => ({
                                id: msg.id,
                                text: msg.content,
                                sender: msg.role === 'user' ? 'user' : 'ai',
                                timestamp: new Date(msg.created_at),
                                sessionId: session.id,
                              }));

                              setMessages(formattedMessages.length > 0 ? formattedMessages : [{
                                id: 'welcome',
                                text: getInitialMessage(),
                                sender: 'ai',
                                timestamp: new Date(Date.now() - 60000),
                              }]);
                              setCurrentSessionId(session.id);
                              setShowChatHistory(false);
                            }}
                          >
                            <Text
                              style={[styles.chatHistoryItemName, { color: colors.text }]}
                              numberOfLines={2}
                            >
                              {truncatedMessage || session.session_name || t('chat.history.unnamed') || 'Chat senza nome'}
                            </Text>
                            {currentSessionId === session.id && (
                              <View style={[styles.chatHistoryActiveIndicator, { backgroundColor: colors.primary }]} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Quick Replies - Expandible/Collapsible */}
              <View style={styles.quickRepliesContainer}>
                <TouchableOpacity
                  style={styles.quickRepliesHeader}
                  onPress={() => setQuickRepliesExpanded(!quickRepliesExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickRepliesHeaderLeft}>
                    <FontAwesome name="lightbulb-o" size={14} color={colors.textSecondary} />
                    <Text style={[styles.quickRepliesToggleText, { color: colors.textSecondary }]}>
                      {t('chat.quickStart.toggle') || 'Messaggi suggeriti'}
                    </Text>
                  </View>
                  <FontAwesome
                    name={quickRepliesExpanded ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {quickRepliesExpanded && (
                  <View style={styles.quickRepliesGrid}>
                    {quickReplies.map((reply) => (
                      <TouchableOpacity
                        key={reply.text}
                        style={[styles.quickReplyCard, { backgroundColor: themeMode === 'dark' ? `${reply.color}20` : `${reply.color}15` }]}
                        onPress={() => {
                          handleQuickReply(reply.text);
                          setQuickRepliesExpanded(false); // Collassa dopo la selezione
                        }}
                      >
                        <FontAwesome name={reply.icon as any} size={16} color={reply.color} />
                        <Text style={[styles.quickReplyText, { color: reply.color }]}>{reply.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Messages - FlatList normale (messaggi vecchi in alto, nuovi in basso) */}
              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.messagesContainer,
                  // paddingTop per lasciare spazio in alto, paddingBottom costante per l'input
                  // AvoidSoftInputView gestisce automaticamente lo spazio della tastiera
                  {
                    paddingTop: 20,
                    paddingBottom: 20
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
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
                      <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MessageLoadingDots isVisible={showLoadingCloud} />
                      </View>
                    </View>
                  ) : null
                }
                ref={messagesListRef}
              />
            </>
          ) : (
            <ScrollView
              ref={journalScrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Month header + navigation */}
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={styles.monthNavBtn}>
                  <Text style={styles.monthNavTxt}>{'<'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={[styles.monthTitleWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>{currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={styles.monthNavBtn}>
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
                  const dayNum = parseInt(iso.slice(8, 10), 10);
                  const hasEntry = journal?.hasEntry || false;
                  const isFuture = isFutureDate(iso); // 🆕 Verifica se è una data futura
                  const isPast = isPastDate(iso); // 🆕 Verifica se è una data passata

                  return (
                    <TouchableOpacity
                      key={iso}
                      onPress={() => {
                        if (!isFuture) {
                          // Permetti la selezione di giorni passati senza alert - l'alert apparirà solo quando si prova a salvare/modificare
                          setSelectedDayKey(iso);
                        }
                      }}
                      disabled={isFuture} // 🆕 Disabilita solo i giorni futuri
                      style={[
                        styles.dayPill,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        active && { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
                        isFuture && { opacity: 0.4 } // 🆕 Stile visivo per giorni futuri
                      ]}
                    >
                      {hasEntry && <View style={[styles.colorDot, { backgroundColor: color }]} />}
                      <Text style={[
                        styles.dayText,
                        { color: colors.text },
                        active && { color: '#3730a3', fontWeight: '800' },
                        isFuture && { color: colors.textTertiary } // 🆕 Testo più chiaro per giorni futuri
                      ]}>
                        {String(dayNum)}
                      </Text>
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
                      <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={styles.monthNavBtn}>
                        <Text style={styles.monthNavTxt}>{'<'}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>{currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}</Text>
                      <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={styles.monthNavBtn}>
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
                        for (let i = 0; i < totalCells; i++) {
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
                            const isFuture = isFutureDate(iso); // 🆕 Verifica se è una data futura
                            const isPast = isPastDate(iso); // 🆕 Verifica se è una data passata

                            cells.push(
                              <TouchableOpacity
                                key={`d-${i}`}
                                style={[
                                  styles.calCell,
                                  { backgroundColor: colors.surface, borderColor: colors.border },
                                  active && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                                  isFuture && { opacity: 0.4 } // 🆕 Stile visivo per giorni futuri
                                ]}
                                onPress={() => {
                                  if (!isFuture) {
                                    // Permetti la selezione di giorni passati senza alert - l'alert apparirà solo quando si prova a salvare/modificare
                                    setSelectedDayKey(iso);
                                    setShowMonthPicker(false);
                                  }
                                }}
                                disabled={isFuture} // 🆕 Disabilita solo i giorni futuri
                              >
                                <Text style={[
                                  styles.calDayTxt,
                                  { color: colors.text },
                                  active && { color: colors.primary, fontWeight: '800' },
                                  isFuture && { color: colors.textTertiary } // 🆕 Testo più chiaro per giorni futuri
                                ]}>
                                  {String(dayNum)}
                                </Text>
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
                    <TouchableOpacity
                      style={[
                        styles.pillSecondary,
                        { backgroundColor: surfaceSecondary, borderColor: colors.border },
                        (selectedTemplate !== 'free' || isPromptLoading) && styles.pillSecondaryDisabled,
                      ]}
                      onPress={handleRegeneratePrompt}
                      disabled={selectedTemplate !== 'free' || isPromptLoading}
                    >
                      <Text style={[styles.pillSecondaryText, { color: colors.primary }]}>
                        {isPromptLoading ? t('common.loading') : t('journal.regeneratePrompt')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.journalPromptText, { color: colors.text }]}>{journalPrompt}</Text>
                </LinearGradient>
              ) : null}

              {/* Journal Editor */}
              <View style={styles.journalEditorWrap}>
                <BlurView intensity={12} tint="light" style={styles.journalBlur} />
                <View style={styles.journalEditorHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.editorTitle, { color: colors.text }]}>{t('journal.entryTitle')}</Text>
                    <View style={[styles.dateChip, { backgroundColor: surfaceSecondary }]}>
                      {/* 🔥 FIX: Mostra sempre la data odierna corrente se selectedDayKey è oggi, altrimenti mostra selectedDayKey */}
                      <Text style={[styles.dateChipText, { color: colors.textSecondary }]}>
                        {selectedDayKey === getTodayKey() ? getTodayKey() : selectedDayKey}
                      </Text>
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
                  <TouchableOpacity
                    style={styles.journalSave}
                    onPress={async () => {
                      if (!currentUser) return;
                      // 🔥 FIX: Usa selectedDayKey invece di dayKey (che non esiste più)
                      const dayKey = selectedDayKey;

                      // 🆕 Verifica se si sta salvando per un giorno passato E se il testo è stato modificato
                      const isPast = isPastDate(dayKey);
                      const hasTextChanged = journalText.trim() !== originalJournalText.trim();

                      // Mostra alert solo se è un giorno passato E il testo è stato modificato
                      if (isPast && hasTextChanged) {
                        Alert.alert(
                          t('journal.pastDateSave.title') || 'Modificare entry di un giorno passato?',
                          t('journal.pastDateSave.message') || 'Stai modificando un entry di un giorno passato. Vuoi continuare?',
                          [
                            { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                            {
                              text: t('common.continue') || 'Continua',
                              onPress: async () => {
                                try {
                                  await saveJournalEntry(dayKey);
                                  // Aggiorna il testo originale dopo il salvataggio
                                  setOriginalJournalText(journalText);
                                } catch (error) {
                                  console.error('Error saving journal entry:', error);
                                  Alert.alert(
                                    t('common.error') || 'Errore',
                                    t('journal.errorSaving') || 'Errore durante il salvataggio dell\'entry'
                                  );
                                }
                              }
                            }
                          ]
                        );
                        return;
                      }

                      // Salva normalmente (giorno odierno o giorno passato senza modifiche)
                      await saveJournalEntry(dayKey);
                      // Aggiorna il testo originale dopo il salvataggio
                      setOriginalJournalText(journalText);
                    }}
                  >
                    <Text style={styles.journalSaveText}>{t('journal.save')}</Text>
                  </TouchableOpacity>
                </View>
                {showSavedChip && lastSavedAt && (
                  <View style={styles.savedChip}><Text style={styles.savedChipText}>{t('journal.savedAt', { time: lastSavedAt })}</Text></View>
                )}
              </View>

              {/* Uno sguardo sul tuo Diario */}
              {aiAnalysis && (
                <View style={[styles.aiInsightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.aiInsightHeader}>
                    <View style={styles.aiInsightTitleRow}>
                      <View style={styles.aiInsightIcon}>
                        <Text style={styles.aiInsightIconText}>🤖</Text>
                      </View>
                      <Text style={[styles.aiInsightTitle, { color: colors.text }]}>{t('journal.diaryInsight')}</Text>
                    </View>
                  </View>

                  <View style={styles.aiInsightContent}>
                    <Text style={[styles.aiInsightSummary, { color: colors.textSecondary }]}>{aiAnalysis}</Text>
                  </View>
                </View>
              )}

              {/* Journal History */}
              {journalHistory?.length ? (
                <View style={styles.journalHistory}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journal.latestNotes')}</Text>
                  {journalHistory.slice(0, 7).map((it) => (
                    <View key={it.id} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.historyHeader}>
                        <View style={styles.dateChipSm}><Text style={styles.dateChipSmText}>{it.entry_date}</Text></View>
                        <TouchableOpacity
                          onPress={() => {
                            handleOpenJournal(it.entry_date);
                          }}
                        >
                          <Text style={styles.openTxt}>{t('journal.open')}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.historyPreviewBox}>
                        <Markdown style={chatMarkdownStyles(themeMode, colors)}>{it.content}</Markdown>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                // Empty state for journal when no entries exist
                mode === 'journal' && (
                  <EmptyStateCard
                    type="journal"
                    onAction={() => {
                      // Focus on journal input
                      // The input is already visible, so we just need to ensure it's focused
                      // This will be handled by the TextInput's autoFocus or user interaction
                    }}
                  />
                )
              )}
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
                {aiAnalysis && (
                  <Text style={[styles.modalText, { color: colors.text }]}>{aiAnalysis}</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Input Area (Chat only) - hidden when voice interface is visible */}
        {mode === 'chat' && !showVoiceInterface && (
          <CopilotStep text="Scrivi o Parla" order={2} name="inputArea">
            <WalkthroughableView style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <View style={[styles.inputWrapper, { backgroundColor: surfaceSecondary, borderColor: colors.border, flex: 1, marginRight: 8 }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }, isVoiceMode && styles.voiceInput]}
                  placeholder={isVoiceMode ? t('chat.listening') : t('chat.placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={inputValue}
                  onChangeText={setInputValue}
                  multiline
                  maxLength={1000}
                  editable={!isSending && !isVoiceMode}
                />
              </View>

              {inputValue.trim().length > 0 ? (
                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={isSending}
                  style={[styles.sendButton, { backgroundColor: colors.primary }]}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <MaterialCommunityIcons name="arrow-up" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsVoiceMode(true)}
                  style={[styles.micButton, { backgroundColor: (colors as any).surfaceSecondary ?? colors.surface }]}
                >
                  <MaterialCommunityIcons name="microphone" size={20} color={colors.text} />
                </TouchableOpacity>
              )}
            </WalkthroughableView>
          </CopilotStep>
        )}
        {/* Fake View for Keyboard Animation */}
        <Animated.View style={fakeViewStyle} />
      </View>

      {/* Wellness Suggestion Popup */}
      <WellnessSuggestionPopup
        visible={showWellnessPopup}
        suggestion={wellnessSuggestion?.suggestion}
        onAddToToday={handleAddToToday}
        onDismiss={handleDismissPopup}
        onStartExercise={handleStartExercise}
      />

      <TimePickerModal
        visible={showTimePicker}
        onClose={() => {
          setShowTimePicker(false);
          setPendingSuggestion(null);
        }}
        onConfirm={handleTimeSelected}
        title={pendingSuggestion ? t('timePicker.selectTimeFor', { title: pendingSuggestion.title }) || `Seleziona orario per ${pendingSuggestion.title}` : undefined}
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
                    style={[styles.menuOption, styles.menuOptionLast]}
                    onPress={() => {
                      setShowChatMenu(false);
                      handleResetAIContext();
                    }}
                  >
                    <FontAwesome name="ban" size={18} color={colors.textSecondary} />
                    <Text style={[styles.menuOptionText, { color: colors.text }]}>
                      {t('chat.resetContext.menuTitle') || 'Reset Contesto AI'}
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
                    style={[styles.menuOption, styles.menuOptionLast]}
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
                <View style={styles.settingsSectionHeader}>
                  <View style={[styles.settingsSectionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Tono del coach</Text>
                </View>
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
                <View style={styles.settingsSectionHeader}>
                  <View style={[styles.settingsSectionDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Lunghezza risposta</Text>
                </View>
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
                    <View style={styles.settingsSectionHeader}>
                      <View style={[styles.settingsSectionDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Passi d'azione automatici</Text>
                    </View>
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
                    <View style={styles.settingsSectionHeader}>
                      <View style={[styles.settingsSectionDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Cronologia locale</Text>
                    </View>
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
                    template.id === 'free' && selectedTemplate === template.id && { borderColor: '#f5c643', backgroundColor: '#fffbea' },
                    selectedTemplate === template.id && template.id !== 'free' && { borderColor: colors.primary, backgroundColor: colors.primaryMuted }
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {template.id === 'free' && <Text style={{ fontSize: 16 }}>✨</Text>}
                      <Text style={[styles.templateOptionName, { color: colors.text }, selectedTemplate === template.id && { color: colors.primary, fontWeight: '700' }]}>
                        {template.name}
                      </Text>
                    </View>
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
    </SafeAreaWrapper>
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
  pillSecondaryDisabled: {
    opacity: 0.6,
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
    paddingTop: 12,
  },
  quickRepliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  quickRepliesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickRepliesToggleText: {
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 8,
    paddingBottom: 8,
  },
  chatHistoryContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 8,
  },
  chatHistoryList: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
  },
  chatHistoryScrollContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  chatHistoryItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 150,
    maxWidth: 220,
    position: 'relative',
  },
  chatHistoryItemName: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  chatHistoryActiveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
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
  yearBtnActive: {},
  yearTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
  yearTxtActive: { color: '#3730a3' },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 6, paddingHorizontal: 6 },
  weekHeaderTxt: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#64748b' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 6 },
  calCell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  calCellEmpty: { width: `${100 / 7}%`, height: 52, borderWidth: 1 },
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
  aiInsightContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
  },
  aiInsightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  menuOptionLast: {
    borderBottomWidth: 0,
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
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  settingsSectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
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

// Removed export default since we export named component above
// export default ChatScreen;