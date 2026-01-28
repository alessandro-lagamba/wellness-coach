// WeeklyEmotionRecap.tsx
// (Versione corretta: borderColor esplicito + shadow/elevation consistenti con overflow 'hidden'
//  tramite wrapper esterno per shadow e wrapper interno per clipping)

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { EmotionAnalysisService } from '../services/emotion-analysis.service';
import { AuthService } from '../services/auth.service';
import { useAnalysisStore } from '../stores/analysis.store';

interface WeeklyRecapData {
    totalAnalyses: number;
    avgValence: number;
    avgArousal: number;
    dominantEmotions: Record<string, number>;
    positiveDays: number;
    negativeDays: number;
    neutralDays: number;
    weeklyChange: number;
}

// -----------------------------------------------------------------------------
// Circular progress
// -----------------------------------------------------------------------------
interface CircularProgressProps {
    value: number;
    size: number;
    strokeWidth: number;
    isDark: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ value, size, strokeWidth, isDark }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Defs>
                <SvgLinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                    <Stop offset="100%" stopColor="#8B5CF6" stopOpacity={1} />
                </SvgLinearGradient>
            </Defs>

            {/* Background circle */}
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={isDark ? 'rgba(167, 139, 250, 0.12)' : 'rgba(139, 92, 246, 0.1)'}
                strokeWidth={strokeWidth}
                fill="none"
            />

            {/* Progress circle */}
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
            />
        </Svg>
    );
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
const WeeklyEmotionRecapComponent: React.FC = () => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { language } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyRecapData | null>(null);
    const [dateRange, setDateRange] = useState<string>('');
    const emotionHistoryLength = useAnalysisStore((state) => state.emotionHistory?.length ?? 0);
    const latestEmotionSession = useAnalysisStore((state) => state.latestEmotionSession);

    const loadRecapData = useCallback(async () => {
        setLoading(true);

        try {
            const now = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7); // Ultimi 8 giorni (o 7 giorni fa a oggi) per matchare l'esempio del cliente

            const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
            const startStr = sevenDaysAgo.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', options);
            const endStr = now.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', options);

            setDateRange(`${startStr} - ${endStr}`);
            const user = await AuthService.getCurrentUser();
            if (!user) {
                setData(null);
                return;
            }

            const thisWeekHistory = await EmotionAnalysisService.getEmotionHistoryByDays(user.id, 7);
            if (!thisWeekHistory || thisWeekHistory.length === 0) {
                setData(null);
                return;
            }

            const twoWeeksHistory = await EmotionAnalysisService.getEmotionHistoryByDays(user.id, 14);
            const lastWeekOnly = (twoWeeksHistory || []).filter((a: any) => {
                const analysisDate = new Date(a.created_at);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return analysisDate < sevenDaysAgo;
            });

            let lastWeekAvgValence = 0;
            if (lastWeekOnly.length > 0) {
                lastWeekAvgValence =
                    lastWeekOnly.reduce((sum: number, a: any) => sum + a.valence, 0) / lastWeekOnly.length;
            }

            const dayStats = { positive: 0, negative: 0, neutral: 0 };
            let totalValence = 0;
            let totalArousal = 0;
            const emotionCounts: Record<string, number> = {};

            thisWeekHistory.forEach((analysis: any) => {
                if (analysis.valence > 0.2) dayStats.positive++;
                else if (analysis.valence < -0.2) dayStats.negative++;
                else dayStats.neutral++;

                totalValence += analysis.valence;
                totalArousal += analysis.arousal;

                const key = (analysis.dominant_emotion || 'neutral').toLowerCase();
                emotionCounts[key] = (emotionCounts[key] || 0) + 1;
            });

            const avgValence = totalValence / thisWeekHistory.length;
            const avgArousal = totalArousal / thisWeekHistory.length;
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
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRecapData();
    }, [loadRecapData, emotionHistoryLength, latestEmotionSession?.id]);

    // Palette card coerente con l’altra card
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const cardBorder = isDark ? '#334155' : '#f1f5f9';

    if (loading) {
        return (
            <View style={styles.shadowWrap}>
                <View style={[styles.innerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            </View>
        );
    }

    if (!data || data.totalAnalyses === 0) {
        return null;
    }

    // Score 0-100 (avgValence è in [-1,1])
    const balanceScore = Math.round((data.avgValence + 1) * 50);

    // Percentuali barra
    const total = data.positiveDays + data.neutralDays + data.negativeDays;
    const positivePercent = total > 0 ? (data.positiveDays / total) * 100 : 33;
    const neutralPercent = total > 0 ? (data.neutralDays / total) * 100 : 34;
    const negativePercent = total > 0 ? (data.negativeDays / total) * 100 : 33;

    return (
        <View style={styles.shadowWrap}>
            <View style={[styles.innerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                {/* Title */}
                <Text style={[styles.title, { color: colors.text }]}>
                    {language === 'it' ? 'Equilibrio Emotivo' : 'Emotional Balance'}
                </Text>

                {/* Circular Score */}
                <View style={styles.scoreSection}>
                    <View style={styles.circleWrapper}>
                        <CircularProgress value={balanceScore} size={100} strokeWidth={10} isDark={isDark} />
                        <View style={styles.scoreInner}>
                            <Text style={[styles.scoreNumber, { color: colors.text }]}>{balanceScore}</Text>
                            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>SCORE</Text>
                        </View>
                    </View>

                    <Text style={[styles.checkInText, { color: colors.textSecondary, textAlign: 'center', fontSize: 10 }]}>
                        {language === 'it'
                            ? `Basato su ${data.totalAnalyses} check-in\nPeriodo: ${dateRange}`
                            : `Based on ${data.totalAnalyses} check-ins\nPeriod: ${dateRange}`}
                    </Text>
                </View>

                {/* Balance Bar */}
                <View style={styles.balanceSection}>
                    <View
                        style={[
                            styles.balanceBar,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                        ]}
                    >
                        {positivePercent > 0 && (
                            <View
                                style={[
                                    styles.balanceSegment,
                                    styles.balanceSegmentFirst,
                                    { width: `${positivePercent}%`, backgroundColor: '#389c3fff' },
                                ]}
                            />
                        )}
                        {neutralPercent > 0 && (
                            <View
                                style={[
                                    styles.balanceSegment,
                                    positivePercent === 0 && styles.balanceSegmentFirst,
                                    negativePercent === 0 && styles.balanceSegmentLast,
                                    { width: `${neutralPercent}%`, backgroundColor: '#ffd12bff' },
                                ]}
                            />
                        )}
                        {negativePercent > 0 && (
                            <View
                                style={[
                                    styles.balanceSegment,
                                    styles.balanceSegmentLast,
                                    { width: `${negativePercent}%`, backgroundColor: '#ff4e4eff' },
                                ]}
                            />
                        )}
                    </View>
                    {/* 🆕 Mini Legend with colored circles */}
                    <View style={styles.legendContainer}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendCircle, { backgroundColor: '#389c3fff' }]} />
                            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                                {language === 'it' ? 'Positivo' : 'Positive'}
                            </Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendCircle, { backgroundColor: '#ffd12bff' }]} />
                            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                                {language === 'it' ? 'Neutro' : 'Neutral'}
                            </Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendCircle, { backgroundColor: '#ff4e4eff' }]} />
                            <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
                                {language === 'it' ? 'Negativo' : 'Negative'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

// Memoized export
export const WeeklyEmotionRecap = memo(WeeklyEmotionRecapComponent);

const styles = StyleSheet.create({
    // Wrapper esterno: SOLO shadow/elevation (NO overflow hidden)
    shadowWrap: {
        borderRadius: 24,
        marginHorizontal: 16,
        marginVertical: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.06,
                shadowRadius: 30,
            },
            android: {
                elevation: 8,
            },
        }),
    },

    // Card interna: clipping e border coerenti
    innerCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },

    title: {
        fontSize: 18,
        fontFamily: 'Figtree_700Bold',
        marginBottom: 12,
    },

    scoreSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    circleWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    scoreInner: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreNumber: {
        fontSize: 32,
        fontFamily: 'Figtree_700Bold',
        letterSpacing: -0.5,
    },
    scoreLabel: {
        fontSize: 9,
        fontFamily: 'Figtree_700Bold',
        letterSpacing: 1.2,
        marginTop: 1,
    },
    checkInText: {
        fontSize: 13,
        fontFamily: 'Figtree_400Regular',
    },

    balanceSection: {
        gap: 10,
    },
    balanceLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
    balanceLabel: {
        fontSize: 12,
        fontFamily: 'Figtree_500Medium',
    },
    balanceBar: {
        height: 10,
        flexDirection: 'row',
        borderRadius: 5,
        overflow: 'hidden',
    },
    balanceSegment: {
        height: '100%',
    },
    balanceSegmentFirst: {
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 5,
    },
    balanceSegmentLast: {
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        marginTop: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendLabel: {
        fontSize: 11,
        fontFamily: 'Figtree_500Medium',
    },
});

export default WeeklyEmotionRecap;
