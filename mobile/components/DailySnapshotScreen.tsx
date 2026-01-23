import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/auth.service';

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
    restingHR?: {
        value: number;
        unit: string;
    };
    calories?: {
        value: number;
        goal: number;
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
    };
}

const { width } = Dimensions.get('window');

// ------------------------------
// "Editorial" Card Component
// ------------------------------
const EditorialCard = ({ children, accentColor }: { children: React.ReactNode, accentColor: string }) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';

    return (
        <View style={[
            styles.editorialCard,
            {
                backgroundColor: colors.surface,
                shadowColor: isDark ? '#000' : '#888',
            }
        ]}>
            <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
            <View style={styles.cardContent}>
                {children}
            </View>
        </View>
    );
};

// ------------------------------
// Helper Components
// ------------------------------

const SerifText = ({ style, children, ...props }: any) => {
    const fontFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
    return <Text style={[{ fontFamily }, style]} {...props}>{children}</Text>;
};

const SectionHeader = ({ icon, color, title, value, titleStyle, valueStyle }: any) => {
    const { colors, mode } = useTheme();
    const isDark = mode === 'dark';

    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? `${color}20` : `${color}10` }]}>
                    {typeof icon === 'string' && icon.length > 2 ? (
                        <MaterialIcons name={icon as any} size={20} color={color} />
                    ) : (
                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                    )}
                </View>
                <View>
                    <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>{title}</Text>
                    <SerifText style={[styles.mainValue, { color: colors.text }, valueStyle]}>{value}</SerifText>
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

    // Date Formatting
    const dateObj = new Date(date);
    const dateFormatted = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-US', {
        month: 'long',
        day: 'numeric'
    }).format(dateObj);
    const yearFormatted = dateObj.getFullYear();

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const user = await AuthService.getCurrentUser();
            if (!user) return;

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
                    arousal: 50,
                    dominantEmotion: '😶'
                };
            } else {
                processed.mood = {
                    value: 0,
                    label: t('home.dailySnapshot.noData'),
                    valence: 0,
                    arousal: 0,
                    dominantEmotion: '?'
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
                    goal: 10000
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

            // CALORIES
            if (healthData?.active_calories || healthData?.calories) {
                processed.calories = {
                    value: healthData.active_calories || healthData.calories,
                    goal: 500
                };
            }

            // BIOMETRICS
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
                    redness: skinData.redness_score || 0
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

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
            </View>
        );
    }

    // --- Render Helpers ---

    const renderProgressBar = (value: number, color: string, height: number = 6) => (
        <View style={[styles.track, { height, backgroundColor: isDark ? '#333' : '#f5f5f4' }]}>
            <View style={[styles.fill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
        </View>
    );

    const renderStepsBar = () => {
        // Mock bars for Steps visualization - in real app could be historical data
        const heights = [30, 50, 20, 80, 40];
        return (
            <View style={styles.stepsChart}>
                {heights.map((h, i) => (
                    <View key={i} style={[styles.stepBar, { height: `${h}%`, backgroundColor: '#ea580c', opacity: i === 3 ? 1 : 0.4 }]} />
                ))}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#0f0f0f' : '#fafaf9' }]}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <SerifText style={[styles.headerTitle, { color: colors.text }]}>{t('home.dailySnapshot.title')}</SerifText>
                    <Text style={styles.headerSubtitle}>{dateFormatted.toUpperCase()}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* 1. MOOD CARD */}
                <EditorialCard accentColor="#d97706">
                    <View style={[styles.cardHeaderRow, { justifyContent: 'center' }]}>
                        <SectionHeader
                            icon={data?.mood?.dominantEmotion ? (data.mood.dominantEmotion === '?' ? 'psychology' : data.mood.dominantEmotion) : 'psychology'}
                            color="#d97706"
                            title={t('home.dailySnapshot.mood')}
                            value={data?.mood?.label}
                            valueStyle={{ fontStyle: 'italic' }}
                        />
                    </View>

                    <View style={styles.metricsContainer}>
                        <View style={styles.metricRow}>
                            <View style={styles.metricLabelRow}>
                                <Text style={styles.metricLabel}>{t('home.dailySnapshot.valence')}</Text>
                                <Text style={styles.metricValueText}>{data?.mood?.valence ? data.mood.valence : '--'}</Text>
                            </View>
                            {renderProgressBar(data?.mood?.valence || 0, '#d97706')}
                        </View>
                        <View style={styles.metricRow}>
                            <View style={styles.metricLabelRow}>
                                <Text style={styles.metricLabel}>{t('home.dailySnapshot.arousal')}</Text>
                                <Text style={styles.metricValueText}>{data?.mood?.arousal ? data.mood.arousal : '--'}</Text>
                            </View>
                            {renderProgressBar(data?.mood?.arousal || 0, '#d97706')}
                        </View>
                    </View>
                </EditorialCard>

                {/* 2. SKIN HEALTH CARD */}
                {data?.skin && (
                    <EditorialCard accentColor="#db2777">
                        <View style={styles.cardHeaderRow}>
                            <SectionHeader
                                icon="face"
                                color="#db2777"
                                title={t('home.dailySnapshot.skinHealth')}
                                value={data.skin.label}
                            />
                            <View style={{ alignItems: 'flex-end' }}>
                                <SerifText style={[styles.bigScore, { color: colors.text }]}>{data.skin.score}</SerifText>
                                <Text style={styles.miniLabel}>SCORE</Text>
                            </View>
                        </View>

                        <View style={styles.skinGrid}>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text style={styles.metricLabel}>{t('home.dailySnapshot.texture')}</Text>
                                    <Text style={styles.metricValueBold}>{data.skin.texture}</Text>
                                </View>
                                {renderProgressBar(data.skin.texture || 0, '#db2777', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text style={styles.metricLabel}>{t('home.dailySnapshot.oiliness')}</Text>
                                    <Text style={styles.metricValueBold}>{data.skin.oiliness}</Text>
                                </View>
                                {renderProgressBar(data.skin.oiliness || 0, '#db2777', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text style={styles.metricLabel}>{t('home.dailySnapshot.hydrationSkin')}</Text>
                                    <Text style={styles.metricValueBold}>{data.skin.hydration}</Text>
                                </View>
                                {renderProgressBar(data.skin.hydration || 0, '#3b82f6', 4)}
                            </View>
                            <View style={styles.skinGridItem}>
                                <View style={styles.skinMetricHeader}>
                                    <Text style={styles.metricLabel}>{t('home.dailySnapshot.redness')}</Text>
                                    <Text style={styles.metricValueBold}>{data.skin.redness}</Text>
                                </View>
                                {renderProgressBar(data.skin.redness || 0, '#ef4444', 4)}
                            </View>
                        </View>
                    </EditorialCard>
                )}

                {/* 3. ACTIVITY CARDS */}
                {/* Steps */}
                <EditorialCard accentColor="#ea580c">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#ea580c20' : '#ea580c10' }]}>
                                <MaterialIcons name="directions-walk" size={20} color="#ea580c" />
                            </View>
                            <View>
                                <Text style={styles.miniLabel}>{t('home.dailySnapshot.steps').toUpperCase()}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <SerifText style={[styles.mediumValue, { color: colors.text }]}>{data?.steps?.count?.toLocaleString() || 0}</SerifText>
                                    <Text style={styles.unitText}>/ 10k</Text>
                                </View>
                            </View>
                        </View>
                        {renderStepsBar()}
                    </View>
                </EditorialCard>

                {/* Hydration */}
                <EditorialCard accentColor="#0ea5e9">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#0ea5e920' : '#0ea5e910' }]}>
                                <MaterialIcons name="local-drink" size={20} color="#0ea5e9" />
                            </View>
                            <View>
                                <Text style={styles.miniLabel}>{t('home.dailySnapshot.hydration').toUpperCase()}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <SerifText style={[styles.mediumValue, { color: colors.text }]}>{data?.hydration?.ml || 0}</SerifText>
                                    <Text style={styles.unitText}>ml</Text>
                                </View>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* Droplets Visualization */}
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={styles.droplet} />
                                ))}
                            </View>
                        </View>
                    </View>
                </EditorialCard>

                {/* Calories */}
                <EditorialCard accentColor="#ca8a04">
                    <View style={styles.cardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#ca8a0420' : '#ca8a0410' }]}>
                                <MaterialIcons name="local-fire-department" size={20} color="#ca8a04" />
                            </View>
                            <View>
                                <Text style={styles.miniLabel}>{t('home.dailySnapshot.calories').toUpperCase()}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <SerifText style={[styles.mediumValue, { color: colors.text }]}>{data?.calories?.value || 0}</SerifText>
                                    <Text style={styles.unitText}>kcal</Text>
                                </View>
                            </View>
                        </View>

                        <View style={{ width: 100 }}>
                            {renderProgressBar((data?.calories?.value || 0) / (data?.calories?.goal || 500) * 100, '#ca8a04')}
                            <Text style={[styles.unitText, { textAlign: 'right', marginTop: 4 }]}>Goal: 500</Text>
                        </View>
                    </View>
                </EditorialCard>

                {/* Sleep */}
                <EditorialCard accentColor="#7c3aed">
                    <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#7c3aed20' : '#7c3aed10' }]}>
                                <MaterialIcons name="bedtime" size={20} color="#7c3aed" />
                            </View>
                            <View>
                                <Text style={styles.miniLabel}>{t('home.dailySnapshot.sleep').toUpperCase()}</Text>
                                <SerifText style={[styles.mediumValue, { color: colors.text }]}>{data?.sleep ? `${data.sleep.hours}h ${data.sleep.minutes}m` : '--'}</SerifText>
                            </View>
                        </View>
                        <View style={[styles.pill, { backgroundColor: isDark ? '#7c3aed20' : '#7c3aed10' }]}>
                            <Text style={[styles.pillText, { color: '#7c3aed' }]}>{data?.sleep?.quality || 'Restorative'}</Text>
                        </View>
                    </View>
                    <View style={styles.sleepBarContainer}>
                        <View style={[styles.sleepSegment, { flex: 1.5, backgroundColor: '#7c3aed40' }]} />
                        <View style={[styles.sleepSegment, { flex: 4.5, backgroundColor: '#7c3aed60' }]} />
                        <View style={[styles.sleepSegment, { flex: 2.5, backgroundColor: '#7c3aed' }]} />
                        <View style={[styles.sleepSegment, { flex: 1.5, backgroundColor: '#7c3aed80' }]} />
                    </View>
                </EditorialCard>

                {/* Heart Rate */}
                <View style={[styles.simpleCard, { backgroundColor: colors.surface, borderLeftColor: '#e11d48', shadowColor: isDark ? '#000' : '#888' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <MaterialIcons name="favorite" size={24} color="#e11d48" />
                        <Text style={[styles.simpleCardTitle, { color: colors.textSecondary }]}>{t('home.dailySnapshot.restingHR')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                        <SerifText style={[styles.mediumValue, { color: colors.text }]}>{data?.restingHR?.value || '--'}</SerifText>
                        <Text style={styles.unitText}>bpm</Text>
                    </View>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 80,
        paddingBottom: 20,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#a8a29e', // Stone 400
        letterSpacing: 2,
        marginTop: 4,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 20,
    },

    // Editorial Card
    editorialCard: {
        borderRadius: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15, // Soft shadow
        elevation: 2,
    },
    accentBar: {
        width: 4,
        height: '100%',
        opacity: 0.8,
    },
    cardContent: {
        flex: 1,
        padding: 24,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // Changed to center for better alignment
    },

    // Section Header
    sectionHeader: {

    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
        color: '#a8a29e',
    },
    mainValue: {
        fontSize: 20,
        fontWeight: '400',
    },

    // Metrics
    metricsContainer: {
        marginTop: 24,
        gap: 16,
    },
    metricRow: {},
    metricLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    metricLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#78716c', // Stone 500
    },
    metricValueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#78716c',
    },
    track: {
        borderRadius: 99,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 99,
    },

    // Skin Grid
    skinGrid: {
        marginTop: 24,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        borderTopWidth: 1,
        borderTopColor: '#f5f5f4', // Stone 100
        paddingTop: 16,
    },
    skinGridItem: {
        width: '45%',
        marginBottom: 8,
    },
    skinMetricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 6,
    },
    metricValueBold: {
        fontSize: 12,
        fontWeight: '700',
        color: '#444',
    },
    bigScore: {
        fontSize: 36,
        lineHeight: 36,
    },

    // Visualizations
    mediumValue: {
        fontSize: 20,
        fontWeight: '500',
    },
    unitText: {
        fontSize: 12,
        color: '#a8a29e',
        fontWeight: '500',
    },
    stepsChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 32,
        gap: 2,
        width: 100,
        justifyContent: 'flex-end',
    },
    stepBar: {
        width: 8,
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
    },
    droplet: {
        width: 8,
        height: 24,
        borderRadius: 4,
        backgroundColor: '#0ea5e9',
        opacity: 0.3,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    sleepBarContainer: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        gap: 1,
        opacity: 0.9,
    },
    sleepSegment: {
        height: '100%',
    },

    // Simple Card
    simpleCard: {
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeftWidth: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
    },
    simpleCardTitle: {
        fontSize: 14,
        fontWeight: '600',
    },

});
