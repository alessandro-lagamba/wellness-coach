import React, { memo, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
    moodValue: 1 | 2 | 3 | 4 | 5;
    restLevel: 1 | 2 | 3 | 4 | 5;
    onMoodChange: (v: 1 | 2 | 3 | 4 | 5) => void;
    onRestLevelChange: (v: 1 | 2 | 3 | 4 | 5) => void;
    /** When true, the card is locked and user cannot modify values */
    disabled?: boolean;
}

// Colori per i 5 livelli di umore (da negativo rosso a positivo verde)
const MOOD_COLORS = [
    { value: 1, color: '#dc2626', bgColor: 'rgba(220, 38, 38, 0.5)' },   // Rosso scuro
    { value: 2, color: '#ea580c', bgColor: 'rgba(234, 88, 12, 0.5)' },   // Arancione
    { value: 3, color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.5)' },   // Giallo
    { value: 4, color: '#65a30d', bgColor: 'rgba(101, 163, 13, 0.5)' },  // Verde lime
    { value: 5, color: '#16a34a', bgColor: 'rgba(22, 163, 74, 0.5)' },   // Verde scuro
];

// Icone dinamiche per l'umore
const MOOD_ICONS: Record<number, keyof typeof MaterialCommunityIcons.glyphMap> = {
    1: 'emoticon-sad-outline',
    2: 'emoticon-confused-outline',
    3: 'emoticon-neutral-outline',
    4: 'emoticon-happy-outline',
    5: 'emoticon-excited-outline',
};

// Icone dinamiche per il sonno/energia
const SLEEP_ICONS: Record<number, keyof typeof MaterialCommunityIcons.glyphMap> = {
    1: 'battery-10',
    2: 'battery-30',
    3: 'battery-50',
    4: 'battery-70',
    5: 'battery-charging',
};

