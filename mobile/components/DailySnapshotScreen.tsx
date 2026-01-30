import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/auth.service';
import { FoodAnalysisService } from '../services/food-analysis.service';

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
    } | null;
    sleep?: {
        hours: number;
        minutes: number;
        quality?: string;
        goal?: number;
    };
    steps?: {
        count: number;
        goal: number;
    };
    hydration?: {
        ml: number;
        goal: number;
    };
    hrv?: {
        value: number;
        unit: string;
    };
    calories?: {
        value: number;
        goal: number;
    };
    mindfulness?: {
        minutes: number;
        goal?: number;
    };
    skin?: {
        score: number;
        label: string;
        texture?: number;
        oiliness?: number;
        hydration?: number;
        redness?: number;
    } | null;
    moodCheckin?: {
        score: number;
        label: string;
    };
    sleepCheckin?: {
        score: number;
        label: string;
    };
}

const { width } = Dimensions.get('window');

// ------------------------------
// Helper: Emotion Theme Logic
// ------------------------------
const EMOTION_THEMES: Record<string, { color: string, icon: any }> = {
    neutral: { color: '#f59e0b', icon: 'circle-outline' },
    joy: { color: '#22c55e', icon: 'emoticon-happy-outline' },
    happy: { color: '#22c55e', icon: 'emoticon-happy-outline' },
    sadness: { color: '#f43f5e', icon: 'weather-cloudy' },
    sad: { color: '#f43f5e', icon: 'weather-cloudy' },
    anger: { color: '#ef4444', icon: 'emoticon-angry-outline' },
    fear: { color: '#8b5cf6', icon: 'emoticon-confused-outline' },
    surprise: { color: '#06b6d4', icon: 'emoticon-excited-outline' },
    disgust: { color: '#84cc16', icon: 'emoticon-sad-outline' },
};

const getEmotionTheme = (emotion?: string) => {
    const key = (emotion || 'neutral').toLowerCase();
    return EMOTION_THEMES[key] || EMOTION_THEMES.neutral;
};

const getSkinLabel = (score: number) => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'needsCare';
};

const getCheckinLabel = (score: number) => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'veryGood';
    if (score >= 50) return 'good';
    if (score >= 30) return 'fair';
    return 'poor';
};

// ------------------------------
// "Editorial" Card Component
// ------------------------------
const EditorialCard = ({ children, accentColor }: { children: React.ReactNode, accentColor: string }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';

    return (
        <View style={[
            styles.shadowWrapper,
            {
                shadowColor: isDark ? '#000' : '#475569',
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 8,
                elevation: 2,
            }
        ]}>
            <View style={[
                styles.editorialCard,
                {
                    backgroundColor: isDark ? '#1e293b' : colors.surface,
                    borderColor: isDark ? '#334155' : 'transparent',
                    borderWidth: isDark ? 1 : 0,
                }
            ]}>
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
                <View style={styles.cardContent}>
                    {children}
                </View>
            </View>
        </View>
    );
};

// ------------------------------
// Helper Components
// ------------------------------
const SerifText = ({ style, children, ...props }: any) => {
    const fontFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
    return <Text allowFontScaling={false} style={[{ fontFamily }, style]} {...props}>{children}</Text>;
};

const FigtreeText = ({ style, variant = 'Regular', children, ...props }: any) => {
    const fontFamily = `Figtree_${variant}`;
    return <Text allowFontScaling={false} style={[{ fontFamily }, style]} {...props}>{children}</Text>;
};

const SectionHeader = ({ icon, iconImage, color, title, value, titleStyle, valueStyle }: any) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';

    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? `${color}20` : `${color}10` }]}>
                    {iconImage ? (
                        <Image source={iconImage} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
                    ) : typeof icon === 'string' && icon.length > 2 ? (
                        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                    ) : (
                        <Text allowFontScaling={false} style={{ fontSize: 20 }}>{icon}</Text>
                    )}
                </View>
                <View>
                    <FigtreeText style={[styles.miniLabel, { color: colors.textSecondary }]}>{title}</FigtreeText>
                    <FigtreeText variant="700Bold" style={[styles.mainValue, { color: colors.text }, valueStyle]}>{value}</FigtreeText>
                </View>
            </View>
        </View>
    );
}

