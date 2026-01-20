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
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
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
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { SkinAnalysisService } from '../services/skin-analysis.service';
import { AIContextService } from '../services/ai-context.service';
import { AuthService } from '../services/auth.service';
import { AnalysisIntentService } from '../services/analysis-intent.service';
import { ChatSettingsService, ChatTone, ResponseLength } from '../services/chat-settings.service';
import { ExportService } from '../services/export.service';
import { DailyJournalDBService } from '../services/daily-journal-db.service';
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
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    heading1: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: 8,
    },
    heading2: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600' as const,
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
    const [chatHistory, setChatHistory] = useState<any[]>([]);
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

    // Quick replies - memoized
    const quickReplies = useMemo(() => [
        { text: t('chat.quickStart.feelingStressed'), icon: 'heartbeat', color: '#ef4444' },
        { text: t('chat.quickStart.sleepBetter'), icon: 'moon-o', color: '#8b5cf6' },
        { text: t('chat.quickStart.energyTips'), icon: 'bolt', color: '#f59e0b' },
        { text: t('chat.quickStart.skinAdvice'), icon: 'tint', color: '#3b82f6' },
    ], [t]);

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
                if (currentUser?.id) {
                    const context = await AIContextService.getCompleteContext(currentUser.id, true);
                    setAiContext(context);

                    const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
                    const sessionDate = new Date().toLocaleDateString(dateLocale);
                    const session = await ChatService.createChatSession(
                        currentUser.id,
                        t('chat.sessionName', { date: sessionDate }),
                        context.currentEmotion ? {
                            dominantEmotion: context.currentEmotion.emotion,
                            valence: context.currentEmotion.valence,
                            arousal: context.currentEmotion.arousal,
                            confidence: context.currentEmotion.confidence,
                        } : undefined
                    );
                    if (session) setCurrentSessionId(session.id);
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
            if (!currentUser?.id) return;
            try {
                const sessions = await ChatService.getUserChatSessions(currentUser.id, 20);
                setChatHistory(sessions);
            } catch (error) {
                console.error('Error loading chat history:', error);
            }
        };
        loadHistory();
    }, [currentUser?.id]);

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
            // Save user message
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
                        confidence: aiContext.currentEmotion.confidence,
                    } : undefined
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
                    sessionId: currentSessionId,
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

            // Save AI message
            if (currentUser && currentSessionId) {
                await ChatService.saveChatMessage(
                    currentSessionId,
                    currentUser.id,
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
            router.replace('/(tabs)/coach');
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

    const handleClearChat = () => {
        Alert.alert(
            t('chat.clearChat.title') || 'Cancella conversazione',
            t('chat.clearChat.message') || 'Vuoi cancellare tutti i messaggi?',
            [
                { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                {
                    text: t('common.delete') || 'Cancella',
                    style: 'destructive',
                    onPress: () => {
                        setMessages([{
                            id: 'welcome',
                            text: getInitialMessage(),
                            sender: 'ai',
                            timestamp: new Date(),
                        }]);
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
                    {chatHistory.length > 0 && (
                        <TouchableOpacity
                            style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
                            onPress={() => setShowChatHistory(!showChatHistory)}
                        >
                            <FontAwesome name="history" size={18} color={colors.text} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}
                        onPress={() => setShowChatMenu(true)}
                    >
                        <FontAwesome name="cog" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

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
                    {/* Quick Replies */}
                    <View style={styles.quickRepliesContainer}>
                        <TouchableOpacity
                            style={styles.quickRepliesToggle}
                            onPress={() => setQuickRepliesExpanded(!quickRepliesExpanded)}
                        >
                            <View style={styles.quickRepliesHeaderLeft}>
                                <FontAwesome name="lightbulb-o" size={14} color={colors.textSecondary} />
                                <Text style={[styles.quickRepliesToggleText, { color: colors.textSecondary }]}>
                                    {t('chat.quickStart.toggle') || 'Messaggi suggeriti'}
                                </Text>
                            </View>
                            <FontAwesome name={quickRepliesExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {quickRepliesExpanded && (
                            <View style={styles.quickRepliesGrid}>
                                {quickReplies.map((reply) => (
                                    <TouchableOpacity
                                        key={reply.text}
                                        style={[styles.quickReplyCard, { backgroundColor: `${reply.color}15` }]}
                                        onPress={() => {
                                            handleQuickReply(reply.text);
                                            setQuickRepliesExpanded(false);
                                        }}
                                    >
                                        <FontAwesome name={reply.icon as any} size={16} color={reply.color} />
                                        <Text style={[styles.quickReplyText, { color: reply.color }]}>{reply.text}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

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
                            <TouchableOpacity onPress={() => setShowChatMenu(false)}>
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
                                <Text style={[styles.menuOptionText, { color: colors.text }]}>Comportamento Assistente</Text>
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
                                <Text style={[styles.menuOptionText, { color: colors.text }]}>Cancella conversazione</Text>
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
                                            <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.tone === tone && { color: colors.primary, fontWeight: '700' }]}>
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
                                            <Text style={[styles.settingsOptionText, { color: colors.text }, chatSettings.responseLength === length && { color: colors.primary, fontWeight: '700' }]}>
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
        fontWeight: '600',
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
        fontWeight: '500',
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
        fontWeight: '600',
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
        fontWeight: '700',
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
        justifyContent: 'flex-end',
    },
    menuModalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
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
        fontWeight: '700',
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
        fontWeight: '700',
    },
    settingsModalBody: {
        padding: 16,
    },
    settingsSection: {
        marginBottom: 20,
    },
    settingsSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
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
    },
    settingsToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
});

export default ChatOnlyScreen;
