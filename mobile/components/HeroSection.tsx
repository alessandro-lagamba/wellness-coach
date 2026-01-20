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

    // Streak text - just the number
    const streakText = useMemo(() => {
        if (language === 'it') {
            return streakDays === 1 ? '1 giorno' : `${streakDays} giorni`;
        }
        return streakDays === 1 ? '1 day' : `${streakDays} days`;
    }, [streakDays, language]);

    // Dynamic gradient colors based on theme
    const gradientColors = themeMode === 'dark'
        ? ['#3a1b69ff', '#221145ff'] as const
        : ['#9b49cbff', '#3a2b9eff'] as const;

    // Border color for avatar
    const avatarBorderColor = themeMode === 'dark'
        ? 'rgba(100, 110, 203, 0.6)'
        : 'rgba(0, 2, 97, 0.5)';

    // Avatar background color
    const avatarBgColor = themeMode === 'dark'
        ? 'rgba(30, 20, 60, 0.8)'
        : 'rgba(200, 180, 230, 0.5)';

    return (
        <View style={styles.container}>
            {/* Hero Card Container with rounded corners */}
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
            >
                {/* Header Row: Greeting + Buttons */}
                <View style={styles.header}>
                    <View style={styles.greetingContainer}>
                        <Text style={styles.greeting}>
                            {language === 'it' ? 'Ciao' : 'Hello'}, <Text style={styles.userName}>{userName}</Text>
                        </Text>
                    </View>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity style={styles.headerButton} onPress={onTutorialPress}>
                            <MaterialCommunityIcons name="help-circle-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={onSettingsPress}>
                            <MaterialCommunityIcons name="cog-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    {/* Avatar - Image if available, otherwise icon */}
                    <TouchableOpacity
                        style={[styles.avatarContainer, { borderColor: avatarBorderColor, backgroundColor: avatarBgColor }]}
                        onPress={onAvatarPress}
                        activeOpacity={0.9}
                    >
                        {avatarUri ? (
                            <Image
                                source={{ uri: avatarUri }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <View style={styles.avatarIconContainer}>
                                <MaterialCommunityIcons name="account" size={80} color="rgba(255, 255, 255, 0.7)" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Mic Button */}
                    <TouchableOpacity style={styles.micButton} onPress={onMicPress} activeOpacity={0.8}>
                        <MaterialCommunityIcons name="microphone" size={25} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Streak Badge - Simple: 🔥 + number */}
                <View style={styles.streakContainer}>
                    <View style={styles.streakBadge}>
                        <Text style={styles.streakIcon}>🔥</Text>
                        <Text style={styles.streakText}>{streakText}</Text>
                    </View>
                </View>

                {/* Action Buttons: Chat & Journal - Circular style */}
                <View style={styles.actionButtons}>
                    {/* Chat Button */}
                    <TouchableOpacity style={styles.actionButtonWrapper} onPress={onChatPress} activeOpacity={0.8}>
                        <View style={[styles.actionButtonCircle, { backgroundColor: '#4c44daff' }]}>
                            <MaterialCommunityIcons name="chat" size={26} color="#fff" />
                        </View>
                        <Text style={styles.actionButtonLabel}>CHAT</Text>
                    </TouchableOpacity>

                    {/* Journal Button */}
                    <TouchableOpacity style={styles.actionButtonWrapper} onPress={onJournalPress} activeOpacity={0.8}>
                        <View style={[styles.actionButtonCircle, { backgroundColor: '#b820f3ff' }]}>
                            <MaterialCommunityIcons name="notebook-outline" size={26} color="#fff" />
                        </View>
                        <Text style={styles.actionButtonLabel}>
                            {language === 'it' ? 'DIARIO' : 'JOURNAL'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
};

const AVATAR_SIZE = 160;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24, // Increased from 8 for more spacing
    },
    heroCard: {
        borderRadius: 24,
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    greetingContainer: {
        flex: 1,
    },
    greeting: {
        fontSize: 20,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '400',
    },
    userName: {
        fontWeight: '700',
        color: '#fff',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarContainer: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 3,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarIconContainer: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    micButton: {
        position: 'absolute',
        bottom: -23,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#373885ff',
    },
    streakContainer: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 16,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    streakIcon: {
        fontSize: 18,
    },
    streakText: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    actionButtonWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    actionButtonCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonLabel: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});

export default HeroSection;