export const DailySnapshotScreen: React.FC<DailySnapshotScreenProps> = ({ date, onClose }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SnapshotData | null>(null);

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

            const userProfile = await AuthService.getUserProfile(user.id);
            const preferencesGoals = userProfile?.preferences?.goals || {};
            const calorieGoal = userProfile?.nutritional_goals?.daily_calories || preferencesGoals.calories || 2000;

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
                .from('emotion_analyses')
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

            const calorieIntake = await FoodAnalysisService.getDailyIntake(user.id, dateObj);

            const processed: SnapshotData = {};

            if (emotionData) {
                const rawEmotion = emotionData.dominant_emotion || 'neutral';
                const emotionKey = rawEmotion.toLowerCase().trim();
                const scale = (val: number | null | undefined) => {
                    const num = val || 0;
                    return num <= 1.0 ? Math.round(num * 100) : Math.round(num);
                };
                processed.mood = {
                    value: 3,
                    label: t(`analysis.emotion.names.${emotionKey}`, { defaultValue: rawEmotion }),
                    valence: scale(emotionData.valence),
                    arousal: scale(emotionData.arousal),
                    dominantEmotion: rawEmotion
                };
            } else {
                processed.mood = null;
            }

            if (healthData?.sleep_hours || healthData?.sleep_minutes) {
                const totalMinutes = healthData.sleep_minutes || (healthData.sleep_hours * 60) || 0;
                let qualityKey = null;
                if (checkinData?.sleep_quality > 0) {
                    if (checkinData.sleep_quality > 70) qualityKey = 'restorative';
                    else if (checkinData.sleep_quality > 40) qualityKey = 'fair';
                    else qualityKey = 'poor';
                }
                processed.sleep = {
                    hours: Math.floor(totalMinutes / 60),
                    minutes: Math.round(totalMinutes % 60),
                    quality: qualityKey ? t(`home.sleep.${qualityKey}`) : '--',
                    goal: preferencesGoals.sleep || 8
                };
            } else {
                processed.sleep = { hours: 0, minutes: 0, quality: '--', goal: preferencesGoals.sleep || 8 };
            }

            processed.steps = {
                count: healthData?.steps || 0,
                goal: preferencesGoals.steps || 10000
            };

            const hydrationMl = healthData?.hydration_milliliters || (healthData?.hydration_glasses ? healthData.hydration_glasses * 250 : 0);
            processed.hydration = {
                ml: hydrationMl || 0,
                goal: preferencesGoals.hydration ? (preferencesGoals.hydration * 250) : 2000
            };

            processed.calories = {
                value: calorieIntake.calories || 0,
                goal: calorieGoal
            };

            if (healthData?.hrv) processed.hrv = { value: Math.round(healthData.hrv), unit: 'ms' };
            if (healthData?.mindfulness_minutes) processed.mindfulness = { minutes: healthData.mindfulness_minutes, goal: preferencesGoals.meditation || 10 };

            if (skinData) {
                processed.skin = {
                    score: skinData.overall_score || 0,
                    label: getSkinLabel(skinData.overall_score || 0),
                    texture: skinData.texture_score,
                    oiliness: skinData.oiliness_score,
                    hydration: skinData.hydration_score,
                    redness: skinData.redness_score || 0
                };
            } else {
                processed.skin = null;
            }

            if (checkinData) {
                if (checkinData.mood_value) {
                    const score = (checkinData.mood_value / 5) * 100;
                    processed.moodCheckin = { score, label: getCheckinLabel(score) };
                }
                if (checkinData.sleep_quality !== null) {
                    processed.sleepCheckin = { score: checkinData.sleep_quality, label: getCheckinLabel(checkinData.sleep_quality) };
                }
            }

            setData(processed);
        } catch (error) {
            console.error('Error fetching snapshot data:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderProgressBar = (value: number, color: string, height: number = 6) => (
        <View style={[styles.track, { height, backgroundColor: isDark ? '#333' : '#f5f5f4' }]}>
            <View style={[styles.fill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
        </View>
    );

    const renderStepsBar = () => {
        const heights = [30, 50, 20, 80, 40];
        return (
            <View style={styles.stepsChart}>
                {heights.map((h, i) => (
                    <View key={i} style={[styles.stepBar, { height: `${h}%`, backgroundColor: '#10b981', opacity: i === 3 ? 1 : 0.4 }]} />
                ))}
            </View>
        );
    };

    const emotionTheme = getEmotionTheme(data?.mood?.dominantEmotion);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#fafaf9' }]}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#fafaf9' }]}>
            <View style={[styles.header, { backgroundColor: isDark ? '#0f172a' : '#fafaf9' }]}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <FigtreeText variant="700Bold" style={[styles.headerTitle, { color: colors.text }]}>{t('home.dailySnapshot.title')}</FigtreeText>
                    <FigtreeText variant="700Bold" style={styles.headerSubtitle}>{dateFormatted.toUpperCase()}</FigtreeText>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {data?.mood ? (
                    <EditorialCard accentColor={emotionTheme.color}>
                        <View style={[styles.cardHeaderRow, { justifyContent: 'flex-start', gap: 16 }]}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? `${emotionTheme.color}20` : `${emotionTheme.color}10` }]}>
                                <MaterialCommunityIcons name={emotionTheme.icon} size={24} color={emotionTheme.color} />
                            </View>
                            <View>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.mood').toUpperCase()}</FigtreeText>
                                <SerifText style={[styles.mainValueBig, { color: colors.text }]}>{data.mood.label}</SerifText>
                            </View>
                        </View>
                        <View style={styles.metricsContainer}>
                            <View style={styles.metricRow}>
                                <View style={styles.metricLabelRow}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.valence')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueText}>{data.mood.valence ? Math.round(data.mood.valence) : '--'}</Text>
                                </View>
                                {renderProgressBar(data.mood.valence || 0, emotionTheme.color)}
                            </View>
                            <View style={styles.metricRow}>
                                <View style={styles.metricLabelRow}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.arousal')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueText}>{data.mood.arousal ? Math.round(data.mood.arousal) : '--'}</Text>
                                </View>
                                {renderProgressBar(data.mood.arousal || 0, emotionTheme.color)}
                            </View>
                        </View>
                    </EditorialCard>
                ) : (
                    <EditorialCard accentColor="#94a3b8">
                        <View style={[styles.cardHeaderRow, { justifyContent: 'flex-start', gap: 16 }]}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#94a3b820' : '#f1f5f9' }]}>
                                <MaterialCommunityIcons name="emoticon-neutral-outline" size={24} color="#94a3b8" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.mood').toUpperCase()}</FigtreeText>
                                <FigtreeText variant="500Medium" style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                                    {t('home.dailySnapshot.noMoodData')}
                                </FigtreeText>
                            </View>
                        </View>
                    </EditorialCard>
                )}

                {data?.skin ? (
                    <EditorialCard accentColor="#db2777">
                        <View style={styles.cardHeaderRow}>
                            <SectionHeader icon="face-woman-profile" color="#db2777" title={t('home.dailySnapshot.skinHealth')} value={t(`analysis.gauge.${data.skin.label}`)} />
                            <View style={{ alignItems: 'flex-end' }}>
                                <FigtreeText variant="700Bold" style={[styles.bigScore, { color: colors.text }]}>{data.skin.score}</FigtreeText>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>SCORE</FigtreeText>
                            </View>
                        </View>
                        <View style={styles.skinGrid}>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.texture')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueBold}>{data.skin.texture}</Text>
                                </View>
                                {renderProgressBar(data.skin.texture || 0, '#db2777', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.oiliness')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueBold}>{data.skin.oiliness}</Text>
                                </View>
                                {renderProgressBar(data.skin.oiliness || 0, '#db2777', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.hydrationSkin')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueBold}>{data.skin.hydration}</Text>
                                </View>
                                {renderProgressBar(data.skin.hydration || 0, '#3b82f6', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text allowFontScaling={false} style={styles.metricLabel}>{t('home.dailySnapshot.redness')}</Text>
                                    <Text allowFontScaling={false} style={styles.metricValueBold}>{data.skin.redness}</Text>
                                </View>
                                {renderProgressBar(data.skin.redness || 0, '#ef4444', 4)}
                            </View>
                        </View>
                    </EditorialCard>
                ) : (
                    <EditorialCard accentColor="#94a3b8">
                        <View style={[styles.cardHeaderRow, { justifyContent: 'flex-start', gap: 16 }]}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#94a3b820' : '#f1f5f9' }]}>
                                <MaterialCommunityIcons name="face-recognition" size={20} color="#94a3b8" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.skinHealth').toUpperCase()}</FigtreeText>
                                <FigtreeText variant="500Medium" style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                                    {t('home.dailySnapshot.noSkinData')}
                                </FigtreeText>
                            </View>
                        </View>
                    </EditorialCard>
                )}

                <EditorialCard accentColor="#10b981">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#10b98120' : '#10b98110' }]}>
                                <Image source={require('../assets/images/widgets_logos/steps.png')} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                            </View>
                            <View>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.steps').toUpperCase()}</FigtreeText>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <FigtreeText variant="700Bold" style={[styles.mediumValue, { color: colors.text }]}>{data?.steps?.count?.toLocaleString() || 0}</FigtreeText>
                                    <FigtreeText variant="500Medium" style={styles.unitText}>/ {(data?.steps?.goal || 10000).toLocaleString()}</FigtreeText>
                                </View>
                            </View>
                        </View>
                        {renderStepsBar()}
                    </View>
                </EditorialCard>

                <EditorialCard accentColor="#3b82f6">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#3b82f620' : '#3b82f610' }]}>
                                <Image source={require('../assets/images/widgets_logos/hydration.png')} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                            </View>
                            <View>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.hydration').toUpperCase()}</FigtreeText>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <FigtreeText variant="700Bold" style={[styles.mediumValue, { color: colors.text }]}>{data?.hydration?.ml || 0}</FigtreeText>
                                    <FigtreeText variant="500Medium" style={styles.unitText}>/ {data?.hydration?.goal || 2000} ml</FigtreeText>
                                </View>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <MaterialIcons name="water-drop" size={16} color="#3b82f6" style={{ opacity: 0.6 }} />
                            <MaterialIcons name="water-drop" size={20} color="#3b82f6" style={{ opacity: 0.8 }} />
                            <MaterialIcons name="water-drop" size={24} color="#3b82f6" style={{ opacity: 1 }} />
                        </View>
                    </View>
                </EditorialCard>

                <EditorialCard accentColor="#f97316">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#f9731620' : '#f9731610' }]}>
                                <Image source={require('../assets/images/widgets_logos/calories.png')} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                            </View>
                            <View>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.calories').toUpperCase()}</FigtreeText>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <FigtreeText variant="700Bold" style={[styles.mediumValue, { color: colors.text }]}>{data?.calories?.value || 0}</FigtreeText>
                                    <FigtreeText variant="500Medium" style={styles.unitText}>kcal</FigtreeText>
                                </View>
                            </View>
                        </View>
                        <View style={{ width: 120 }}>
                            {renderProgressBar((data?.calories?.value || 0) / (data?.calories?.goal || 2000) * 100, '#f97316')}
                            <Text allowFontScaling={false} style={[styles.unitText, { textAlign: 'right', marginTop: 10, fontSize: 14 }]}>Goal: {data?.calories?.goal || 2000}</Text>
                        </View>
                    </View>
                </EditorialCard>

                <EditorialCard accentColor="#ffe11dff">
                    <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#F59E0B20' : '#F59E0B10' }]}>
                                <Image source={require('../assets/images/widgets_logos/sleep.png')} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                            </View>
                            <View>
                                <FigtreeText variant="700Bold" style={styles.miniLabel}>{t('home.dailySnapshot.sleep').toUpperCase()}</FigtreeText>
                                <FigtreeText variant="700Bold" style={[styles.mediumValue, { color: colors.text }]}>{data?.sleep ? `${data.sleep.hours}h ${data.sleep.minutes}m` : '--'}</FigtreeText>
                            </View>
                        </View>
                        <View style={[styles.pill, { backgroundColor: isDark ? '#F59E0B20' : '#F59E0B10' }]}>
                            <Text allowFontScaling={false} style={[styles.pillText, { color: '#ffa600ff' }]}>{data?.sleep?.quality || '--'}</Text>
                        </View>
                    </View>
                    <View style={styles.sleepBarContainer}>
                        <View style={[styles.sleepSegment, { flex: 1.5, backgroundColor: '#f5d60b40' }]} />
                        <View style={[styles.sleepSegment, { flex: 4.5, backgroundColor: '#e9c60060' }]} />
                        <View style={[styles.sleepSegment, { flex: 2.5, backgroundColor: '#ffdb10ff' }]} />
                        <View style={[styles.sleepSegment, { flex: 1.5, backgroundColor: '#f5ca0b80' }]} />
                    </View>
                </EditorialCard>

                {(data?.moodCheckin || data?.sleepCheckin) && (
                    <EditorialCard accentColor="#0891b2">
                        <FigtreeText variant="700Bold" style={[styles.miniLabel, { marginBottom: 16 }]}>DAILY CHECK-INS</FigtreeText>
                        <View style={{ gap: 20 }}>
                            {data?.moodCheckin && (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MaterialCommunityIcons name="emoticon-happy-outline" size={18} color="#0891b2" />
                                            <FigtreeText variant="600SemiBold" style={{ fontSize: 13, color: colors.text }}>{t('home.dailySnapshot.moodCheckin')}</FigtreeText>
                                        </View>
                                        <FigtreeText variant="700Bold" style={{ fontSize: 13, color: '#0891b2' }}>{t(`analysis.gauge.${data.moodCheckin.label}`).toUpperCase()}</FigtreeText>
                                    </View>
                                    {renderProgressBar(data.moodCheckin.score, '#0891b2', 8)}
                                </View>
                            )}
                            {data?.sleepCheckin && (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MaterialCommunityIcons name="bed-outline" size={18} color="#034de0ff" />
                                            <FigtreeText variant="600SemiBold" style={{ fontSize: 13, color: colors.text }}>{t('home.dailySnapshot.sleepCheckin')}</FigtreeText>
                                        </View>
                                        <FigtreeText variant="700Bold" style={{ fontSize: 13, color: '#034de0ff' }}>{t(`analysis.gauge.${data.sleepCheckin.label}`).toUpperCase()}</FigtreeText>
                                    </View>
                                    {renderProgressBar(data.sleepCheckin.score, '#034de0ff', 8)}
                                </View>
                            )}
                        </View>
                    </EditorialCard>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 80,
        paddingBottom: 20,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    backButton: { padding: 8, marginLeft: -8 },
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { fontSize: 24, fontFamily: 'Figtree_700Bold', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 15, fontFamily: 'Figtree_700Bold', color: '#a8a29e', letterSpacing: 2, marginTop: 4 },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
    editorialCard: {
        borderRadius: 24,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    shadowWrapper: {
        shadowOffset: { width: 0, height: 8 },
        borderRadius: 24,
    },
    accentBar: { width: 6, height: '100%' },
    cardContent: { flex: 1, padding: 20 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    miniLabel: { fontSize: 12, letterSpacing: 1, color: '#a8a29e' },
    mainValue: { fontSize: 18 },
    mainValueBig: { fontSize: 28, marginTop: 4 },
    sectionHeader: { marginBottom: 12 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    metricsContainer: { marginTop: 20, gap: 16 },
    metricRow: { gap: 8 },
    metricLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricLabel: { fontSize: 14, color: '#a8a29e', fontFamily: 'Figtree_500Medium' },
    metricValueText: { fontSize: 14, fontFamily: 'Figtree_700Bold' },
    track: { width: '100%', borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    skinGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, paddingTop: 16 },
    skinGridItem: { width: '45%', marginBottom: 8 },
    skinMetricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
    metricValueBold: { fontSize: 14, fontFamily: 'Figtree_700Bold', color: '#444' },
    bigScore: { fontSize: 36, fontFamily: 'Figtree_700Bold', lineHeight: 36 },
    mediumValue: { fontSize: 22, fontFamily: 'Figtree_700Bold' },
    unitText: { fontSize: 14, color: '#a8a29e', fontFamily: 'Figtree_500Medium', marginBottom: 2 },
    stepsChart: { flexDirection: 'row', alignItems: 'flex-end', height: 32, gap: 2, width: 100, justifyContent: 'flex-end' },
    stepBar: { width: 8, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    pillText: { fontSize: 14, fontFamily: 'Figtree_700Bold' },
    sleepBarContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1, opacity: 0.9 },
    sleepSegment: { height: '100%' },
});
