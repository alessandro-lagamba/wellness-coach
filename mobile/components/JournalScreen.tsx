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
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import { DailySnapshotScreen } from './DailySnapshotScreen';

// Services
import { DailyJournalService } from '../services/daily-journal.service';
import { DailyJournalDBService } from '../services/daily-journal-db.service';
import { AuthService } from '../services/auth.service';

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
    const isDark = themeMode === 'dark';
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
    const [showMenu, setShowMenu] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dailyMetrics, setDailyMetrics] = useState<{ mood: number | null, moodNote: string | null, sleep: number | null, sleepQuality: number | null, energy: string | null, focus: string | null } | null>(null);

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

            // Load context from database for analysis
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

            if (!cancelled) {
                setPromptContext(contextPayload);
                setDailyMetrics({
                    mood: moodScore,
                    moodNote,
                    sleep: sleepHours,
                    sleepQuality,
                    energy: summaryEnergy,
                    focus: summaryFocus
                });
            }


            // Fixed prompt: "Come ti senti oggi?"
            const fixedPrompt = "Come ti senti oggi?";
            if (!cancelled) setJournalPrompt(fixedPrompt);
            await DailyJournalService.saveLocalEntry(selectedDayKey, localContent, fixedPrompt);

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
    }, [currentUser?.id, selectedDayKey, language]);

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

    // Auto-scroll to center selected day
    useEffect(() => {
        if (monthDays.length > 0 && selectedDayKey && monthStripScrollRef.current) {
            const index = monthDays.indexOf(selectedDayKey);
            if (index !== -1) {
                // Item width (52) + gap (8) = 60
                const ITEM_WIDTH = 60;
                // Calculate offset to center the item
                // offset = (index * ITEM_WIDTH) - (SCREEN_WIDTH / 2) + (ITEM_WIDTH / 2)
                const offset = (index * ITEM_WIDTH) - (width / 2) + (ITEM_WIDTH / 2);

                // Ensure we don't scroll past boundaries (though ScrollView handles this gracefully)
                const targetOffset = Math.max(0, offset);

                setTimeout(() => {
                    monthStripScrollRef.current?.scrollTo({ x: targetOffset, animated: true });
                }, 100); // Small delay to ensure layout is ready
            }
        }
    }, [selectedDayKey, monthDays]);

    // ==================== HANDLERS ====================


    const saveJournalEntry = useCallback(async (dayKey: string) => {
        if (!currentUser) return;
        setIsSaving(true);

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
        } finally {
            setIsSaving(false);
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
                    <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling={false}>{t('journal.title')}</Text>
                </View>
                <View style={{ width: 40 }} />
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
                        <Text style={styles.monthNavTxt} allowFontScaling={false}>{'<'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowMonthPicker(true)}
                        style={[styles.monthTitleWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                    >
                        <Text style={[styles.monthTitle, { color: colors.text }]} allowFontScaling={false}>
                            {currentMonth.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        style={styles.monthNavBtn}
                    >
                        <Text style={styles.monthNavTxt} allowFontScaling={false}>{'>'}</Text>
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
                                // Only mark if there is actual content
                                if (entry.content && entry.content.trim().length > 0) {
                                    journalMap[entry.entry_date] = { hasEntry: true, aiScore: entry.ai_score || undefined };
                                }
                            });
                            setMonthJournalMap(prev => ({ ...prev, ...journalMap }));
                        } catch (e) {
                            console.error('Error loading calendar data:', e);
                        }
                    }}
                    getDayMarker={(dateStr) => {
                        const journal = monthJournalMap[dateStr];

                        let color = '#e2e8f0';
                        let hasMarker = false;

                        if (journal?.hasEntry) {
                            hasMarker = true;
                            if (journal.aiScore) {
                                color = DailyJournalService.colorForScore(journal.aiScore);
                            } else {
                                // Entry exists but no AI score yet - use indigo to indicate "Journaled"
                                color = '#6366f1';
                            }
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

                {/* Editor Section (Only if Today) */}
                {selectedDayKey === toISODateSafe(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && (
                    <View style={styles.journalEditorWrap}>
                        <BlurView intensity={12} tint="light" style={styles.journalBlur} />
                        <View style={styles.journalEditorHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={[styles.editorTitle, { color: colors.text }]}>Come stai?</Text>
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
                            <TouchableOpacity
                                style={[styles.journalSave, isSaving && { opacity: 0.8 }]}
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.journalSaveText}>{t('journal.save')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {showSavedChip && lastSavedAt && (
                            <View style={styles.savedChip}>
                                <Text style={styles.savedChipText}>{t('journal.savedAt', { time: lastSavedAt })}</Text>
                            </View>
                        )}
                    </View>
                )}
                {/* HISTORICAL RECAP VIEW (If not today) */}
                {!isFutureDate(selectedDayKey) && selectedDayKey !== toISODateSafe(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && (
                    <View style={styles.historicalRecapContainer}>

                        {/* 1. Daily Snapshot Strip */}
                        <TouchableOpacity style={styles.dailySnapshotStrip} onPress={() => setShowFullAnalysis(true)}>
                            <View style={styles.dailySnapshotLeft}>
                                <View style={styles.dailySnapshotIcon}>
                                    <MaterialCommunityIcons name="chart-pie" size={24} color="#6366f1" />
                                </View>
                                <View>
                                    <Text style={[styles.dailySnapshotTitle, { color: colors.text }]}>{t('home.dailySnapshot.title')}</Text>
                                    <Text style={styles.dailySnapshotSubtitle}>Analisi completa</Text>
                                </View>
                            </View>
                            <View style={styles.dailySnapshotRight}>
                                {/* Mood */}
                                <View style={styles.snapshotMetricIcon}>
                                    <MaterialCommunityIcons
                                        name={dailyMetrics?.mood ? (dailyMetrics.mood >= 4 ? 'emoticon-happy-outline' : dailyMetrics.mood >= 3 ? 'emoticon-neutral-outline' : 'emoticon-sad-outline') : 'emoticon-outline'}
                                        size={20}
                                        color={dailyMetrics?.mood ? (dailyMetrics.mood >= 4 ? '#10b981' : dailyMetrics.mood >= 3 ? '#f59e0b' : '#ef4444') : colors.textTertiary}
                                    />
                                    {dailyMetrics?.mood && <View style={[styles.metricBar, { backgroundColor: dailyMetrics.mood >= 4 ? '#10b981' : dailyMetrics.mood >= 3 ? '#f59e0b' : '#ef4444', width: 8 + (dailyMetrics.mood * 3) }]} />}
                                </View>

                                {/* Sleep */}
                                <View style={styles.snapshotMetricIcon}>
                                    <MaterialCommunityIcons name="bed-outline" size={20} color={dailyMetrics?.sleep ? '#6366f1' : colors.textTertiary} />
                                    {dailyMetrics?.sleep && <View style={[styles.metricBar, { backgroundColor: '#6366f1', width: Math.min(Math.max(dailyMetrics.sleep * 2, 8), 24) }]} />}
                                </View>

                                {/* Energy */}
                                <View style={styles.snapshotMetricIcon}>
                                    <MaterialCommunityIcons name="lightning-bolt-outline" size={20} color={dailyMetrics?.energy ? '#eab308' : colors.textTertiary} />
                                    {dailyMetrics?.energy && <View style={[styles.metricBar, { backgroundColor: '#eab308', width: 16 }]} />}
                                </View>

                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                            </View>
                        </TouchableOpacity>

                        {/* 2. Read-Only Journal Card */}
                        {journalText.trim().length > 0 ? (
                            <View style={styles.readOnlyJournalCard}>
                                <View style={styles.readOnlyJournalHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#6366f1" />
                                        <Text style={styles.readOnlyJournalLabel}>DIARIO</Text>
                                    </View>
                                    <Text style={styles.readOnlyTimeLabel}>18:42</Text>
                                </View>
                                <Text style={[styles.readOnlyJournalText, { color: colors.text }]}>
                                    "{journalText}"
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.emptyHistoryCard}>
                                <Text style={{ color: colors.textTertiary, fontStyle: 'italic' }}>Nessuna entry per questo giorno.</Text>
                            </View>
                        )}

                        {/* 3. Detailed AI Reflection (Editorial Style - Refined) */}
                        {journalText.trim().length > 0 && aiAnalysis && (
                            <View style={[
                                styles.historicalReflectionCard,
                                {
                                    backgroundColor: isDark ? '#1c1917' : '#fafaf9', // Stone 50/900
                                    padding: 24,
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    marginTop: -8 // Pull up slightly closer to journal card
                                }
                            ]}>
                                <View style={styles.historicalReflectionHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="creation" size={24} color="#f59e0b" />
                                        <View>
                                            <Text style={[styles.historicalReflectionTitle, { color: colors.text, fontSize: 16, fontStyle: 'italic' }]}>Riflessione</Text>
                                        </View>
                                    </View>

                                    {aiScore !== null && (
                                        <View style={[
                                            styles.sentimentBadge,
                                            {
                                                backgroundColor: DailyJournalService.colorForScore(aiScore),
                                                borderColor: DailyJournalService.colorForScore(aiScore),
                                                paddingHorizontal: 10,
                                                paddingVertical: 6
                                            }
                                        ]}>
                                            <Text style={[styles.sentimentBadgeText, { color: '#ffffff', fontSize: 11, fontWeight: '700' }]}>
                                                {aiScore === 3 ? 'Positivo' : aiScore === 2 ? 'Neutrale' : 'Negativo'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={[styles.historicalReflectionText, { color: colors.textSecondary, marginBottom: 0, lineHeight: 24, fontSize: 15 }]}>
                                    {aiAnalysis}
                                </Text>
                            </View>
                        )}
                    </View>
                )}



                {/* Refined AI Insight (Reflection) - TODAY ONLY */}
                {
                    selectedDayKey === toISODateSafe(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && journalText.trim().length > 0 && aiAnalysis && (
                        <View style={styles.reflectionCardWrapper}>
                            <View style={[styles.reflectionCard, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                {/* Mesh Gradient Background */}
                                <View style={styles.meshBackground}>
                                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                                        <Defs>
                                            <RadialGradient id="grad1" cx="0%" cy="0%" rx="60%" ry="60%">
                                                <Stop offset="0%" stopColor={isDark ? "rgba(88, 28, 135, 0.3)" : "rgba(238, 210, 255, 0.5)"} stopOpacity="1" />
                                                <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                            </RadialGradient>
                                            <RadialGradient id="grad2" cx="100%" cy="100%" rx="60%" ry="60%">
                                                <Stop offset="0%" stopColor={isDark ? "rgba(15, 75, 120, 0.3)" : "rgba(196, 235, 255, 0.5)"} stopOpacity="1" />
                                                <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                            </RadialGradient>
                                        </Defs>
                                        <Rect x="0" y="0" width="100%" height="100%" fill={isDark ? colors.surface : "#ffffff"} fillOpacity={isDark ? 0.3 : 0.4} />
                                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad1)" />
                                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad2)" />
                                    </Svg>
                                    <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                                </View>

                                <View style={styles.reflectionContent}>
                                    <View style={styles.reflectionHeader}>
                                        <View style={styles.reflectionIconBadge}>
                                            <MaterialCommunityIcons name="auto-fix" size={16} color={isDark ? "#818cf8" : "#6366f1"} />
                                        </View>
                                        <Text style={styles.reflectionLabel}>
                                            {language === 'it' ? 'RIFLESSIONE' : 'REFLECTION'}
                                        </Text>
                                    </View>

                                    <Text style={[styles.reflectionQuote, { color: colors.text }]}>
                                        "{aiAnalysis}"
                                    </Text>


                                </View>
                            </View>
                        </View>
                    )
                }
            </ScrollView >

            {/* Full Analysis Modal */}
            {/* Daily Snapshot Page */}
            <Modal visible={showFullAnalysis} animationType="slide" transparent={false} onRequestClose={() => setShowFullAnalysis(false)}>
                <DailySnapshotScreen
                    date={selectedDayKey}
                    onClose={() => setShowFullAnalysis(false)}
                />
            </Modal>

            {/* Menu Modal */}
            < Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
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
            </Modal >


        </SafeAreaWrapper >
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
        fontFamily: 'Lato_700Bold',
        letterSpacing: 0.5,
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
        fontFamily: 'Lato_700Bold',
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
        fontFamily: 'Lato_700Bold',
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
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
        marginBottom: 0,
        zIndex: 10,
        paddingBottom: 32,
    },
    reflectionCardWrapper: {
        marginTop: -24,
        paddingHorizontal: 4,
        zIndex: 0,
    },
    reflectionCard: {
        borderRadius: 24,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    meshBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    reflectionContent: {
        padding: 24,
        paddingTop: 24,
    },
    reflectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    reflectionIconBadge: {
        padding: 6,
        backgroundColor: 'rgba(99,102,241,0.1)',
        borderRadius: 8,
    },
    reflectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        color: '#818cf8',
    },
    reflectionQuote: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 24,
    },
    reflectionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        borderTopWidth: 1,
    },
    sentimentLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        color: '#9ca3af',
        textTransform: 'uppercase',
    },
    sentimentBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
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
        fontSize: 24,
        fontWeight: '400',
        fontFamily: 'PlayfairDisplay_400Regular_Italic', // Keeps handwritten vibe
        lineHeight: 32,
        marginBottom: 8,
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
    // Historical Recap Styles
    historicalRecapContainer: {
        paddingHorizontal: 4,
        gap: 20,
        marginBottom: 40,
        marginTop: 20, // Add spacing below calendar strip
    },
    dailySnapshotStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff', // Or surface
        padding: 16,
        borderRadius: 40, // Pill shape
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    dailySnapshotLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dailySnapshotIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eef2ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dailySnapshotTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    dailySnapshotSubtitle: {
        fontSize: 12,
        color: '#9ca3af',
    },
    dailySnapshotRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    snapshotMetricIcon: {
        alignItems: 'center',
        gap: 4,
    },
    metricBar: {
        height: 3,
        borderRadius: 1.5,
    },
    readOnlyJournalCard: {
        backgroundColor: '#fff', // Or surface
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    readOnlyJournalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    readOnlyJournalLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6366f1',
        letterSpacing: 1,
    },
    readOnlyTimeLabel: {
        fontSize: 12,
        fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
        color: '#9ca3af',
    },
    readOnlyJournalText: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 16,
    },
    readOnlyReadMore: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 4,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    readMoreText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9ca3af',
        letterSpacing: 1,
    },
    emptyHistoryCard: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 20,
    },
    historicalReflectionCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    historicalReflectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    sparkleIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    historicalReflectionTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    historicalDataPoints: {
        fontSize: 10,
        color: '#9ca3af',
        letterSpacing: 0.5,
    },
    sentimentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    sentimentBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4b5563',
    },
    historicalReflectionText: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 20,
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