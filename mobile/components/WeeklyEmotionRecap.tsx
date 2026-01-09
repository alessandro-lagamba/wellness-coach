// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { AuthService } from '../services/auth.service';

interface WeeklyRecapData {
    totalAnalyses: number;
    avgValence: number;
    avgArousal: number;
    dominantEmotions: Record<string, number>;
    positiveDays: number;
    negativeDays: number;
    neutralDays: number;
    weeklyChange: number; // valence change from previous week
}

export const WeeklyEmotionRecap: React.FC = () => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { language } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyRecapData | null>(null);

    useEffect(() => {
        loadRecapData();
    }, []);

    const loadRecapData = async () => {
        try {
            const user = await AuthService.getCurrentUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // 🆕 Get ALL analyses from last 7 days (not limited by count)
            const thisWeekHistory = await EmotionAnalysisService.getEmotionHistoryByDays(user.id, 7);

            if (thisWeekHistory.length === 0) {
                setLoading(false);
                return;
            }

            // Get last week (days 8-14) for comparison
            const twoWeeksHistory = await EmotionAnalysisService.getEmotionHistoryByDays(user.id, 14);
            const lastWeekOnly = twoWeeksHistory.filter(a => {
                const analysisDate = new Date(a.created_at);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return analysisDate < sevenDaysAgo;
            });

            let lastWeekAvgValence = 0;
            if (lastWeekOnly.length > 0) {
                lastWeekAvgValence = lastWeekOnly.reduce((sum, a) => sum + a.valence, 0) / lastWeekOnly.length;
            }

            // Calculate positive/negative/neutral for ALL this week's analyses
            const dayStats = { positive: 0, negative: 0, neutral: 0 };
            let totalValence = 0;
            let totalArousal = 0;
            const emotionCounts: Record<string, number> = {};

            thisWeekHistory.forEach(analysis => {
                // Count by valence threshold (using -1 to 1 scale internally)
                if (analysis.valence > 0.2) dayStats.positive++;
                else if (analysis.valence < -0.2) dayStats.negative++;
                else dayStats.neutral++;

                totalValence += analysis.valence;
                totalArousal += analysis.arousal;

                // Count dominant emotions
                emotionCounts[analysis.dominant_emotion] = (emotionCounts[analysis.dominant_emotion] || 0) + 1;
            });

            const avgValence = thisWeekHistory.length > 0 ? totalValence / thisWeekHistory.length : 0;
            const avgArousal = thisWeekHistory.length > 0 ? totalArousal / thisWeekHistory.length : 0;
            const weeklyChange = avgValence - lastWeekAvgValence;

            setData({
                totalAnalyses: thisWeekHistory.length,
                avgValence,
                avgArousal,
                dominantEmotions: emotionCounts,
                positiveDays: dayStats.positive,
                negativeDays: dayStats.negative,
                neutralDays: dayStats.neutral,
                weeklyChange,
            });
        } catch (error) {
            console.error('Error loading recap:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    if (!data || data.totalAnalyses === 0) {
        return null; // Don't show if no data
    }

    // Calculate emotional balance score (0-100)
    const balanceScore = Math.round((data.avgValence + 1) * 50);

    // Determine trend icon
    const trendIcon = data.weeklyChange > 0.1 ? 'trending-up' : data.weeklyChange < -0.1 ? 'trending-down' : 'minus';
    const trendColor = data.weeklyChange > 0.1 ? '#10b981' : data.weeklyChange < -0.1 ? '#ef4444' : colors.textSecondary;

    // Get top emotion
    const topEmotion = Object.entries(data.dominantEmotions)
        .sort((a, b) => b[1] - a[1])[0];

    // 🆕 Emotion translation map for Italian
    const emotionTranslations: Record<string, string> = {
        neutral: 'neutro',
        joy: 'gioia',
        happiness: 'felicità',
        sadness: 'tristezza',
        anger: 'rabbia',
        fear: 'paura',
        surprise: 'sorpresa',
        disgust: 'disgusto',
        contempt: 'disprezzo',
    };

    // Helper to get translated and capitalized emotion name
    const getEmotionDisplay = (emotion: string) => {
        const translated = language === 'it' ? (emotionTranslations[emotion.toLowerCase()] || emotion) : emotion;
        return translated.charAt(0).toUpperCase() + translated.slice(1);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Feather name="calendar" size={18} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.text }]}>
                        {language === 'it' ? 'Il tuo recap settimanale' : 'Your weekly recap'}
                    </Text>
                </View>
                <View style={styles.trendBadge}>
                    <Feather name={trendIcon} size={14} color={trendColor} />
                </View>
            </View>

            {/* Main Score */}
            <View style={styles.scoreContainer}>
                <LinearGradient
                    colors={['#7c3aed', '#9333ea']}
                    style={styles.scoreCircle}
                >
                    <Text style={styles.scoreNumber}>{balanceScore}</Text>
                    <Text style={styles.scoreLabel}>/ 100</Text>
                </LinearGradient>
                <View style={styles.scoreInfo}>
                    <Text style={[styles.scoreTitle, { color: colors.text }]}>
                        {language === 'it' ? 'Equilibrio Emotivo' : 'Emotional Balance'}
                    </Text>
                    <Text style={[styles.scoreSubtitle, { color: colors.textSecondary }]}>
                        {data.totalAnalyses} {language === 'it' ? 'check-in questa settimana' : 'check-ins this week'}
                    </Text>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
                    <Text style={[styles.statNumber, { color: colors.text }]}>{data.positiveDays}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {language === 'it' ? 'Positivo' : 'Positive'}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <View style={[styles.statDot, { backgroundColor: '#6366f1' }]} />
                    <Text style={[styles.statNumber, { color: colors.text }]}>{data.neutralDays}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {language === 'it' ? 'Neutro' : 'Neutral'}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.statNumber, { color: colors.text }]}>{data.negativeDays}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {language === 'it' ? 'Negativo' : 'Tough'}
                    </Text>
                </View>
            </View>

            {/* Top Emotion */}
            {topEmotion && (
                <View style={[styles.insightBox, { backgroundColor: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.08)' }]}>
                    <Feather name="zap" size={14} color={colors.primary} />
                    <Text style={[styles.insightText, { color: colors.text }]}>
                        {language === 'it'
                            ? `Emozione principale: ${getEmotionDisplay(topEmotion[0])} (${Math.round(topEmotion[1] / data.totalAnalyses * 100)}%)`
                            : `Top emotion: ${getEmotionDisplay(topEmotion[0])} (${Math.round(topEmotion[1] / data.totalAnalyses * 100)}%)`}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
    },
    trendBadge: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    scoreCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
    },
    scoreLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8)',
        marginTop: -4,
    },
    scoreInfo: {
        flex: 1,
    },
    scoreTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    scoreSubtitle: {
        fontSize: 13,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 12,
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
    },
    statDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    insightBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
    },
    insightText: {
        fontSize: 13,
        flex: 1,
    },
});

export default WeeklyEmotionRecap;
