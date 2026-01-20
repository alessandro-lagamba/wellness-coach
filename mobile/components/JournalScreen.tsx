/**
 * JournalScreen - Standalone Journal Component
 * Extracted from ChatScreen.tsx for better maintainability
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StyleSheet,
    Dimensions,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';

// Services
import { DailyJournalService } from '../services/daily-journal.service';
import { DailyJournalDBService } from '../services/daily-journal-db.service';
import { AuthService } from '../services/auth.service';
import { JournalSettingsService, JournalTemplate, JOURNAL_TEMPLATES } from '../services/journal-settings.service';

// Hooks & Context
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';

// Components
import { EmptyStateCard } from './EmptyStateCard';
import { TimeMachineCalendar } from './TimeMachineCalendar';

// Utilities
import {
    JournalPromptContext,
    isLegacyJournalPrompt,
    getTodayKey,
    toISODateSafe,
    isFutureDate,
    isPastDate,
} from '../utils/chat-journal.utils';

const { width } = Dimensions.get('window');

interface JournalScreenProps {
    user?: any;
}

export const JournalScreen: React.FC<JournalScreenProps> = ({ user }) => {
    const { t, language } = useTranslation();
    const { colors, mode: themeMode } = useTheme();
    const { hideTabBar, showTabBar } = useTabBarVisibility();
    const router = useRouter();
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
    const [journalText, setJournalText] = useState('');
    const [originalJournalText, setOriginalJournalText] = useState('');
    const [journalPrompt, setJournalPrompt] = useState('');
    const [promptContext, setPromptContext] = useState<JournalPromptContext | null>(null);
    const [isPromptLoading, setIsPromptLoading] = useState(false);
    const [journalHistory, setJournalHistory] = useState<any[]>([]);
    const [selectedDayKey, setSelectedDayKey] = useState(() => getTodayKey());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [aiScore, setAiScore] = useState<number | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [showFullAnalysis, setShowFullAnalysis] = useState(false);
    const [monthDays, setMonthDays] = useState<string[]>([]);
    const [monthMoodMap, setMonthMoodMap] = useState<Record<string, number>>({});
    const [monthRestMap, setMonthRestMap] = useState<Record<string, number>>({});
    const [monthJournalMap, setMonthJournalMap] = useState<Record<string, { hasEntry: boolean; aiScore?: number }>>({});
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [showSavedChip, setShowSavedChip] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate>('free');
    const [showJournalSettings, setShowJournalSettings] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // Refs
    const journalScrollRef = useRef<ScrollView>(null);
    const monthStripScrollRef = useRef<ScrollView>(null);

    // ==================== LOAD USER ====================
    useEffect(() => {
        if (user?.id) {
            setCurrentUser(user);
        } else {
            AuthService.getCurrentUser().then(u => {
                if (u) setCurrentUser(u);
            });
        }
    }, [user?.id]);

    // ==================== LOAD TEMPLATE PREFERENCE ====================
    useEffect(() => {
        JournalSettingsService.getTemplate().then(setSelectedTemplate);
    }, []);

    // ==================== BUILD MONTH DAYS ====================
    useEffect(() => {
        const y = currentMonth.getFullYear();
        const m = currentMonth.getMonth();
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        const days: string[] = [];
        for (let d = first.getDate(); d <= last.getDate(); d++) {
            days.push(toISODateSafe(y, m, d));
        }
        setMonthDays(days);

        // Load mood/rest/journal data for the month
        (async () => {
            const moodPairs = await Promise.all(
                days.map(async (iso) => [iso, await AsyncStorage.getItem(`checkin:mood:${iso}`)] as const)
            );
            const restPairs = await Promise.all(
                days.map(async (iso) => [iso, await AsyncStorage.getItem(`checkin:rest_level:${iso}`)] as const)
            );
            const moodMap: Record<string, number> = {};
            const restMap: Record<string, number> = {};
            moodPairs.forEach(([k, v]) => { if (v) moodMap[k] = parseInt(v, 10); });
            restPairs.forEach(([k, v]) => { if (v) restMap[k] = parseInt(v, 10); });
            setMonthMoodMap(moodMap);
            setMonthRestMap(restMap);

            // Load journal entries from DB
            if (currentUser?.id) {
                try {
                    const firstDay = days[0];
                    const lastDay = days[days.length - 1];
                    const journalEntries = await DailyJournalDBService.listByDateRange(currentUser.id, firstDay, lastDay);
                    const journalMap: Record<string, { hasEntry: boolean; aiScore?: number }> = {};
                    journalEntries.forEach((entry: any) => {
                        journalMap[entry.entry_date] = {
                            hasEntry: true,
                            aiScore: entry.ai_score || undefined,
                        };
                    });
                    setMonthJournalMap(journalMap);
                } catch (e) {
                    console.error('Error loading journal entries:', e);
                    setMonthJournalMap({});
                }
            }
        })();
    }, [currentMonth, currentUser?.id]);

    // ==================== LOAD JOURNAL ENTRY ====================
    useEffect(() => {
        if (!currentUser?.id) return;
        let cancelled = false;

        const loadJournal = async () => {
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

            // Load context from database
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

                    const summaryData = typeof checkinData.summary === 'string'
                        ? (() => { try { return JSON.parse(checkinData.summary); } catch { return null; } })()
                        : checkinData.summary;
                    if (summaryData) {
                        summaryFocus = summaryData.focus || null;
                        summaryEnergy = summaryData.energy || null;
                    }
                }
            } catch (error) {
                moodNote = await AsyncStorage.getItem(`checkin:mood_note:${selectedDayKey}`);
                sleepNote = await AsyncStorage.getItem(`checkin:sleep_note:${selectedDayKey}`);
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

            if (!cancelled) setPromptContext(contextPayload);

            // Generate prompt if needed
            if (!sanitizedLocalPrompt) {
                const templatePrompt = JOURNAL_TEMPLATES[selectedTemplate]?.prompt ?? JOURNAL_TEMPLATES.free.prompt;
                let nextPrompt = templatePrompt;

                if (selectedTemplate === 'free') {
                    if (!cancelled) setIsPromptLoading(true);
                    try {
                        const smartPrompt = await DailyJournalService.generateDailyPrompt({
                            userId: currentUser.id,
                            language,
                            ...contextPayload,
                        });
                        if (!cancelled && smartPrompt) nextPrompt = smartPrompt;
                    } catch (error) {
                        console.error('Error generating journal prompt:', error);
                    } finally {
                        if (!cancelled) setIsPromptLoading(false);
                    }
                }

                if (!cancelled) setJournalPrompt(nextPrompt);
                await DailyJournalService.saveLocalEntry(selectedDayKey, localContent, nextPrompt);
            }

            // Load recent history
            try {
                const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
                if (!cancelled) setJournalHistory(recent);
            } catch (e) { /* ignore */ }

            // Load AI analysis
            try {
                const remoteEntry = await DailyJournalDBService.getEntryByDate(currentUser.id, selectedDayKey);
                if (!cancelled && remoteEntry) {
                    setAiScore((remoteEntry as any)?.ai_score ?? null);
                    setAiAnalysis((remoteEntry as any)?.ai_analysis ?? null);

                    // Hydrate from remote if local is empty
                    const remoteContent = remoteEntry.content ?? '';
                    if (remoteContent.trim().length > 0 && !hasLocalContent) {
                        const remotePromptRaw = (remoteEntry as any).ai_prompt ?? (remoteEntry as any).prompt ?? sanitizedLocalPrompt ?? '';
                        const remotePrompt = isLegacyJournalPrompt(remotePromptRaw) ? '' : remotePromptRaw;
                        if (!cancelled) {
                            setJournalText(remoteContent);
                            setOriginalJournalText(remoteContent);
                            setJournalPrompt(remotePrompt || sanitizedLocalPrompt);
                        }
                        await DailyJournalService.saveLocalEntry(selectedDayKey, remoteContent, remotePrompt || sanitizedLocalPrompt);
                    }
                }
            } catch (e) { /* ignore */ }
        };

        loadJournal();
        return () => { cancelled = true; };
    }, [currentUser?.id, selectedDayKey, selectedTemplate, language]);

    // ==================== AUTO-CENTER DAY STRIP ====================
    useEffect(() => {
        if (monthStripScrollRef.current && monthDays.length > 0) {
            const targetIndex = monthDays.indexOf(selectedDayKey);
            if (targetIndex >= 0) {
                const timer = setTimeout(() => {
                    if (monthStripScrollRef.current) {
                        const pillWidth = 52;
                        const gap = 8;
                        const totalWidth = pillWidth + gap;
                        const offsetRight = 205;
                        const scrollX = Math.max(0, targetIndex * totalWidth - (width / 2) + (totalWidth / 2) - offsetRight);
                        monthStripScrollRef.current.scrollTo({ x: scrollX, animated: true });
                    }
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [monthDays, selectedDayKey]);

    // ==================== HANDLERS ====================
    const handleRegeneratePrompt = useCallback(async () => {
        if (!currentUser?.id) return;
        const fallbackPrompt = JOURNAL_TEMPLATES[selectedTemplate]?.prompt ?? JOURNAL_TEMPLATES.free.prompt;

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

    const saveJournalEntry = useCallback(async (dayKey: string) => {
        if (!currentUser) return;

        await DailyJournalService.saveLocalEntry(dayKey, journalText, journalPrompt);

        try {
            let newAiScore = null, newAiAnalysis = null;

            if (journalText.trim().length > 10) {
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
                    newAiScore = aiJudgment.ai_score;
                    newAiAnalysis = aiJudgment.ai_analysis;
                    setAiScore(newAiScore);
                    setAiAnalysis(newAiAnalysis);
                }
            }

            await DailyJournalService.syncToRemote(currentUser.id, dayKey, journalText, journalPrompt, newAiScore, newAiAnalysis);
            const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
            setJournalHistory(recent);

            setMonthJournalMap(prev => ({
                ...prev,
                [dayKey]: { hasEntry: true, aiScore: newAiScore || undefined },
            }));

            const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLastSavedAt(ts);
            setShowSavedChip(true);
            setTimeout(() => setShowSavedChip(false), 2000);
            setOriginalJournalText(journalText);
            Alert.alert('Salvato', 'Journal salvato e analizzato correttamente');
        } catch (e) {
            console.error('Error saving journal entry:', e);
            Alert.alert('Offline', 'Journal salvato in locale, verrà sincronizzato.');
        }
    }, [currentUser, journalText, journalPrompt]);

    const handleSave = useCallback(async () => {
        if (!currentUser) return;
        const dayKey = selectedDayKey;
        const isPast = isPastDate(dayKey);
        const hasTextChanged = journalText.trim() !== originalJournalText.trim();

        if (isPast && hasTextChanged) {
            Alert.alert(
                t('journal.pastDateSave.title') || 'Modificare entry di un giorno passato?',
                t('journal.pastDateSave.message') || 'Stai modificando un entry di un giorno passato. Vuoi continuare?',
                [
                    { text: t('common.cancel') || 'Annulla', style: 'cancel' },
                    {
                        text: t('common.continue') || 'Continua',
                        onPress: () => saveJournalEntry(dayKey),
                    },
                ]
            );
            return;
        }

        await saveJournalEntry(dayKey);
    }, [currentUser, selectedDayKey, journalText, originalJournalText, t, saveJournalEntry]);

    const handleOpenEntry = useCallback((targetDay: string) => {
        setSelectedDayKey(targetDay);
        try {
            const [year, month] = targetDay.split('-').map(Number);
            const targetDate = new Date(year, month - 1, 1);
            if (currentMonth.getMonth() !== targetDate.getMonth() || currentMonth.getFullYear() !== targetDate.getFullYear()) {
                setCurrentMonth(targetDate);
            }
        } catch (error) {
            console.error('Error parsing date:', error);
        }
        journalScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, [currentMonth]);

    const handleClearEntry = useCallback(async () => {
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
                                setAiScore(null);
                                setAiAnalysis(null);
                                setOriginalJournalText('');
                                await DailyJournalService.saveLocalEntry(selectedDayKey, '', '');
                                setMonthJournalMap(prev => {
                                    const updated = { ...prev };
                                    delete updated[selectedDayKey];
                                    return updated;
                                });
                                const recent = await DailyJournalDBService.listRecent(currentUser.id, 10);
                                setJournalHistory(recent);
                                Alert.alert(
                                    t('common.success') || 'Successo',
                                    t('journal.clearEntry.success') || 'Entry cancellata'
                                );
                            }
                        } catch (error) {
                            console.error('Error clearing entry:', error);
                            Alert.alert(t('common.error') || 'Errore', 'Errore durante la cancellazione');
                        }
                    },
                },
            ]
        );
    }, [currentUser?.id, selectedDayKey, t]);

    // Markdown styles
    const markdownStyles = useMemo(() => ({
        body: { color: colors.text },
        paragraph: { marginVertical: 4, lineHeight: 22, fontSize: 15 },
        link: { color: colors.primary },
    }), [colors]);

    // ==================== RENDER ====================
    return (
        <SafeAreaWrapper style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: surfaceSecondary }]}>
                    <FontAwesome name="chevron-left" size={18} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('journal.title')}</Text>
                </View>
                <TouchableOpacity style={[styles.headerButton, { backgroundColor: surfaceSecondary }]} onPress={() => setShowMenu(true)}>
                    <FontAwesome name="cog" size={18} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                ref={journalScrollRef}
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Month Navigation */}
                <View style={styles.monthHeader}>
                    <TouchableOpacity
                        onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                        style={styles.monthNavBtn}
                    >
                        <Text style={styles.monthNavTxt}>{'<'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowMonthPicker(true)}
                        style={[styles.monthTitleWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                    >
                        <Text style={[styles.monthTitle, { color: colors.text }]}>
                            {currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        style={styles.monthNavBtn}
                    >
                        <Text style={styles.monthNavTxt}>{'>'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Day Strip */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.monthStrip}
                    contentContainerStyle={styles.monthStripContent}
                    ref={monthStripScrollRef}
                >
                    {monthDays.map((iso) => {
                        const mood = monthMoodMap[iso];
                        const rest = monthRestMap[iso];
                        const journal = monthJournalMap[iso];

                        let color = '#e2e8f0';
                        if (journal?.hasEntry && journal.aiScore) {
                            color = DailyJournalService.colorForScore(journal.aiScore);
                        } else if (mood) {
                            color = mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981';
                        } else if (rest) {
                            color = rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399';
                        } else if (journal?.hasEntry) {
                            color = '#6366f1';
                        }

                        const active = iso === selectedDayKey;
                        const dayNum = parseInt(iso.slice(8, 10), 10);
                        const hasEntry = journal?.hasEntry || false;
                        const isFuture = isFutureDate(iso);

                        return (
                            <TouchableOpacity
                                key={iso}
                                onPress={() => !isFuture && setSelectedDayKey(iso)}
                                disabled={isFuture}
                                style={[
                                    styles.dayPill,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                    active && { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
                                    isFuture && { opacity: 0.4 },
                                ]}
                            >
                                {hasEntry && <View style={[styles.colorDot, { backgroundColor: color }]} />}
                                <Text style={[
                                    styles.dayText,
                                    { color: colors.text },
                                    active && { color: '#3730a3', fontWeight: '800' },
                                    isFuture && { color: colors.textTertiary },
                                ]}>
                                    {String(dayNum)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* TimeMachine Calendar Modal */}
                <TimeMachineCalendar
                    visible={showMonthPicker}
                    onClose={() => setShowMonthPicker(false)}
                    onSelectDate={(date) => {
                        const iso = toISODateSafe(date.getFullYear(), date.getMonth(), date.getDate());
                        setSelectedDayKey(iso);
                    }}
                    onMonthChange={async (year, month) => {
                        if (!currentUser?.id) return;
                        try {
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const firstDay = toISODateSafe(year, month, 1);
                            const lastDay = toISODateSafe(year, month, daysInMonth);
                            const journalEntries = await DailyJournalDBService.listByDateRange(currentUser.id, firstDay, lastDay);
                            const journalMap: Record<string, { hasEntry: boolean; aiScore?: number }> = {};
                            journalEntries.forEach((entry: any) => {
                                journalMap[entry.entry_date] = { hasEntry: true, aiScore: entry.ai_score || undefined };
                            });
                            setMonthJournalMap(prev => ({ ...prev, ...journalMap }));
                        } catch (e) {
                            console.error('Error loading calendar data:', e);
                        }
                    }}
                    getDayMarker={(dateStr) => {
                        const mood = monthMoodMap[dateStr];
                        const rest = monthRestMap[dateStr];
                        const journal = monthJournalMap[dateStr];

                        let color = '#e2e8f0';
                        let hasMarker = false;

                        if (journal?.hasEntry && journal.aiScore) {
                            color = DailyJournalService.colorForScore(journal.aiScore);
                            hasMarker = true;
                        } else if (mood) {
                            color = mood <= 2 ? '#ef4444' : mood === 3 ? '#f59e0b' : '#10b981';
                            hasMarker = true;
                        } else if (rest) {
                            color = rest <= 2 ? '#f87171' : rest === 3 ? '#f59e0b' : '#34d399';
                            hasMarker = true;
                        } else if (journal?.hasEntry) {
                            color = '#6366f1';
                            hasMarker = true;
                        }

                        return { hasMarker, color };
                    }}
                    language={language}
                    isDark={themeMode === 'dark'}
                    showYearSelector={true}
                    headerLabel={t('journal.title').toUpperCase()}
                    headerIcon="book-open-page-variant"
                    title={language === 'it' ? 'Seleziona Data' : 'Select Date'}
                    subtitle={language === 'it' ? 'Sfoglia il tuo diario' : 'Browse your journal'}
                    confirmText={language === 'it' ? 'VAI ALLA DATA' : 'GO TO DATE'}
                />

                {/* Prompt Section */}
                {journalPrompt ? (
                    <LinearGradient
                        colors={themeMode === 'dark' ? ['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.1)'] : ['#EEF2FF', '#FFFFFF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
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

                {/* Editor Section */}
                <View style={styles.journalEditorWrap}>
                    <BlurView intensity={12} tint="light" style={styles.journalBlur} />
                    <View style={styles.journalEditorHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.editorTitle, { color: colors.text }]}>{t('journal.entryTitle')}</Text>
                            <View style={[styles.dateChip, { backgroundColor: surfaceSecondary }]}>
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
                        maxLength={2000}
                    />
                    <View style={styles.journalActions}>
                        <TouchableOpacity style={styles.journalSave} onPress={handleSave}>
                            <Text style={styles.journalSaveText}>{t('journal.save')}</Text>
                        </TouchableOpacity>
                    </View>
                    {showSavedChip && lastSavedAt && (
                        <View style={styles.savedChip}>
                            <Text style={styles.savedChipText}>{t('journal.savedAt', { time: lastSavedAt })}</Text>
                        </View>
                    )}
                </View>

                {/* AI Insight */}
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

                {/* Recent Entries */}
                {journalHistory?.length > 0 ? (
                    <View style={styles.journalHistory}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journal.latestNotes')}</Text>
                        {journalHistory.slice(0, 7).map((it) => (
                            <View key={it.id} style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={styles.historyHeader}>
                                    <View style={styles.dateChipSm}>
                                        <Text style={styles.dateChipSmText}>{it.entry_date}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleOpenEntry(it.entry_date)}>
                                        <Text style={styles.openTxt}>{t('journal.open')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.historyPreviewBox}>
                                    <Markdown style={markdownStyles}>{it.content}</Markdown>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <EmptyStateCard type="journal" onAction={() => { }} />
                )}
            </ScrollView>

            {/* Full Analysis Modal */}
            <Modal visible={showFullAnalysis} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('journal.completeAnalysis')}</Text>
                            <TouchableOpacity onPress={() => setShowFullAnalysis(false)} style={styles.modalClose}>
                                <FontAwesome name="times" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {aiAnalysis && <Text style={[styles.modalText, { color: colors.text }]}>{aiAnalysis}</Text>}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Menu Modal */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={styles.menuModalBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)}>
                    <View style={[styles.menuModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.menuModalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.menuModalTitle, { color: colors.text }]}>Opzioni Journal</Text>
                            <TouchableOpacity onPress={() => setShowMenu(false)}>
                                <FontAwesome name="times" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.menuOptions}>
                            <TouchableOpacity
                                style={[styles.menuOption, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    setShowMenu(false);
                                    setShowJournalSettings(true);
                                }}
                            >
                                <FontAwesome name="file-text" size={18} color={colors.textSecondary} />
                                <Text style={[styles.menuOptionText, { color: colors.text }]}>Template di scrittura</Text>
                                <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.menuOption, styles.menuOptionLast]}
                                onPress={() => {
                                    setShowMenu(false);
                                    handleClearEntry();
                                }}
                            >
                                <FontAwesome name="trash" size={18} color={colors.textSecondary} />
                                <Text style={[styles.menuOptionText, { color: colors.text }]}>Cancella entry corrente</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
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
                                        selectedTemplate === template.id && template.id !== 'free' && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
                                    ]}
                                    onPress={async () => {
                                        setSelectedTemplate(template.id);
                                        await JournalSettingsService.saveTemplate(template.id);
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

// ==================== STYLES ====================
const styles = StyleSheet.create({
    container: {
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
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    monthNavBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    monthNavTxt: {
        fontSize: 20,
        fontWeight: '700',
        color: '#6366f1',
    },
    monthTitleWrap: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    monthStrip: {
        marginBottom: 16,
    },
    monthStripContent: {
        paddingHorizontal: 8,
        gap: 8,
    },
    dayPill: {
        width: 52,
        height: 72,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    colorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginBottom: 4,
    },
    dayText: {
        fontSize: 16,
        fontWeight: '600',
    },
    journalPromptGrad: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    journalPromptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    journalPromptTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    journalPromptText: {
        fontSize: 15,
        lineHeight: 22,
        fontStyle: 'italic',
    },
    pillSecondary: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    pillSecondaryText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pillSecondaryDisabled: {
        opacity: 0.5,
    },
    journalEditorWrap: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
    },
    journalBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    journalEditorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 8,
    },
    editorTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    dateChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dateChipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    counterText: {
        fontSize: 12,
    },
    journalInput: {
        padding: 16,
        paddingTop: 8,
        fontSize: 15,
        lineHeight: 22,
        minHeight: 200,
        textAlignVertical: 'top',
    },
    journalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
        paddingTop: 8,
    },
    journalSave: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    journalSaveText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    savedChip: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        backgroundColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    savedChipText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    aiInsightCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    aiInsightHeader: {
        marginBottom: 12,
    },
    aiInsightTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    aiInsightIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#eef2ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiInsightIconText: {
        fontSize: 16,
    },
    aiInsightTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    aiInsightContent: {},
    aiInsightSummary: {
        fontSize: 14,
        lineHeight: 20,
    },
    journalHistory: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    historyCard: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateChipSm: {
        backgroundColor: '#eef2ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    dateChipSmText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6366f1',
    },
    openTxt: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366f1',
    },
    historyPreviewBox: {
        maxHeight: 60,
        overflow: 'hidden',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '80%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalClose: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    modalText: {
        fontSize: 15,
        lineHeight: 22,
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
    templateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    templateOptionContent: {
        flex: 1,
    },
    templateOptionName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    templateOptionDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
});

export default JournalScreen;
