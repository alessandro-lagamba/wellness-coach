import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/auth.service';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

interface DailySnapshotScreenProps {
    date: string; // YYYY-MM-DD
    onClose: () => void;
}

interface SnapshotData {
    mood?: {
        value: number; // 1-5
        label: string;
        valence?: number; // 0-100
        arousal?: number; // 0-100
        dominantEmotion?: string;
    };
    sleep?: {
        hours: number;
        minutes: number;
        quality?: string;
        bedtime?: string;
        waketime?: string;
    };
    steps?: {
        count: number;
        goal: number;
        trend?: number; // percentage
    };
    hydration?: {
        ml: number;
        goal: number; // e.g., 2000ml
    };
    hrv?: {
        value: number;
        unit: string;
    };
    restingHR?: {
        value: number;
        unit: string;
    };
    calories?: {
        value: number;
        goal: number;
        label: string;
    };
    mindfulness?: {
        minutes: number;
    };
    skin?: {
        score: number;
        label: string;
        texture?: number;
        oiliness?: number;
        hydration?: number;
        redness?: number;
        pigmentation?: number;
    };
}

const { width } = Dimensions.get('window');

// ------------------------------
// Circular Progress (Steps/Cal)
// ------------------------------
const CircularProgress = ({ value, maxValue, color, label, subLabel, icon }: { value: number, maxValue: number, color: string, label: string, subLabel: string, icon: any }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const radius = 36;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(Math.max(value / maxValue, 0), 1);
    const strokeDashoffset = circumference - (progress * circumference);

    return (
        <View style={[styles.circularCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.circularHeader}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
                <Text style={[styles.circularLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>

            <View style={styles.circularBody}>
                <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={90} height={90} viewBox="0 0 90 90">
                        {/* Track */}
                        <Circle
                            cx="45"
                            cy="45"
                            r={radius}
                            stroke={isDark ? '#334155' : '#f1f5f9'}
                            strokeWidth={strokeWidth}
                            fill="transparent"
                        />
                        {/* Progress */}
                        <Circle
                            cx="45"
                            cy="45"
                            r={radius}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            rotation="-90"
                            origin="45, 45"
                        />
                    </Svg>
                    <View style={{ position: 'absolute', alignItems: 'center' }}>
                        <Text style={[styles.circularValueSmall, { color: colors.text }]}>
                            {value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}
                        </Text>
                        <Text style={[styles.circularSubText, { color: colors.textTertiary }]}>
                            {subLabel}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// ------------------------------
// Linear Grid Card (Hydration/Sleep/Steps/Calories)
// ------------------------------
const LinearGridCard = ({ title, value, unit, goal, color, icon, progress, pillCount, customContent }: any) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { t } = useTranslation();

    return (
        <View style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.gridCardHeader}>
                <View style={[styles.gridIconContainer, { backgroundColor: `${color}15` }]}>
                    <MaterialCommunityIcons name={icon} size={20} color={color} />
                </View>
                {/* Visual badge for Steps */}
                {title === t('dailySnapshot.steps') && (
                    <View style={[styles.gridBadge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 'bold' }}>+12%</Text>
                    </View>
                )}
                {/* Visual badge for Hydration (Add button simulation) */}
                {unit === 'ml' && (
                    <View style={[styles.gridBadge, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                        <MaterialCommunityIcons name="plus" size={12} color={colors.textSecondary} />
                    </View>
                )}
            </View>

            <Text style={[styles.gridCardTitle, { color: colors.textSecondary }]}>{title}</Text>

            <View style={styles.gridCardValueRow}>
                <Text style={[styles.gridCardValue, { color: colors.text }]}>
                    {value}
                </Text>
                {unit && <Text style={[styles.gridCardUnit, { color: colors.textSecondary }]}>{unit}</Text>}
            </View>

            {customContent ? customContent : (
                <>
                    {pillCount !== undefined ? (
                        <View style={styles.pillsContainer}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.hydrationPill,
                                        {
                                            backgroundColor: i < pillCount ? color : (isDark ? '#334155' : '#e2e8f0')
                                        }
                                    ]}
                                />
                            ))}
                        </View>
                    ) : (
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                                <View style={[styles.progressBarFill, { width: `${Math.min((progress || 0) * 100, 100)}%`, backgroundColor: color }]} />
                            </View>
                            {goal && (
                                <Text style={[styles.goalText, { color: colors.textTertiary }]}>
                                    {t('dailySnapshot.goal')}: {goal.toLocaleString()}
                                </Text>
                            )}
                        </View>
                    )}
                </>
            )}
        </View>
    );
};

