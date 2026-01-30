/**
 * ChatOnlyScreen - Standalone Chat Component
 * Extracted from ChatScreen.tsx for better maintainability
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Dimensions,
    Alert,
    Modal,
    Platform,
    Switch,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
    SlideInLeft,
    SlideOutLeft,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

// Components
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import WellnessSuggestionPopup from './WellnessSuggestionPopup';
import { TimePickerModal } from './TimePickerModal';
import { ModernVoiceChat } from './ModernVoiceChat';
import MessageLoadingDots from './MessageLoadingDots';
import { AnalysisActionButtons } from './AnalysisActionButtons';
import { EmptyStateCard } from './EmptyStateCard';

// Services
import { UnifiedTTSService } from '../services/unified-tts.service';
import { ChatService, WellnessSuggestionService } from '../services/chat-wellness.service';
import { LocalChatService, LocalChatSession, LocalChatMessage } from '../services/local-storage/local-chat.service';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { AnalysisIntentService } from '../services/analysis-intent.service';
import { ChatSettingsService, ChatTone, ResponseLength } from '../services/chat-settings.service';
import { ExportService } from '../services/export.service';
import { DailyJournalDBService } from '../services/daily-journal-db-local.service';
import { BACKEND_URL, getBackendURL } from '../constants/env';

// Hooks & Context
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';

// Utilities
import {
    Message,
    extractSuggestionFromAIResponse,
    formatTime,
    getCategoryForActivity,
} from '../utils/chat-journal.utils';

const { width } = Dimensions.get('window');

interface ChatOnlyScreenProps {
    user?: any;
    onLogout?: () => void;
}

// Markdown styles generator
const chatMarkdownStyles = (themeMode: string, colors: any) => ({
    body: {
        color: colors.text,
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Figtree_500Medium',
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    heading1: {
        color: colors.text,
        fontSize: 20,
        fontFamily: 'Figtree_700Bold', // Was 700
        marginBottom: 8,
    },
    heading2: {
        color: colors.text,
        fontSize: 18,
        fontFamily: 'Figtree_700Bold', // Was 600
        marginBottom: 6,
    },
    list_item: {
        marginBottom: 4,
    },
    bullet_list: {
        marginBottom: 8,
    },
    ordered_list: {
        marginBottom: 8,
    },
    code_inline: {
        backgroundColor: themeMode === 'dark' ? '#374151' : '#f3f4f6',
        color: themeMode === 'dark' ? '#f9fafb' : '#1f2937',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
    },
    fence: {
        backgroundColor: themeMode === 'dark' ? '#374151' : '#f3f4f6',
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
    },
    link: {
        color: colors.primary,
        textDecorationLine: 'underline' as const,
    },
    blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        paddingLeft: 12,
        marginLeft: 0,
        marginVertical: 8,
        opacity: 0.8,
    },
});

export const ChatOnlyScreen: React.FC<ChatOnlyScreenProps> = ({ user, onLogout }) => {
    const { t, language } = useTranslation();
    const { colors, mode: themeMode } = useTheme();
    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const router = useRouter();
    const { voiceMode } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const surfaceSecondary = (colors as any).surfaceSecondary ?? colors.surface;

    // Hide tab bar when screen is focused
    useFocusEffect(
        useCallback(() => {
            hideTabBar();
            return () => showTabBar();
        }, [hideTabBar, showTabBar])
    );

    // ==================== STATE ====================
    const [currentUser, setCurrentUser] = useState<any>(user);
    const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: t('chat.welcomeMessage.default'),
            sender: 'ai',
            timestamp: new Date(Date.now() - 60000),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showLoadingCloud, setShowLoadingCloud] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [showVoiceInterface, setShowVoiceInterface] = useState(false);
    const [voiceModeDismissed, setVoiceModeDismissed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiContext, setAiContext] = useState<any>(null);
    const [wellnessSuggestion, setWellnessSuggestion] = useState<any>(null);
    const [showWellnessPopup, setShowWellnessPopup] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<any>(null);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showChatSettings, setShowChatSettings] = useState(false);
    const [chatSettings, setChatSettings] = useState({
        tone: 'empathetic' as ChatTone,
        responseLength: 'standard' as ResponseLength,
        includeActionSteps: true,
        localHistoryEnabled: true,
    });
    const [chatHistory, setChatHistory] = useState<LocalChatSession[]>([]);
    const [showChatHistory, setShowChatHistory] = useState(false);
    const [quickRepliesExpanded, setQuickRepliesExpanded] = useState(false);

    // Refs
    const messagesListRef = useRef<FlatList>(null);
    const isMountedRef = useRef(true);

    // Animation values
    const keyboardHeight = useSharedValue(0);
    const voiceInterfaceOpacity = useSharedValue(0);

    // TTS Service
    const tts = useMemo(() => UnifiedTTSService.getInstance(), []);

    // ==================== KEYBOARD HANDLING ====================
    useKeyboardHandler(
        {
            onMove: (event) => {
                'worklet';
                keyboardHeight.value = event.height;
            },
        },
        []
    );

    const fakeViewStyle = useAnimatedStyle(() => ({
        height: Math.abs(keyboardHeight.value),
    }));

    // ==================== INITIAL MESSAGE ====================
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

    // ==================== LIFECYCLE ====================
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (voiceMode === 'true') {
            setShowVoiceInterface(true);
            setVoiceModeDismissed(false);
            voiceInterfaceOpacity.value = withTiming(1, { duration: 300 });
        }
    }, [voiceMode]);

    // Load user and profile
    useEffect(() => {
        if (user?.id) {
            setCurrentUser(user);
            AuthService.getUserProfile(user.id).then(profile => {
                if (isMountedRef.current && profile) {
                    setCurrentUserProfile(profile);
                    const personalizedMessage = getInitialMessage();
                    setMessages(prev => prev.map(msg =>
                        msg.id === 'welcome' ? { ...msg, text: personalizedMessage } : msg
                    ));
                }
            }).catch(console.error);
        }
    }, [user?.id]);

    // Load chat settings
    useEffect(() => {
        ChatSettingsService.getSettings().then(setChatSettings);
    }, []);

    // Initialize services
    useEffect(() => {
        const initializeServices = async () => {
            try {
                await tts.initialize();

                // Prune old messages (7 days) and empty sessions
                await LocalChatService.pruneOldMessages(7);
                await LocalChatService.pruneEmptySessions();

                if (currentUser?.id) {
                    const context = await AIContextService.getCompleteContext(currentUser.id, true);
                    setAiContext(context);
                }

                // CHECK FOR EXISTING SESSION FOR TODAY
                const sessions = await LocalChatService.listSessions();
                const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
                const todayString = new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }); // e.g., "30 gen" or "Jan 30"

                // Find a session from today that already has messages (or just the most recent one from today)
                // We'll trust pruneEmptySessions has run, so any session remaining is valid or we can reuse it.
                // Simple logic: If the most recent session was updated today, use it.
                const mostRecent = sessions[0];
                if (mostRecent) {
                    const sessionDate = new Date(mostRecent.updated_at).toDateString();
                    const isToday = sessionDate === new Date().toDateString();

                    if (isToday) {
                        // Restore this session
                        setCurrentSessionId(mostRecent.id);
                        const msgs = await LocalChatService.getMessages(mostRecent.id);
                        const formatted: Message[] = msgs.map(m => ({
                            id: m.id,
                            text: m.content,
                            sender: m.role === 'user' ? 'user' : 'ai',
                            timestamp: new Date(m.created_at),
                            sessionId: mostRecent.id
                        }));
                        if (formatted.length > 0) {
                            setMessages(formatted);
                        }
                    } else {
                        // Start fresh (UI only), session created on first message
                        setCurrentSessionId(null);
                    }
                } else {
                    setCurrentSessionId(null);
                }

            } catch (error) {
                console.error('Failed to initialize services:', error);
            }
        };
        initializeServices();
    }, [currentUser?.id, tts, language, t]);

    // Load chat history
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const sessions = await LocalChatService.listSessions();
                setChatHistory(sessions);
            } catch (error) {
                console.error('Error loading chat history:', error);
            }
        };
        if (showChatHistory) {
            loadHistory();
        }
    }, [showChatHistory, currentSessionId]); // Reload when history opens or session changes

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesListRef.current && messages.length > 0) {
            setTimeout(() => {
                messagesListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    // ==================== HANDLERS ====================
    const handleSendMessage = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isSending) return;

        const userMessage: Message = {
            id: `${Date.now()}-user`,
            text: trimmed,
            sender: 'user',
            timestamp: new Date(),
            sessionId: currentSessionId || undefined,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsSending(true);
        setShowLoadingCloud(true);

        try {
            // Lazy create session if needed
            let activeSessionId = currentSessionId;
            if (!activeSessionId) {
                const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
                const sessionDate = new Date().toLocaleDateString(dateLocale);
                const newSession = await LocalChatService.createSession(
                    t('chat.sessionName', { date: sessionDate })
                );
                activeSessionId = newSession.id;
                setCurrentSessionId(activeSessionId);
            }

            // Save user message (Local)
            if (activeSessionId) {
                await LocalChatService.addMessage(
                    activeSessionId,
                    'user',
                    trimmed,
                    {
                        emotionContext: aiContext?.currentEmotion ? JSON.stringify({
                            dominantEmotion: aiContext.currentEmotion.emotion,
                            valence: aiContext.currentEmotion.valence
                        }) : undefined
                    }
                );
            }

            // Detect analysis intent
            const analysisIntent = AnalysisIntentService.detectAnalysisIntent(trimmed);

            // Load journal entries for RAG
            let journalEntriesForChat: Array<{ date: string; content: string }> = [];
            try {
                if (currentUser?.id) {
                    const recentEntries = await DailyJournalDBService.listRecent(currentUser.id, 10);
                    journalEntriesForChat = recentEntries
                        .filter(e => e.content && !e.content.includes('ciphertext'))
                        .map(e => ({ date: e.entry_date, content: e.content }));
                }
            } catch (error) {
                console.log('Failed to load journal entries');
            }

            // Prepare context
            const userContext = aiContext ? {
                emotionHistory: aiContext.emotionHistory,
                skinHistory: aiContext.skinHistory,
                emotionTrend: aiContext.emotionTrend,
                skinTrend: aiContext.skinTrend,
                insights: aiContext.insights,
                nutritionContext: aiContext.nutritionContext,
                menstrualCycleContext: aiContext.menstrualCycleContext,
                journalEntries: journalEntriesForChat.length > 0 ? journalEntriesForChat : undefined,
                firstName: currentUserProfile?.first_name || currentUser?.email?.split('@')[0] || 'Utente',
                language,
            } : { language };

            // Send to backend
            const dynamicBackendURL = await getBackendURL();
            const response = await fetch(`${dynamicBackendURL}/api/chat/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    sessionId: activeSessionId,
                    userId: currentUser?.id,
                    emotionContext: aiContext?.currentEmotion,
                    userContext,
                    analysisIntent: analysisIntent.confidence > 0.3 ? analysisIntent : undefined,
                    tone: chatSettings.tone,
                    responseLength: chatSettings.responseLength,
                    includeActionSteps: chatSettings.includeActionSteps,
                    messageHistory: messages.slice(-5).map(msg => ({
                        role: msg.sender === 'user' ? 'user' : 'assistant',
                        content: msg.text,
                    })),
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

            setMessages(prev => [...prev, aiMessage]);

            // Save AI message (Local)
            if (activeSessionId) {
                await LocalChatService.addMessage(
                    activeSessionId,
                    'assistant',
                    reply
                );
            }

            // TTS for voice mode
            if (isVoiceMode) {
                try {
                    setIsSpeaking(true);
                    const ttsLanguage = language === 'it' ? 'it-IT' : 'en-US';
                    await tts.speak(reply, { rate: 0.5, pitch: 1.0, language: ttsLanguage });
                } catch (error) {
                    console.error('TTS error:', error);
                } finally {
                    setIsSpeaking(false);
                }
            }

            // Check for wellness suggestion
            if (currentUser && aiContext) {
                const aiSuggestion = extractSuggestionFromAIResponse(reply);
                if (aiSuggestion) {
                    setWellnessSuggestion({
                        suggestion: aiSuggestion,
                        shouldShowBanner: true,
                        urgency: 'medium',
                        timing: 'now',
                    });
                }
            }
        } catch (error) {
            console.error('Chat send error:', error);
            setMessages(prev => [...prev, {
                id: `${Date.now()}-fallback`,
                text: "I'm having a little trouble connecting right now, but we can keep chatting—try again in a moment?",
                sender: 'ai',
                timestamp: new Date(),
            }]);
        } finally {
            setIsSending(false);
            setShowLoadingCloud(false);
        }
    };

    const handleQuickReply = useCallback((reply: string) => {
        setInputValue(reply);
    }, []);

    const handleInputFocus = useCallback(() => {
        setTimeout(() => {
            messagesListRef.current?.scrollToEnd({ animated: true });
        }, Platform.OS === 'ios' ? 300 : 100);
    }, []);

    const handleAddToToday = async (suggestion: any) => {
        await WellnessSuggestionService.learnFromUserInteraction(currentUser.id, suggestion.id, 'accepted');
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

            const category = getCategoryForActivity(pendingSuggestion.id, pendingSuggestion.category?.id);

            const today = new Date();
            const scheduledTime = new Date(today);
            scheduledTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

            if (scheduledTime < new Date()) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            const endTime = new Date(scheduledTime.getTime() + 30 * 60 * 1000);

            const wellnessActivity = {
                id: `wellness-${Date.now()}-${pendingSuggestion.id}`,
                title: pendingSuggestion.title,
                description: pendingSuggestion.description || '',
                startTime: scheduledTime,
                endTime,
                category,
                reminderMinutes: 15,
                syncToCalendar: false,
                syncToReminders: true,
            };

            const syncResult = await WellnessSyncService.addWellnessActivity(wellnessActivity);

            await WellnessActivitiesService.saveActivity({
                title: pendingSuggestion.title,
                description: pendingSuggestion.description || '',
                category,
                scheduledTime,
                reminderId: syncResult.reminderId,
                calendarEventId: syncResult.calendarEventId,
            });

            Alert.alert(
                t('chat.activityAdded.title') || 'Attività aggiunta',
                t('chat.activityAdded.message', {
                    time: selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                }) || `Attività aggiunta. Riceverai un promemoria 15 minuti prima.`,
                [{ text: t('common.ok') || 'OK' }]
            );

            setPendingSuggestion(null);
            setWellnessSuggestion(null);
        } catch (error) {
            console.error('Error adding wellness activity:', error);
            Alert.alert(t('common.error') || 'Errore', 'Errore durante il salvataggio');
            setPendingSuggestion(null);
            setWellnessSuggestion(null);
        }
    };

    const handleDismissPopup = async () => {
        if (wellnessSuggestion?.suggestion) {
            await WellnessSuggestionService.learnFromUserInteraction(
                currentUser.id,
                wellnessSuggestion.suggestion.id,
                'dismissed'
            );
        }
        setShowWellnessPopup(false);
        setWellnessSuggestion(null);
    };

    const handleStartExercise = async (suggestion: any) => {
        await WellnessSuggestionService.learnFromUserInteraction(currentUser.id, suggestion.id, 'accepted');
        if (suggestion.id === 'breathing-exercises') {
            router.push('/breathing-exercise');
        }
        setShowWellnessPopup(false);
        setWellnessSuggestion(null);
    };

    const closeVoiceInterface = useCallback(() => {
        setVoiceModeDismissed(true);
        if (voiceMode === 'true') {
            router.replace('/(tabs)');
        }
        voiceInterfaceOpacity.value = withTiming(0, { duration: 300 }, () => {
            runOnJS(setShowVoiceInterface)(false);
        });
    }, [voiceMode, router, voiceInterfaceOpacity]);

    const handleVoiceInput = useCallback(async (text: string) => {
        setIsVoiceMode(true);
        setIsListening(false);
        setIsProcessing(true);
        setTranscript(text);

        const userMessage: Message = {
            id: `${Date.now()}-voice-user`,
            text,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Process voice input
        setInputValue(text);
        await handleSendMessage();
        setIsProcessing(false);
    }, []);

    const handleAddWellnessActivity = useCallback((suggestion: any) => {
        // Placeholder for wellness activity
    }, []);

    const handleClearChat = async () => {
        Alert.alert(
            t('chat.clearChat.title') || 'Cancella conversazione',
            t('chat.clearChat.message') || 'Vuoi cancellare tutti i messaggi?',
            [
                { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                {
                    text: t('common.delete') || 'Cancella',
                    style: 'destructive',
                    onPress: async () => {
                        setMessages([{
                            id: 'welcome',
                            text: getInitialMessage(),
                            sender: 'ai',
                            timestamp: new Date(),
                        }]);

                        // Clear current session messages
                        if (currentSessionId) {
                            // If we want to really clear, we might want to just start a new session
                            // But for now, we'll just soft reset the UI. 
                            // Or we could delete the session:
                            // await LocalChatService.deleteSession(currentSessionId);
                            // create new one
                        }

                        setShowChatMenu(false);
                        Alert.alert(t('common.success') || 'Successo', t('chat.clearChat.success'));
                    },
                },
            ]
        );
    };

    // Analysis handlers
    const handleEmotionAnalysis = useCallback(() => router.push('/(tabs)/analysis'), [router]);
    const handleSkinAnalysis = useCallback(() => router.push('/(tabs)/skin'), [router]);

    // ==================== RENDER ====================
    return (
        <SafeAreaWrapper style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}>
                    <FontAwesome name="chevron-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('chat.title')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
                        onPress={() => setShowChatHistory(!showChatHistory)}
                    >
                        <FontAwesome name="history" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
                        onPress={() => setShowChatMenu(true)}
                    >
                        <FontAwesome name="cog" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat History Overlay (Custom Implementation for better animation) */}
            {showChatHistory && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
                    {/* Backdrop with Blur */}
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(300)}
                        style={StyleSheet.absoluteFill}
                    >
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => setShowChatHistory(false)}
                        >
                            <BlurView
                                intensity={20}
                                tint="dark"
                                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
                            />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Sidebar Panel */}
                    <Animated.View
                        entering={SlideInLeft.duration(300)}
                        exiting={SlideOutLeft.duration(300)}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '85%',
                            maxWidth: 340,
                            marginTop: insets.top + 10,
                            marginBottom: 20,
                            marginLeft: 0, // Attached to left edge
                            zIndex: 101,
                            borderTopRightRadius: 24, // Only round right corners
                            borderBottomRightRadius: 24,
                            backgroundColor: colors.surface,
                            shadowColor: '#000',
                            shadowOffset: { width: 4, height: 0 }, // Shadow to the right
                            shadowOpacity: 0.3,
                            shadowRadius: 16,
                            elevation: 12,
                            overflow: 'hidden',
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingHorizontal: 20,
                                paddingVertical: 18,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                                backgroundColor: colors.surface,
                            }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Figtree_700Bold' }}>
                                    {t('chat.history.title') || 'Cronologia'}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowChatHistory(false)}
                                    style={{
                                        padding: 8,
                                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                        borderRadius: 20,
                                    }}
                                >
                                    <FontAwesome name="times" size={16} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.primary,
                                    marginHorizontal: 16,
                                    marginTop: 16,
                                    marginBottom: 12,
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                    gap: 10,
                                }}
                                onPress={async () => {
                                    const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
                                    const sessionDate = new Date().toLocaleDateString(dateLocale);
                                    const newSession = await LocalChatService.createSession(t('chat.sessionName', { date: sessionDate }));

                                    const welcomeMessage = getInitialMessage();
                                    setMessages([{
                                        id: 'welcome',
                                        text: welcomeMessage,
                                        sender: 'ai',
                                        timestamp: new Date(),
                                    }]);
                                    if (newSession) setCurrentSessionId(newSession.id);
                                    setShowChatHistory(false);
                                }}
                            >
                                <FontAwesome name="plus" size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t('chat.history.newChat') || 'Nuova Chat'}</Text>
                            </TouchableOpacity>

                            <FlatList
                                data={chatHistory}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingHorizontal: 16 }}
                                renderItem={({ item: session }) => {
                                    const dateString = new Date(session.created_at).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                    const isSelected = currentSessionId === session.id;

                                    return (
                                        <TouchableOpacity
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? colors.primaryMuted : surfaceSecondary,
                                                paddingVertical: 12,
                                                paddingHorizontal: 14,
                                                borderRadius: 10,
                                                marginBottom: 8,
                                                borderLeftWidth: isSelected ? 3 : 0,
                                                borderLeftColor: colors.primary,
                                            }}
                                            onPress={async () => {
                                                const msgs = await LocalChatService.getMessages(session.id);
                                                const formatted: Message[] = msgs.map(m => ({
                                                    id: m.id,
                                                    text: m.content,
                                                    sender: m.role === 'user' ? 'user' : 'ai',
                                                    timestamp: new Date(m.created_at),
                                                    sessionId: session.id
                                                }));

                                                if (formatted.length > 0) {
                                                    setMessages(formatted);
                                                } else {
                                                    setMessages([{
                                                        id: 'welcome',
                                                        text: getInitialMessage(),
                                                        sender: 'ai',
                                                        timestamp: new Date(),
                                                    }]);
                                                }
                                                setCurrentSessionId(session.id);
                                                setShowChatHistory(false);
                                            }}
                                        >
                                            <FontAwesome name="comment-o" size={16} color={colors.textSecondary} style={{ marginRight: 12 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }} numberOfLines={1}>
                                                    {session.name || t('chat.history.unnamed') || 'Chat senza nome'}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{dateString}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                        <FontAwesome name="comments-o" size={36} color={colors.textSecondary} />
                                        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>{t('chat.history.empty') || 'Nessuna chat'}</Text>
                                    </View>
                                }
                            />
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* Main Content */}
            <View style={styles.flex}>
                {/* Wellness Banner */}
                {wellnessSuggestion?.shouldShowBanner && wellnessSuggestion?.suggestion && (
                    <View style={styles.wellnessBanner}>
                        <LinearGradient colors={['#10b981', '#059669']} style={styles.wellnessBannerGradient}>
                            <View style={styles.wellnessBannerContent}>
                                <FontAwesome name="lightbulb-o" size={20} color="#fff" />
                                <View style={styles.wellnessBannerText}>
                                    <Text style={styles.wellnessBannerTitle}>{wellnessSuggestion.suggestion.title}</Text>
                                    <Text style={styles.wellnessBannerDescription}>{wellnessSuggestion.suggestion.description}</Text>
                                </View>
                                <TouchableOpacity style={styles.wellnessBannerButton} onPress={() => setShowWellnessPopup(true)}>
                                    <FontAwesome name="arrow-right" size={16} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.wellnessBannerCloseButton} onPress={() => setWellnessSuggestion(null)}>
                                    <FontAwesome name="times" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* Voice Interface */}
                <ModernVoiceChat
                    visible={showVoiceInterface}
                    onClose={closeVoiceInterface}
                    onVoiceInput={handleVoiceInput}
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    isProcessing={isProcessing}
                    transcript={transcript}
                    userContext={aiContext}
                    aiContext={aiContext}
                    currentUser={currentUser}
                    currentUserProfile={currentUserProfile}
                    onAddWellnessActivity={handleAddWellnessActivity}
                />

                {/* Chat Content */}
                <View style={styles.scrollArea}>
                    {/* Messages */}
                    <FlatList
                        data={messages}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item: message }) => (
                            <View style={[styles.messageWrapper, message.sender === 'user' ? styles.userWrapper : styles.aiWrapper]}>
                                <View style={[
                                    styles.messageBubble,
                                    message.sender === 'user'
                                        ? styles.userBubble
                                        : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
                                ]}>
                                    {message.sender === 'ai' ? (
                                        <Markdown style={chatMarkdownStyles(themeMode, colors)}>{message.text}</Markdown>
                                    ) : (
                                        <Text style={[styles.messageText, styles.userMessageText]}>{message.text}</Text>
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
                </View>

                {/* Input Area */}
                {!showVoiceInterface && (
                    <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                        <View style={[styles.inputWrapper, { backgroundColor: surfaceSecondary, borderColor: colors.border, flex: 1, marginRight: 8 }]}>
                            <TextInput
                                style={[styles.textInput, { color: colors.text }]}
                                placeholder={t('chat.placeholder')}
                                placeholderTextColor={colors.textTertiary}
                                value={inputValue}
                                onChangeText={setInputValue}
                                onFocus={handleInputFocus}
                                multiline
                                maxLength={1000}
                                editable={!isSending}
                            />
                        </View>

                        {inputValue.trim().length > 0 ? (
                            <TouchableOpacity onPress={handleSendMessage} disabled={isSending} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                                {isSending ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <MaterialCommunityIcons name="arrow-up" size={20} color="#fff" />
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    setShowVoiceInterface(true);
                                    setVoiceModeDismissed(false);
                                }}
                                style={[styles.micButton, { backgroundColor: surfaceSecondary }]}
                            >
                                <MaterialCommunityIcons name="microphone" size={20} color={colors.text} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Keyboard spacer */}
                <Animated.View style={fakeViewStyle} />
            </View>

            {/* Modals */}
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
                title={pendingSuggestion ? `Seleziona orario per ${pendingSuggestion.title}` : undefined}
            />

            {/* Chat Menu Modal */}
            <Modal visible={showChatMenu} transparent animationType="fade" onRequestClose={() => setShowChatMenu(false)}>
                <TouchableOpacity style={styles.menuModalBackdrop} activeOpacity={1} onPress={() => setShowChatMenu(false)}>
                    <View style={[styles.menuModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.menuModalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.menuModalTitle, { color: colors.text }]}>Opzioni Chat</Text>
                            <TouchableOpacity
                                onPress={() => setShowChatMenu(false)}
                                style={{ padding: 8 }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <FontAwesome name="times" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuOptions}>
                            <TouchableOpacity
                                style={[styles.menuOption, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    setShowChatMenu(false);
                                    setShowChatSettings(true);
                                }}
                            >
                                <FontAwesome name="sliders" size={18} color={colors.textSecondary} />
                                <Text style={[styles.menuOptionText, { fontFamily: 'Figtree_400Regular' }, { color: colors.text }]}>Comportamento Assistente</Text>
                                <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.menuOption, styles.menuOptionLast]}
                                onPress={() => {
                                    setShowChatMenu(false);
                                    handleClearChat();
                                }}
                            >
                                <FontAwesome name="trash" size={18} color={colors.textSecondary} />
                                <Text style={[styles.menuOptionText, { fontFamily: 'Figtree_400Regular' }, { color: colors.text }]}>Cancella conversazione</Text>
                            </TouchableOpacity>
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

                        <View style={styles.settingsModalBody}>
                            {/* Tone */}
                            <View style={styles.settingsSection}>
                                <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Tono del coach</Text>
                                <View style={styles.settingsOptions}>
                                    {(['empathetic', 'neutral', 'motivational', 'professional'] as ChatTone[]).map((tone) => (
                                        <TouchableOpacity
                                            key={tone}
                                            style={[
                                                styles.settingsOption,
                                                { borderColor: colors.border },
                                                chatSettings.tone === tone && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                                            ]}
                                            onPress={async () => {
                                                const updated = { ...chatSettings, tone };
                                                setChatSettings(updated);
                                                await ChatSettingsService.saveSettings(updated);
                                            }}
                                        >
                                            <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.tone === tone && { color: colors.primary, fontFamily: 'Figtree_700Bold' }]}>
                                                {tone === 'empathetic' ? 'Empatico' : tone === 'neutral' ? 'Neutro' : tone === 'motivational' ? 'Motivante' : 'Professionale'}
                                            </Text>
                                            {chatSettings.tone === tone && <FontAwesome name="check" size={14} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Response Length */}
                            <View style={styles.settingsSection}>
                                <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Lunghezza risposta</Text>
                                <View style={styles.settingsOptions}>
                                    {(['short', 'standard', 'detailed'] as ResponseLength[]).map((length) => (
                                        <TouchableOpacity
                                            key={length}
                                            style={[
                                                styles.settingsOption,
                                                { borderColor: colors.border },
                                                chatSettings.responseLength === length && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                                            ]}
                                            onPress={async () => {
                                                const updated = { ...chatSettings, responseLength: length };
                                                setChatSettings(updated);
                                                await ChatSettingsService.saveSettings(updated);
                                            }}
                                        >
                                            <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.responseLength === length && { color: colors.primary, fontFamily: 'Figtree_700Bold' }]}>
                                                {length === 'short' ? 'Breve' : length === 'standard' ? 'Standard' : 'Dettagliata'}
                                            </Text>
                                            {chatSettings.responseLength === length && <FontAwesome name="check" size={14} color={colors.primary} />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Action Steps Toggle */}
                            <View style={styles.settingsSection}>
                                <View style={styles.settingsToggleRow}>
                                    <Text style={[styles.settingsSectionTitle, { color: colors.primary }]}>Passi d'azione automatici</Text>
                                    <Switch
                                        value={chatSettings.includeActionSteps}
                                        onValueChange={async (value) => {
                                            const updated = { ...chatSettings, includeActionSteps: value };
                                            setChatSettings(updated);
                                            await ChatSettingsService.saveSettings(updated);
                                        }}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                    />
                                </View>
                                <View style={{ marginBottom: 16 }} />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaWrapper>
    );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Figtree_700Bold', // Was 600
    },
    scrollArea: {
        flex: 1,
    },
    quickRepliesContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    quickRepliesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    quickRepliesHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quickRepliesToggleText: {
        fontSize: 13,
        fontFamily: 'Figtree_500Medium', // Was 500
    },
    quickRepliesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    quickReplyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 8,
    },
    quickReplyText: {
        fontSize: 13,
        fontFamily: 'Figtree_700Bold', // Was 600
    },
    messageWrapper: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    userWrapper: {
        alignItems: 'flex-end',
    },
    aiWrapper: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '85%',
        borderRadius: 20,
        padding: 14,
    },
    userBubble: {
        backgroundColor: '#6366f1',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        borderWidth: 1,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#fff',
    },
    timestamp: {
        fontSize: 11,
        marginTop: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 44,
        maxHeight: 120,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wellnessBanner: {
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    wellnessBannerGradient: {
        padding: 12,
    },
    wellnessBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    wellnessBannerText: {
        flex: 1,
    },
    wellnessBannerTitle: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Figtree_700Bold', // Was 700
    },
    wellnessBannerDescription: {
        color: '#fff',
        fontSize: 12,
        opacity: 0.9,
    },
    wellnessBannerButton: {
        padding: 8,
    },
    wellnessBannerCloseButton: {
        padding: 8,
    },
    menuModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    menuModalContent: {
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    menuModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    menuModalTitle: {
        fontSize: 17,
        fontFamily: 'Figtree_700Bold', // Was 700
    },
    menuOptions: {
        paddingVertical: 8,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        gap: 12,
    },
    menuOptionText: {
        flex: 1,
        fontSize: 15,
    },
    menuOptionLast: {
        borderBottomWidth: 0,
    },
    settingsModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    settingsModalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        maxHeight: '80%',
    },
    settingsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    settingsModalTitle: {
        fontSize: 17,
        fontFamily: 'Figtree_700Bold', // Was 700
    },
    settingsModalBody: {
        padding: 16,
    },
    settingsSection: {
        marginBottom: 20,
    },
    settingsSectionTitle: {
        fontSize: 14,
        fontFamily: 'Figtree_700Bold', // Was 600
        marginBottom: 10,
    },
    settingsOptions: {
        gap: 8,
    },
    settingsOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    settingsOptionText: {
        fontSize: 15,
        fontFamily: 'Figtree_400Regular', // Was 400
    },
    settingsToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});

export default ChatOnlyScreen;