const DailyMoodCard: React.FC<Props> = memo(({
    moodValue,
    restLevel,
    onMoodChange,
    onRestLevelChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const { colors: themeColors, mode } = useTheme();
    const isDark = mode === 'dark';

    const [sliderValue, setSliderValue] = useState<number>(restLevel);

    useEffect(() => {
        setSliderValue(restLevel);
    }, [restLevel]);

    const handleMoodSelect = (value: 1 | 2 | 3 | 4 | 5) => {
        if (disabled) return; // Locked
        Haptics.selectionAsync();
        onMoodChange(value);
    };

    const handleSliderChange = (value: number) => {
        if (disabled) return; // Locked
        setSliderValue(value);
    };

    const handleSliderComplete = (value: number) => {
        if (disabled) return; // Locked
        // Snappa al valore più vicino (1-5)
        const snappedValue = Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
        setSliderValue(snappedValue);
        Haptics.selectionAsync();
        onRestLevelChange(snappedValue);
    };

    // Colori dinamici basati sul tema
    const containerBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)';
    const containerBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';
    const rowBg = isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(243, 244, 246, 0.9)';
    const rowBorder = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
    const labelColor = isDark ? '#e2e8f0' : '#374151';
    const sliderTrackBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

    // Icone correnti
    const currentMoodIcon = MOOD_ICONS[moodValue] || 'emoticon-neutral-outline';
    const currentSleepIcon = SLEEP_ICONS[Math.round(sliderValue)] || 'battery-50';

    // Calcolo fill width dello slider
    // 1 -> 0%, 5 -> 100%
    const fillPercentage = ((sliderValue - 1) / 4) * 100;

    return (
        <View style={[styles.container, { backgroundColor: containerBg, borderColor: containerBorder, opacity: disabled ? 0.7 : 1 }]}>
            {/* Lock overlay when disabled */}
            {disabled && (
                <View style={styles.lockedOverlay}>
                    <MaterialCommunityIcons name="lock" size={16} color={isDark ? '#94a3b8' : '#6b7280'} />
                    <Text
                        allowFontScaling={false}
                        style={[styles.lockedText, { color: isDark ? '#94a3b8' : '#6b7280' }]}
                    >
                        Compilato oggi
                    </Text>
                </View>
            )}
            {/* Mood Row */}
            <View style={[styles.row, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                <View style={styles.rowLeft}>
                    {/* Icona Umore: ora Celeste come il Sonno */}
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                        <MaterialCommunityIcons name={currentMoodIcon} size={20} color="#60a5fa" />
                    </View>
                    <Text
                        allowFontScaling={false}
                        style={[styles.rowLabel, { color: labelColor }]}
                    >
                        Umore
                    </Text>
                </View>

                <View style={styles.selectorArea}>
                    {MOOD_COLORS.map((item, index) => {
                        const isActive = item.value === moodValue;
                        return (
                            <View key={item.value} style={styles.dotWrapper}>
                                <TouchableOpacity
                                    onPress={() => handleMoodSelect(item.value as 1 | 2 | 3 | 4 | 5)}
                                    activeOpacity={0.7}
                                    style={styles.dotTouchable}
                                >
                                    {isActive ? (
                                        <LinearGradient
                                            colors={['#38bdf8', '#0ea5e9']}
                                            style={styles.activeDot}
                                        >
                                            <MaterialCommunityIcons name="check" size={14} color="#fff" />
                                        </LinearGradient>
                                    ) : (
                                        <View style={[styles.inactiveDot, { backgroundColor: item.bgColor }]} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Sleep Row with Slider */}
            <View style={[styles.row, styles.lastRow, { backgroundColor: rowBg, borderColor: rowBorder }]}>
                <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(96, 165, 250, 0.1)' }]}>
                        <MaterialCommunityIcons name={currentSleepIcon} size={20} color="#60a5fa" />
                    </View>
                    <Text
                        allowFontScaling={false}
                        style={[styles.rowLabel, { color: labelColor }]}
                    >
                        Sonno
                    </Text>
                </View>

                <View style={styles.selectorArea}>
                    <View style={styles.sliderContainer}>
                        {/* Wrapper per le track bars con padding orizzontale per farle finire al centro del thumb agli estremi */}
                        <View style={styles.trackWrapper}>
                            {/* Sfondo slider */}
                            <View style={[styles.sliderTrackBg, { backgroundColor: sliderTrackBg }]} />

                            {/* Fill slider */}
                            <LinearGradient
                                colors={['#6366f1', '#8b5cf6', '#a78bfa']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.sliderTrackFill, { width: `${fillPercentage}%` }]}
                            />
                        </View>

                        {/* Lo Slider DEVE stare sopra e coprire tutto, senza padding, per permettere al thumb di arrivare ai bordi */}
                        <Slider
                            style={styles.slider}
                            minimumValue={1}
                            maximumValue={5}
                            step={0.1}
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            onSlidingComplete={handleSliderComplete}
                            minimumTrackTintColor="transparent"
                            maximumTrackTintColor="transparent"
                            thumbTintColor={isDark ? '#e0e7ff' : '#6366f1'}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 12,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    lockedOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 6,
        marginBottom: 8,
    },
    lockedText: {
        fontSize: 13,
        fontFamily: 'Figtree_500Medium',
    },

    // Rows
    row: {
        height: 56,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 14,
        paddingRight: 20,
        marginBottom: 10,
    },
    lastRow: {
        marginBottom: 0,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: 105,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowLabel: {
        fontSize: 15,
        fontFamily: 'Figtree_700Bold',
    },

    // Selector area
    selectorArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
        maxWidth: 200, // Ridotto ancora un po' (era 220)
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
    },

    // Dot selector
    dotWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotTouchable: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inactiveDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    activeDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        // Glow effect
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 5,
    },

    // Slider
    sliderContainer: {
        flex: 1,
        height: 30,
        justifyContent: 'center',
    },
    trackWrapper: {
        position: 'absolute',
        left: 14, // Thumb radius padding approx
        right: 14, // Thumb radius padding approx
        height: 30,
        justifyContent: 'center',
    },
    sliderTrackBg: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 4,
        borderRadius: 2,
        // top: 13, // Non serve se usiamo justifyContent center nel wrapper
    },
    sliderTrackFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        borderRadius: 2,
        // top: 13,
    },
    slider: {
        width: '100%',
        height: 30,
        // Rimosso padding/margin negativi Android che spesso causano problemi di clipping
    },
});

// Export the component
export { DailyMoodCard };
export default DailyMoodCard;