// ------------------------------
// Top Card (Mood / Skin)
// ------------------------------
const LargeDetailCard = ({ title, icon, color, mainValue, subValue, children, topRightContent }: any) => {
    const { colors, isDark } = useTheme();

    return (
        <View style={[styles.largeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.largeCardHeader}>
                <View style={styles.largeCardHeaderLeft}>
                    <View style={[styles.largeIconBox, { backgroundColor: `${color}15` }]}>
                        {typeof icon === 'string' ? (
                            <MaterialCommunityIcons name={icon as any} size={28} color={color} />
                        ) : (
                            <Text style={{ fontSize: 28 }}>{icon}</Text>
                        )}
                    </View>
                    <View>
                        <Text style={[styles.largeCardTitleLabel, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
                        <Text style={[styles.largeCardMainValue, { color: colors.text }]}>{mainValue}</Text>
                    </View>
                </View>
                {topRightContent}
            </View>
            <View style={styles.largeCardContent}>
                {children}
            </View>
        </View>
    );
};


export const DailySnapshotScreen: React.FC<DailySnapshotScreenProps> = ({ date, onClose }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SnapshotData | null>(null);

    // Date Formatting
    const dateObj = new Date(date);
    const dateFormatted = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-US', {
        month: 'long',
        day: 'numeric'
    }).format(dateObj);

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const user = await AuthService.getCurrentUser();
            if (!user) return;

            // 1. Fetch tables
            const { data: healthData } = await supabase
                .from('health_data')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date)
                .maybeSingle();

            const { data: checkinData } = await supabase
                .from('daily_checkins')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date)
                .maybeSingle();

            const startOfDay = `${date}T00:00:00`;
            const endOfDay = `${date}T23:59:59`;

            const { data: emotionData } = await supabase
                .from('emotion_analysis')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const { data: skinData } = await supabase
                .from('skin_analyses')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const processed: SnapshotData = {};

            // MOOD
            if (emotionData) {
                processed.mood = {
                    value: 3,
                    label: emotionData.dominant_emotion || 'Neutral',
                    valence: emotionData.valence,
                    arousal: emotionData.arousal,
                    dominantEmotion: emotionData.dominant_emotion
                };
            } else if (checkinData?.mood_value) {
                processed.mood = {
                    value: checkinData.mood_value,
                    label: getMoodLabel(checkinData.mood_value),
                    valence: checkinData.mood_value * 20,
                    arousal: 50
                };
            }

            // SLEEP
            if (healthData?.sleep_hours || healthData?.sleep_minutes) {
                const totalMinutes = healthData.sleep_minutes || (healthData.sleep_hours * 60) || 0;
                processed.sleep = {
                    hours: Math.floor(totalMinutes / 60),
                    minutes: Math.round(totalMinutes % 60),
                    quality: checkinData?.sleep_quality > 0 ? (checkinData.sleep_quality > 70 ? 'Restorative' : 'Fair') : 'Restorative'
                };
            }

            // STEPS
            if (healthData?.steps !== undefined) {
                processed.steps = {
                    count: healthData.steps,
                    goal: 10000,
                    trend: 12
                };
            }

            // HYDRATION
            const hydrationMl = healthData?.hydration_milliliters || (healthData?.hydration_glasses ? healthData.hydration_glasses * 250 : 0);
            if (hydrationMl !== undefined) {
                processed.hydration = {
                    ml: hydrationMl,
                    goal: 2000
                };
            }

            // ACTIVE CALORIES
            if (healthData?.active_calories || healthData?.calories) {
                processed.calories = {
                    value: healthData.active_calories || healthData.calories,
                    goal: 500,
                    label: t('dailySnapshot.calories')
                };
            }

            // HRV & HR
            if (healthData?.hrv) processed.hrv = { value: Math.round(healthData.hrv), unit: 'ms' };
            if (healthData?.resting_heart_rate) processed.restingHR = { value: Math.round(healthData.resting_heart_rate), unit: 'bpm' };
            if (healthData?.mindfulness_minutes) processed.mindfulness = { minutes: healthData.mindfulness_minutes };

            // SKIN
            if (skinData) {
                processed.skin = {
                    score: skinData.overall_score || 0,
                    label: getSkinLabel(skinData.overall_score || 0),
                    texture: skinData.texture_score,
                    oiliness: skinData.oiliness_score,
                    hydration: skinData.hydration_score,
                    redness: skinData.redness_score || 0 // New field
                };
            }

            setData(processed);
        } catch (error) {
            console.error('Error fetching snapshot data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMoodLabel = (value: number) => {
        return value >= 4 ? 'Good' : 'Neutral';
    };

    const getSkinLabel = (score: number) => {
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Good';
        if (score >= 60) return 'Fair';
        return 'Needs Care';
    };

    const MetricRow = ({ label, value, color }: any) => (
        <View style={styles.skinMetricRow}>
            <Text style={[styles.skinMetricLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <View style={[styles.skinMetricTrack, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                    <View style={[styles.skinMetricFill, { width: value ? `${value}%` : '0%', backgroundColor: color }]} />
                </View>
                <Text style={[styles.skinMetricValue, { color: colors.text }]}>{value || '--'}</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* HEADER */}
            {/* Use explicit padding and height to satisfy user request for space */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 0} tint={isDark ? 'dark' : 'light'} style={[styles.header, { borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onClose} style={[styles.backButton, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                        <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t('dailySnapshot.title')}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{dateFormatted}</Text>
                    <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
                        <Image source={require('../assets/icon.png')} style={styles.avatar} />
                    </View>
                </View>
            </BlurView>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* 1. MOOD CARD */}
                <LargeDetailCard
                    title={t('dailySnapshot.mood')}
                    icon={data?.mood?.dominantEmotion ? '😌' : '😶'}
                    color="#f59e0b" // Amber
                    mainValue={data?.mood?.label || t('dailySnapshot.noData')}
                >
                    {/* Always show bars if we have the structure, default to 0 opacity if no data */}
                    <View style={styles.moodMetricsContainer}>
                        <View style={styles.moodBarRow}>
                            <View style={styles.moodBarLabels}>
                                <Text style={[styles.moodBarLabel, { color: colors.textSecondary }]}>{t('dailySnapshot.valence')}</Text>
                            </View>
                            <View style={[styles.moodTrack, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                                <View style={[styles.moodFill, { width: `${data?.mood?.valence || 50}%`, backgroundColor: '#f59e0b' }]} />
                            </View>
                        </View>
                        <View style={styles.moodBarRow}>
                            <View style={styles.moodBarLabels}>
                                <Text style={[styles.moodBarLabel, { color: colors.textSecondary }]}>{t('dailySnapshot.arousal')}</Text>
                            </View>
                            <View style={[styles.moodTrack, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                                <View style={[styles.moodFill, { width: `${data?.mood?.arousal || 50}%`, backgroundColor: '#f97316', opacity: 0.7 }]} />
                            </View>
                        </View>
                    </View>
                </LargeDetailCard>

                {/* 2. SKIN HEALTH CARD (New Position below Mood) */}
                {data?.skin && (
                    <LargeDetailCard
                        title={t('dailySnapshot.skinHealth')}
                        icon="face-woman-shimmer"
                        color="#ec4899" // Pink
                        mainValue={data.skin.label}
                        topRightContent={
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.largeCardBigScore, { color: colors.text }]}>{data.skin.score}</Text>
                            </View>
                        }
                    >
                        <View style={styles.skinMetricsGrid}>
                            <MetricRow label={t('dailySnapshot.texture')} value={data.skin.texture} color="#ec4899" />
                            <MetricRow label={t('dailySnapshot.oiliness')} value={data.skin.oiliness} color="#f472b6" />
                            <MetricRow label={t('dailySnapshot.hydrationSkin')} value={data.skin.hydration} color="#3b82f6" />
                            <MetricRow label={t('dailySnapshot.redness')} value={data.skin.redness} color="#ef4444" />
                        </View>
                    </LargeDetailCard>
                )}

                {/* 3. GRID (Steps, Hydration, Calories, Sleep) */}
                <View style={styles.gridContainer}>
                    {/* Steps */}
                    <LinearGridCard
                        title={t('dailySnapshot.steps')}
                        value={data?.steps?.count?.toLocaleString() || 0}
                        goal={data?.steps?.goal || 10000}
                        color="#f97316"
                        icon="walk"
                        progress={(data?.steps?.count || 0) / (data?.steps?.goal || 10000)}
                    />

                    {/* Hydration */}
                    <LinearGridCard
                        title={t('dailySnapshot.hydration')}
                        value={data?.hydration?.ml?.toLocaleString() || 0}
                        unit="ml"
                        color="#0ea5e9"
                        icon="cup-water"
                        goal={data?.hydration?.goal || 2000}
                        pillCount={Math.min(5, Math.ceil(((data?.hydration?.ml || 0) / (data?.hydration?.goal || 2000)) * 5))}
                    />

                    {/* Calories */}
                    <LinearGridCard
                        title={t('dailySnapshot.calories')}
                        value={data?.calories?.value?.toLocaleString() || 0}
                        goal={data?.calories?.goal || 500}
                        unit="kcal"
                        color="#eab308"
                        icon="fire"
                        progress={(data?.calories?.value || 0) / (data?.calories?.goal || 500)}
                    />

                    {/* Sleep (Moved to Grid) */}
                    <LinearGridCard
                        title={t('dailySnapshot.sleep')}
                        value={data?.sleep ? `${data.sleep.hours}h ${data.sleep.minutes}m` : '--'}
                        color="#6366f1"
                        icon="bed-outline"
                        customContent={
                            <View style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{data?.sleep?.quality || '--'}</Text>
                                <View style={[styles.progressBarTrack, { marginTop: 8, backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                                    <View style={[styles.progressBarFill, { width: `${Math.min(((data?.sleep?.hours || 0) / 8) * 100, 100)}%`, backgroundColor: '#6366f1' }]} />
                                </View>
                            </View>
                        }
                    />
                </View>

                {/* 4. LIST (Resting, Mindfulness, HRV) */}
                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.listCardLeft}>
                        <View style={[styles.iconGemSmall, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                            <MaterialIcons name="favorite" size={18} color="#ef4444" />
                        </View>
                        <Text style={[styles.listCardTitle, { color: colors.text }]}>{t('dailySnapshot.restingHR')}</Text>
                    </View>
                    <Text style={[styles.listCardValue, { color: colors.text }]}>
                        {data?.restingHR?.value || '--'} <Text style={{ fontSize: 13, color: colors.textSecondary }}>bpm</Text>
                    </Text>
                </View>

                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.listCardLeft}>
                        <View style={[styles.iconGemSmall, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            <MaterialCommunityIcons name="meditation" size={18} color="#10b981" />
                        </View>
                        <Text style={[styles.listCardTitle, { color: colors.text }]}>{t('dailySnapshot.mindfulness')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {data?.mindfulness?.minutes ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} /> : null}
                        <Text style={[styles.listCardValue, { color: colors.text }]}>
                            {data?.mindfulness?.minutes || 0} min
                        </Text>
                    </View>
                </View>

                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.listCardLeft}>
                        <View style={[styles.iconGemSmall, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                            <MaterialCommunityIcons name="pulse" size={18} color="#8b5cf6" />
                        </View>
                        <Text style={[styles.listCardTitle, { color: colors.text }]}>{t('dailySnapshot.hrv')}</Text>
                    </View>
                    <Text style={[styles.listCardValue, { color: colors.text }]}>
                        {data?.hrv?.value || '--'} <Text style={{ fontSize: 13, color: colors.textSecondary }}>ms</Text>
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 70 : 50, // Increased padding
        paddingBottom: 20,
        zIndex: 10,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    content: {
        padding: 20,
        gap: 16,
        paddingTop: 10,
    },

    // Large Detail Card
    largeCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    largeCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    largeCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    largeIconBox: {
        width: 56,
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    largeCardTitleLabel: {
        fontSize: 11,
        fontWeight: '700',
        opacity: 0.8,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    largeCardMainValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    largeCardContent: {},

    // Mood Specifics
    moodMetricsContainer: {
        gap: 12,
    },
    moodBarRow: {},
    moodBarLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    moodBarLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    moodTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    moodFill: {
        height: '100%',
        borderRadius: 4,
    },

    // Skin Metrics
    skinMetricsGrid: {
        gap: 12,
    },
    skinMetricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    skinMetricLabel: {
        fontSize: 13,
        fontWeight: '500',
        width: 80,
    },
    skinMetricTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        maxWidth: 100,
        overflow: 'hidden',
        marginRight: 8,
    },
    skinMetricFill: {
        height: '100%',
        borderRadius: 3,
    },
    skinMetricValue: {
        fontSize: 13,
        fontWeight: '700',
        width: 30,
        textAlign: 'right',
    },
    largeCardBigScore: {
        fontSize: 32,
        fontWeight: '800',
        lineHeight: 32,
    },

    // Grid System
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    gridCard: {
        width: '48%',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        minHeight: 140,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    gridCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    gridIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridBadge: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 8,
    },
    gridCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    gridCardValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 12,
    },
    gridCardValue: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    gridCardUnit: {
        fontSize: 12,
        fontWeight: '500',
    },
    progressBarContainer: {
        gap: 6,
    },
    progressBarTrack: {
        height: 6,
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    goalText: {
        fontSize: 10,
        fontWeight: '500',
    },
    pillsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    hydrationPill: {
        flex: 1,
        height: 24,
        borderRadius: 6,
    },

    // List Items
    listCard: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconGemSmall: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listCardTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    listCardValue: {
        fontSize: 16,
        fontWeight: '700',
    },

    circularCard: {
        width: '48%',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    circularHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    circularLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    circularBody: {
        marginBottom: 12,
    },
    circularValueSmall: {
        fontSize: 18,
        fontWeight: '800',
    },
    circularSubText: {
        fontSize: 10,
    },
});
