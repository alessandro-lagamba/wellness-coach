// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTabBarVisibility } from '../contexts/TabBarVisibilityContext';
import { useFocusEffect } from 'expo-router';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { IntelligentInsightService } from '../services/intelligent-insight.service';
import { AuthService } from '../services/auth.service';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeMachineCalendar } from './TimeMachineCalendar';

const { width } = Dimensions.get('window');

interface EmotionTimeMachineScreenProps {
    onGoBack: () => void;
}

// ==================== ANALYSIS PICKER MODAL ====================
interface AnalysisPickerProps {
    visible: boolean;
    onClose: () => void;
    analyses: any[];
    onSelect: (analysis: any) => void;
    language: string;
    isDark?: boolean; // 🆕 Theme support
}

const AnalysisPicker: React.FC<AnalysisPickerProps> = ({ visible, onClose, analyses, onSelect, language, isDark = true }) => {
    const getEmoji = (emotion: string) => {
        const map: Record<string, string> = {
            joy: '😊', sadness: '😢', anger: '😠', fear: '😨',
            surprise: '😲', disgust: '🤢', neutral: '😐',
            happy: '😊', calm: '😌', focus: '🧐'
        };
        return map[emotion?.toLowerCase()] || '😐';
    };

    // 🆕 Translate emotions
    const translateEmotion = (emotion: string) => {
        if (language !== 'it') return emotion;
        const translations: Record<string, string> = {
            joy: 'Gioia', sadness: 'Tristezza', anger: 'Rabbia', fear: 'Paura',
            surprise: 'Sorpresa', disgust: 'Disgusto', neutral: 'Neutrale',
            happy: 'Felice', calm: 'Calmo', focus: 'Concentrato'
        };
        return translations[emotion?.toLowerCase()] || emotion;
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString(language === 'it' ? 'it-IT' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // Theme colors
    const colors = isDark ? {
        overlay: 'rgba(0,0,0,0.7)',
        background: '#1a1a2e',
        surface: '#2d2d3a',
        text: '#fff',
        textSecondary: '#888',
    } : {
        overlay: 'rgba(0,0,0,0.5)',
        background: '#fff',
        surface: '#f8f9fc',
        text: '#1a1a2e',
        textSecondary: '#64748b',
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity style={[apStyles.overlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={onClose}>
                <View style={[apStyles.container, { backgroundColor: colors.background }]}>
                    <Text style={[apStyles.title, { color: colors.text }]}>
                        {language === 'it' ? 'Scegli analisi' : 'Choose analysis'}
                    </Text>
                    {analyses.map((item, index) => (
                        <TouchableOpacity
                            key={item.id || index}
                            style={[apStyles.item, { backgroundColor: colors.surface }]}
                            onPress={() => { onSelect(item); onClose(); }}
                        >
                            <Text style={apStyles.emoji}>{getEmoji(item.dominant_emotion)}</Text>
                            <View style={apStyles.itemContent}>
                                <Text style={[apStyles.time, { color: colors.textSecondary }]}>{formatTime(item.created_at)}</Text>
                                <Text style={[apStyles.emotion, { color: colors.text }]}>{translateEmotion(item.dominant_emotion)}</Text>
                            </View>
                            <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const apStyles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { borderRadius: 16, padding: 20, width: width - 60 },
    title: { fontSize: 18, fontFamily: 'Figtree_700Bold', marginBottom: 16, textAlign: 'center' },
    item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
    emoji: { fontSize: 28, marginRight: 12 },
    itemContent: { flex: 1 },
    time: { fontSize: 12 },
    emotion: { fontSize: 16, fontFamily: 'Figtree_500Medium', textTransform: 'capitalize' },

});

// ==================== MAIN COMPONENT ====================
export const EmotionTimeMachineScreen: React.FC<EmotionTimeMachineScreenProps> = ({ onGoBack }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { t, language } = useTranslation();
    const { hideTabBar, showTabBar } = useTabBarVisibility();

    // Hide tab bar when screen is focused
    useFocusEffect(
        useCallback(() => {
            hideTabBar();
            return () => showTabBar();
        }, [hideTabBar, showTabBar])
    );

    // Data states
    const [loading, setLoading] = useState(true);
    const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
    const [pastAnalysis, setPastAnalysis] = useState<any>(null);
    const [analysisDates, setAnalysisDates] = useState<string[]>([]);
    const [timeJumpLabel, setTimeJumpLabel] = useState('');

    // UI states
    const [showCalendar, setShowCalendar] = useState(false);
    const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
    const [dayAnalyses, setDayAnalyses] = useState<any[]>([]);
    const [selectedCard, setSelectedCard] = useState<'past' | 'today' | null>('today'); // 🆕 Auto-select today

    // AI Insight states
    const [aiInsight, setAiInsight] = useState<string>('');
    const [generatingInsight, setGeneratingInsight] = useState(false);
    const [insightGenerated, setInsightGenerated] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const user = await AuthService.getCurrentUser();
            if (!user) { setLoading(false); return; }

            // Fetch today's analysis
            const today = await EmotionAnalysisService.getLatestEmotionAnalysis(user.id);
            setCurrentAnalysis(today);

            // Fetch all dates with analyses for calendar dots
            const dates = await EmotionAnalysisService.getAllAnalysisDates(user.id);
            setAnalysisDates(dates);

            // Auto-select a past analysis (oldest available)
            const history = await EmotionAnalysisService.getEmotionHistory(user.id, 30);
            if (history && history.length > 1) {
                const past = history[history.length - 1];
                if (past.id !== today?.id) {
                    setPastAnalysis(past);
                    updateTimeJumpLabel(past.created_at);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateTimeJumpLabel = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 7) {
            setTimeJumpLabel(`${diffDays} ${language === 'it' ? 'giorni fa' : 'days ago'}`);
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            setTimeJumpLabel(`${weeks} ${language === 'it' ? (weeks === 1 ? 'settimana fa' : 'settimane fa') : (weeks === 1 ? 'week ago' : 'weeks ago')}`);
        } else {
            const months = Math.floor(diffDays / 30);
            setTimeJumpLabel(`${months} ${language === 'it' ? (months === 1 ? 'mese fa' : 'mesi fa') : (months === 1 ? 'month ago' : 'months ago')}`);
        }
    };

    const handleDateSelected = async (date: Date) => {
        try {
            setLoading(true);
            setInsightGenerated(false);
            setAiInsight('');
            setSelectedCard(null);

            const user = await AuthService.getCurrentUser();
            if (!user) return;

            const analyses = await EmotionAnalysisService.getAnalysesByDate(user.id, date);

            if (analyses.length === 0) {
                setPastAnalysis(null);
            } else if (analyses.length === 1) {
                setPastAnalysis(analyses[0]);
                updateTimeJumpLabel(analyses[0].created_at);
            } else {
                setDayAnalyses(analyses);
                setShowAnalysisPicker(true);
            }
        } catch (error) {
            console.error('Error fetching date analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalysisSelected = (analysis: any) => {
        setPastAnalysis(analysis);
        updateTimeJumpLabel(analysis.created_at);
        setInsightGenerated(false);
        setAiInsight('');
    };

    const generateComparison = async () => {
        if (!pastAnalysis || !currentAnalysis) return;

        try {
            setGeneratingInsight(true);
            const insight = await IntelligentInsightService.getInstance().generateTimeMachineInsight(
                pastAnalysis,
                currentAnalysis,
                language
            );
            setAiInsight(insight);
            setInsightGenerated(true);
        } catch (error) {
            console.error('Error generating insight:', error);
        } finally {
            setGeneratingInsight(false);
        }
    };

    const getEmotionLabel = (analysis: any) => {
        if (!analysis) return '';
        const emotion = analysis.dominant_emotion || 'neutral';
        const valence = analysis.valence || 0;

        const labels: Record<string, { pos: string; neg: string; neu: string }> = {
            joy: { pos: language === 'it' ? 'Radiante & Energico' : 'Radiant & Energetic', neg: language === 'it' ? 'Teso' : 'Tense', neu: language === 'it' ? 'Sereno' : 'Serene' },
            neutral: { pos: language === 'it' ? 'Concentrato & Calmo' : 'Focused & Calm', neg: language === 'it' ? 'Sopraffatto' : 'Overwhelmed', neu: language === 'it' ? 'Stabile & Riflessivo' : 'Stable & Reflective' },
            sadness: { pos: language === 'it' ? 'Riflessivo' : 'Reflective', neg: language === 'it' ? 'Abbattuto' : 'Down', neu: language === 'it' ? 'Pensieroso' : 'Thoughtful' },
            anger: { pos: language === 'it' ? 'Determinato' : 'Determined', neg: language === 'it' ? 'Frustrato' : 'Frustrated', neu: language === 'it' ? 'Assertivo' : 'Assertive' },
            fear: { pos: language === 'it' ? 'Vigile' : 'Vigilant', neg: language === 'it' ? 'Ansioso' : 'Anxious', neu: language === 'it' ? 'Cauto' : 'Cautious' },
            surprise: { pos: language === 'it' ? 'Entusiasta' : 'Enthusiastic', neg: language === 'it' ? 'Sconcertato' : 'Bewildered', neu: language === 'it' ? 'Curioso' : 'Curious' },
        };

        const emotionLabels = labels[emotion.toLowerCase()] || labels.neutral;
        if (valence > 0.2) return emotionLabels.pos;
        if (valence < -0.2) return emotionLabels.neg;
        return emotionLabels.neu;
    };

    const formatDateShort = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short' }).toUpperCase();
    };

    const getAnalysisDetails = (analysis: any) => {
        if (!analysis) return null;
        // Normalize values from [-1, 1] to [0, 100] to match EnhancedMetricTile
        return {
            valence: Math.round((((analysis.valence || 0) + 1) / 2) * 100),
            arousal: Math.round((((analysis.arousal || 0) + 1) / 2) * 100),
            text: analysis.ai_analysis_text || analysis.analysis_data?.observations?.join(' ') || null
        };
    };

    // ==================== RENDER ====================

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0a0a0f' : '#f8f9fc' }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>Emotion Time Machine</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContent}>
                    <ActivityIndicator size="large" color="#a855f7" />
                </View>
            </SafeAreaView>
        );
    }

    if (!currentAnalysis) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0a0a0f' : '#f8f9fc' }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>Emotion Time Machine</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.emptyContent}>
                    <MaterialCommunityIcons name="emoticon-sad-outline" size={64} color="#a855f7" />
                    <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                        {language === 'it' ? 'Nessuna analisi di oggi' : 'No analysis today'}
                    </Text>
                    <TouchableOpacity style={styles.ctaButton} onPress={onGoBack}>
                        <LinearGradient colors={['#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
                            <Text style={styles.ctaText}>{language === 'it' ? 'Inizia Analisi' : 'Start Analysis'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const pastDetails = getAnalysisDetails(pastAnalysis);
    const todayDetails = getAnalysisDetails(currentAnalysis);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0a0a0f' : '#f8f9fc' }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>Emotion Time Machine</Text>
                <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.calendarButton}>
                    <Feather name="calendar" size={22} color="#a855f7" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Time Jump Badge */}
                {pastAnalysis && (
                    <View style={styles.timeJumpContainer}>
                        <View style={[styles.timeJumpBadge, { backgroundColor: isDark ? '#2d2d3a' : '#f0e6ff' }]}>
                            <MaterialCommunityIcons name="clock-time-three-outline" size={16} color="#a855f7" />
                            <Text style={[styles.timeJumpText, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                                Time Jump: {timeJumpLabel}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Evolution Card */}
                <View style={[styles.evolutionCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>

                    {/* Comparison Cards - ALWAYS show both */}
                    <View style={styles.comparisonRow}>
                        {/* Past Card */}
                        <TouchableOpacity
                            style={[
                                styles.stateCard,
                                { backgroundColor: isDark ? '#2d2d3a' : '#f8f9fc' },
                                selectedCard === 'past' && styles.selectedCardBorder
                            ]}
                            onPress={() => setSelectedCard(selectedCard === 'past' ? null : 'past')}
                        >
                            <View style={styles.dateRow}>
                                <Feather name="calendar" size={12} color={isDark ? '#888' : '#999'} />
                                <Text style={[styles.dateText, { color: isDark ? '#888' : '#999' }]}>
                                    {pastAnalysis ? formatDateShort(pastAnalysis.created_at) : '---'}
                                </Text>
                            </View>
                            <Text style={[styles.stateLabel, { color: isDark ? '#aaa' : '#666' }]}>
                                {language === 'it' ? 'Stato' : 'State'}
                            </Text>
                            <Text style={[styles.stateValue, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                                {pastAnalysis ? getEmotionLabel(pastAnalysis) : (language === 'it' ? 'Seleziona data' : 'Select date')}
                            </Text>
                        </TouchableOpacity>

                        {/* Today Card - ALWAYS visible */}
                        <TouchableOpacity
                            style={[
                                styles.todayCardWrapper,
                                selectedCard === 'today' && styles.selectedTodayCardBorder
                            ]}
                            onPress={() => setSelectedCard(selectedCard === 'today' ? null : 'today')}
                        >
                            <LinearGradient colors={['#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.todayCardBorder}>
                                <View style={[styles.todayCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
                                    <View style={styles.dateRow}>
                                        <MaterialCommunityIcons name="star-four-points" size={12} color="#ec4899" />
                                        <Text style={[styles.dateText, { color: '#ec4899' }]}>{language === 'it' ? 'OGGI' : 'TODAY'}</Text>
                                    </View>
                                    <Text style={[styles.stateLabel, { color: isDark ? '#aaa' : '#666' }]}>{language === 'it' ? 'Stato' : 'State'}</Text>
                                    <Text style={[styles.stateValue, { color: isDark ? '#fff' : '#1a1a2e' }]}>{getEmotionLabel(currentAnalysis)}</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Selected Card Details */}
                {selectedCard && (
                    <View style={[styles.detailsCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
                        <Text style={[styles.detailsTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                            {selectedCard === 'past'
                                ? (language === 'it' ? 'Dettagli del Passato' : 'Past Details')
                                : (language === 'it' ? 'Dettagli di Oggi' : "Today's Details")
                            }
                        </Text>

                        {/* Metrics */}
                        <View style={styles.metricsRow}>
                            <View style={[styles.metricBox, { backgroundColor: isDark ? '#2d2d3a' : '#f8f9fc' }]}>
                                <Text style={styles.metricLabel}>Valence</Text>
                                <Text style={[styles.metricValue, { color: '#22c55e' }]}>
                                    {selectedCard === 'past' ? pastDetails?.valence : todayDetails?.valence}%
                                </Text>
                            </View>
                            <View style={[styles.metricBox, { backgroundColor: isDark ? '#2d2d3a' : '#f8f9fc' }]}>
                                <Text style={styles.metricLabel}>Arousal</Text>
                                <Text style={[styles.metricValue, { color: '#f59e0b' }]}>
                                    {selectedCard === 'past' ? pastDetails?.arousal : todayDetails?.arousal}%
                                </Text>
                            </View>
                        </View>

                        {/* AI Text */}
                        {((selectedCard === 'past' && pastDetails?.text) || (selectedCard === 'today' && todayDetails?.text)) && (
                            <Text style={[styles.aiText, { color: isDark ? '#ccc' : '#555' }]}>
                                {selectedCard === 'past' ? pastDetails?.text : todayDetails?.text}
                            </Text>
                        )}
                    </View>
                )}

                {/* AI Insight Section (only after generation) */}
                {insightGenerated && aiInsight && (
                    <View style={[styles.insightCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
                        <View style={styles.insightHeader}>
                            <MaterialCommunityIcons name="auto-fix" size={18} color="#ec4899" />
                            <Text style={styles.insightLabel}>AI INSIGHT</Text>
                        </View>
                        <Text style={[styles.insightText, { color: isDark ? '#ddd' : '#333' }]}>{aiInsight}</Text>
                    </View>
                )}

                {/* Deepen Analysis Button */}
                {pastAnalysis && !insightGenerated && (
                    <TouchableOpacity
                        style={styles.deepenButton}
                        onPress={generateComparison}
                        disabled={generatingInsight}
                    >
                        <LinearGradient colors={['#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.deepenGradient}>
                            {generatingInsight ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.deepenText}>{language === 'it' ? 'Approfondisci Analisi' : 'Deepen Analysis'}</Text>
                                    <Feather name="arrow-right" size={20} color="#fff" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}

            </ScrollView>

            {/* Modals */}
            <TimeMachineCalendar
                visible={showCalendar}
                onClose={() => setShowCalendar(false)}
                onSelectDate={handleDateSelected}
                markedDates={analysisDates}
                language={language}
                isDark={isDark}
            />
            <AnalysisPicker
                visible={showAnalysisPicker}
                onClose={() => setShowAnalysisPicker(false)}
                analyses={dayAnalyses}
                onSelect={handleAnalysisSelected}
                language={language}
                isDark={isDark}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontFamily: 'Figtree_700Bold' },
    calendarButton: { padding: 8 },
    placeholder: { width: 40 },
    loadingContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyTitle: { fontSize: 22, fontFamily: 'Figtree_700Bold', marginTop: 10, textAlign: 'center' },
    ctaButton: { marginTop: 30, borderRadius: 12, overflow: 'hidden' },
    ctaGradient: { paddingHorizontal: 32, paddingVertical: 14 },
    ctaText: { color: '#fff', fontFamily: 'Figtree_700Bold', fontSize: 16 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    timeJumpContainer: { alignItems: 'center', marginBottom: 20 },
    timeJumpBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 8 },
    timeJumpText: { fontSize: 14, fontFamily: 'Figtree_500Medium' },
    evolutionCard: { borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    evolutionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    brainIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    evolutionTitle: { fontSize: 18, fontFamily: 'Figtree_700Bold', flex: 1 },
    comparisonRow: { flexDirection: 'row', gap: 12 },
    stateCard: { flex: 1, borderRadius: 16, padding: 16 },
    selectedCardBorder: { borderWidth: 2, borderColor: '#a855f7' },
    selectedTodayCardBorder: { transform: [{ scale: 1.02 }] },
    todayCardWrapper: { flex: 1, borderRadius: 16, overflow: 'hidden' },
    todayCardBorder: { flex: 1, borderRadius: 16, padding: 2 },
    todayCard: { flex: 1, borderRadius: 14, padding: 14 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    dateText: { fontSize: 12, fontFamily: 'Figtree_700Bold' },
    stateLabel: { fontSize: 12, marginBottom: 4 },
    stateValue: { fontSize: 15, fontFamily: 'Figtree_700Bold', lineHeight: 20 },
    detailsCard: { borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    detailsTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold', marginBottom: 16 },
    metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    metricBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
    metricLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
    metricValue: { fontSize: 20, fontFamily: 'Figtree_700Bold' },
    aiText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic', fontFamily: 'Figtree_500Medium' },
    insightCard: { borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    insightLabel: { fontSize: 12, fontFamily: 'Figtree_700Bold', color: '#ec4899', letterSpacing: 1 },
    insightText: { fontSize: 16, lineHeight: 24, fontStyle: 'italic', fontFamily: 'Figtree_500Medium' },
    deepenButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
    deepenGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    deepenText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_700Bold' },
});

export default EmotionTimeMachineScreen;
