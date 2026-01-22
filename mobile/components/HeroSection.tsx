/**
 * HeroSection - Contained Hero Component for HomeScreen
 * Design based on user's original layout with rounded box container
 */

import React, { useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface HeroSectionProps {
    userName: string;
    avatarUri: string | null;
    streakDays: number;
    onMicPress: () => void;
    onChatPress: () => void;
    onJournalPress: () => void;
    onTutorialPress: () => void;
    onSettingsPress: () => void;
    onAvatarPress?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
    userName,
    avatarUri,
    streakDays,
    onMicPress,
    onChatPress,
    onJournalPress,
    onTutorialPress,
    onSettingsPress,
    onAvatarPress,
}) => {
    const { t, language } = useTranslation();
    const { colors, mode: themeMode } = useTheme();
    const isDark = themeMode === 'dark';
    // Dynamic Greeting
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (language === 'it') {
            if (h >= 5 && h < 12) return 'Buongiorno,';
            if (h >= 12 && h < 18) return 'Buon pomeriggio,';
            return 'Buonasera,';
        } else {
            if (h >= 5 && h < 12) return 'Good morning,';
            if (h >= 12 && h < 18) return 'Good afternoon,';
            return 'Good evening,';
        }
    }, [language]);

    // Streak text
    const streakText = useMemo(() => {
        if (language === 'it') {
            return streakDays === 1 ? '1 Giorno Consecutivo' : `${streakDays} Giorni Consecutivi`;
        }
        return streakDays === 1 ? '1 Day Streak' : `${streakDays} Days Streak`;
    }, [streakDays, language]);

    return (
        <View style={styles.container}>
            {/* Top Navigation Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={onTutorialPress}
                >
                    <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={onSettingsPress}
                >
                    <MaterialCommunityIcons name="cog-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Content Container */}
            <View style={styles.content}>

                {/* Greetings & Streak */}
                <View style={styles.headerText}>
                    <Text
                        style={[styles.greeting, { color: colors.text }]}
                        allowFontScaling={false}
                    >
                        {greeting} <Text style={{ fontWeight: '400' }} allowFontScaling={false}>{userName}</Text>
                    </Text>

                    {/* Streak Pill - Moved here to be under greeting as requested implicitely by "remove date" */}
                    <View style={[styles.streakPill, {
                        backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                        borderColor: 'rgba(251, 191, 36, 0.5)',
                        marginTop: 8,
                        marginBottom: 0,
                    }]}>
                        <MaterialCommunityIcons name="fire" size={16} color="#f59e0b" />
                        <Text
                            style={[styles.streakText, { color: isDark ? '#fcd34d' : '#475569' }]}
                            allowFontScaling={false}
                        >
                            {streakText}
                        </Text>
                    </View>
                </View>

                {/* Avatar Section with Aura */}
                <View style={styles.avatarZone}>
                    {/* Aura Background (Radial Gradient) */}
                    <View style={styles.auraContainer}>
                        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                            <Defs>
                                <RadialGradient id="auraGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                                    {/* Center - Darker/Intense */}
                                    <Stop offset="0%" stopColor={isDark ? '#818cf8' : '#be123c'} stopOpacity={isDark ? 0.5 : 0.7} />
                                    {/* Mid - Fade */}
                                    <Stop offset="60%" stopColor={isDark ? '#4f46e5' : '#f472b6'} stopOpacity={isDark ? 0.1 : 0.2} />
                                    {/* Outer - Transparent */}
                                    <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
                                </RadialGradient>
                            </Defs>
                            <Rect x="0" y="0" width="100%" height="100%" fill="url(#auraGrad)" />
                        </Svg>
                    </View>

                    {/* Main Avatar */}
                    <TouchableOpacity
                        style={[styles.avatarWrapper, {
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        }]}
                        onPress={onAvatarPress}
                        activeOpacity={0.9}
                    >
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <MaterialCommunityIcons name="account" size={100} color={isDark ? '#cbd5e1' : '#94a3b8'} />
                        )}
                    </TouchableOpacity>

                    {/* Mic Button - Centered below avatar, Blue color */}
                    <TouchableOpacity
                        style={[styles.micButton, {
                            backgroundColor: colors.primary, // Using primary color (Blue/Violet) as requested
                            borderColor: isDark ? '#0f172a' : '#fff'
                        }]}
                        onPress={onMicPress}
                    >
                        <MaterialCommunityIcons name="microphone" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        style={[styles.glassButton, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.3)',
                        }]}
                        onPress={onChatPress}
                    >
                        <MaterialCommunityIcons name="chat-processing-outline" size={22} color={colors.primary} />
                        <Text style={[styles.glassButtonText, { color: colors.text }]} allowFontScaling={false}>CHAT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.glassButton, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.3)',
                        }]}
                        onPress={onJournalPress}
                    >
                        <MaterialCommunityIcons name="notebook-edit-outline" size={22} color={colors.primary} />
                        <Text style={[styles.glassButtonText, { color: colors.text }]} allowFontScaling={false}>
                            {language === 'it' ? 'DIARIO' : 'JOURNAL'}
                        </Text>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
};

const AVATAR_SIZE = 180; // Increased from 140

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 0,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    headerText: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    greeting: {
        fontSize: 34,
        fontFamily: 'Figtree_400Regular', // Using Figtree
        fontWeight: '400',
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: 4,
    },
    // Removed dateText style
    streakPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
        borderWidth: 1,
        gap: 6,
    },
    streakText: {
        fontSize: 14,
        fontFamily: 'Figtree_700Bold', // Using Figtree Bold
        letterSpacing: 0.5,
    },
    avatarZone: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: AVATAR_SIZE * 1.6, // Expanded aura zone
        height: AVATAR_SIZE * 1.6,
        marginBottom: 20, // Reduced spacing
    },
    auraContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    auraGradient: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 999, // Circular
    },
    avatarWrapper: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 5, // Thicker border
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible', // Changed to visible for mic button overlap if needed, but mic is absolute sibling
        // Shadow optimized
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: AVATAR_SIZE / 2, // Need to apply radius to image if wrapper has it
    },
    micButton: {
        position: 'absolute',
        bottom: 26, // Overlap bottom
        left: '50%',
        marginLeft: -28, // Half width
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3, // Thicker border to merge with avatar border visual
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    // Removed micGradient style as we use solid bg now
    actionButtonsRow: {
        flexDirection: 'row',
        width: '100%',
        paddingHorizontal: 24,
        gap: 16,
    },
    glassButton: {
        flex: 1,
        height: 52, // Smaller as requested
        borderRadius: 26,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    glassButtonText: {
        fontSize: 14,
        fontFamily: 'Figtree_700Bold', // Using Figtree Bold
        letterSpacing: 1.2,
    }
});

export default HeroSection;
