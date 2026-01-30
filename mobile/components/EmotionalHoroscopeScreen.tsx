/**
 * Emotional Horoscope Screen
 * 
 * "Oroscopo (non richiesto)" - The Horoscope You Didn't Ask For
 * 
 * A playful, introspective screen that transforms emotion analysis results
 * into an engaging archetypal role with AI-generated narrative text.
 * Features a galaxy/cosmic background for an ethereal feel.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    ImageBackground,
    ScrollView,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
} from 'react-native-reanimated';

import {
    EmotionInput,
    HoroscopeResult,
    ROLE_METADATA,
    generateEmotionalHoroscope,
} from '../services/emotional-horoscope.service';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

// Galaxy background image
const GALAXY_BACKGROUND = require('../assets/images/galaxy-background.jpg');

// =============================================================================
// PROPS
// =============================================================================

interface EmotionalHoroscopeScreenProps {
    visible: boolean;
    onClose: () => void;
    emotionResult: EmotionInput;
    analysisTimestamp: Date;
    journalText?: string;
}

// =============================================================================
// ROLE EMOJI MAPPING (Placeholder for actual images)
// =============================================================================

// =============================================================================
// CUSTOM ROLE COMPONENTS
// =============================================================================

const DirectorBudgetIcon = () => (
    <View style={iconStyles.container}>
        {/* Main Clapperboard */}
        <View style={iconStyles.clapperboardWrapper}>
            <MaterialCommunityIcons name="movie-outline" size={70} color="#d8b4fe" />
        </View>

        {/* Stars/Sparkles */}
        <MaterialCommunityIcons
            name="star-four-points"
            size={22}
            color="#d8b4fe"
            style={{ position: 'absolute', top: 15, right: 15 }}
        />
        <View style={{ position: 'absolute', bottom: 22, left: 18, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="star-four-points" size={14} color="#d8b4fe" />
            <MaterialCommunityIcons name="star-four-points" size={10} color="#d8b4fe" style={{ marginLeft: 2, marginBottom: 8 }} />
        </View>
    </View>
);

const MetalConcertIcon = () => (
    <View style={iconStyles.container}>
        {/* Outer Ring */}
        <View style={iconStyles.outerRing} />

        {/* Central Icon */}
        <MaterialCommunityIcons name="guitar-electric" size={64} color="#d8b4fe" style={{ marginTop: 5 }} />

        {/* Extra Musical Notes */}
        <MaterialCommunityIcons
            name="music-note"
            size={20}
            color="#d8b4fe"
            style={{ position: 'absolute', top: 40, left: 30, transform: [{ rotate: '-15deg' }] }}
        />
        <MaterialCommunityIcons
            name="music-note"
            size={16}
            color="#d8b4fe"
            style={{ position: 'absolute', bottom: 35, right: 35, transform: [{ rotate: '15deg' }] }}
        />
    </View>
);

// =============================================================================
// ROLE ICON MAPPING
// =============================================================================

type RoleIcon =
    | { type: 'emoji'; value: string }
    | { type: 'icon'; library: 'Feather' | 'MaterialCommunityIcons' | 'Ionicons'; name: string }
    | { type: 'custom'; component: React.ReactNode };

const ROLE_ICONS: Record<string, RoleIcon> = {
    il_regista_con_il_budget: { type: 'custom', component: <DirectorBudgetIcon /> },
    l_equilibrista: { type: 'emoji', value: '⚖️' },
    in_modalita_risparmio: { type: 'emoji', value: '🔋' },
    il_silente: { type: 'icon', library: 'Ionicons', name: 'rainy-outline' },
    un_concerto_metal: { type: 'custom', component: <MetalConcertIcon /> },
    segnale_infrasuono: { type: 'emoji', value: '📡' },
    motore_a_propulsione: { type: 'emoji', value: '🚀' },
    l_attore_senza_oscar: { type: 'emoji', value: '🎭' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const EmotionalHoroscopeScreen: React.FC<EmotionalHoroscopeScreenProps> = ({
    visible,
    onClose,
    emotionResult,
    analysisTimestamp,
    journalText,
}) => {
    const { t, language } = useTranslation();
    const { colors } = useTheme();

    const [isLoading, setIsLoading] = useState(true);
    const [horoscopeResult, setHoroscopeResult] = useState<HoroscopeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Cache: store last analysis timestamp to avoid regeneration
    const lastAnalysisTimestamp = React.useRef<number | null>(null);
    const cachedResult = React.useRef<HoroscopeResult | null>(null);

    // Generate horoscope when modal opens - only if analysis changed
    useEffect(() => {
        if (visible && emotionResult) {
            const currentTimestamp = analysisTimestamp?.getTime() || 0;

            // Check if we have a cached result for this analysis
            if (cachedResult.current && lastAnalysisTimestamp.current === currentTimestamp) {
                // Use cached result
                setHoroscopeResult(cachedResult.current);
                setIsLoading(false);
                setError(null);
            } else {
                // Generate new horoscope
                generateHoroscope(currentTimestamp);
            }
        }
    }, [visible, emotionResult, analysisTimestamp]);

    const generateHoroscope = async (timestamp: number) => {
        setIsLoading(true);
        setError(null);

        try {
            const lang = language === 'en' ? 'en' : 'it';
            const result = await generateEmotionalHoroscope(emotionResult, lang, journalText);
            setHoroscopeResult(result);

            // Cache the result
            cachedResult.current = result;
            lastAnalysisTimestamp.current = timestamp;
        } catch (err) {
            console.error('[EmotionalHoroscopeScreen] Error:', err);
            setError(t('common.error') || 'Si è verificato un errore');
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString(language === 'en' ? 'en-US' : 'it-IT', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" />
            <ImageBackground
                source={GALAXY_BACKGROUND}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                {/* Dark overlay for better text readability */}
                <View style={styles.overlay}>
                    <SafeAreaView style={styles.safeArea}>
                        {/* Header */}
                        <Animated.View
                            entering={FadeIn.delay(100)}
                            style={styles.header}
                        >
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={onClose}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
                            </TouchableOpacity>

                            <Text style={styles.headerTitle}>
                                {language === 'en' ? 'HOROSCOPE (NOT REQUESTED)' : 'L\'OROSCOPO (NON RICHIESTO)'}
                            </Text>

                            {/* Spacer for centering */}
                            <View style={{ width: 40 }} />
                        </Animated.View>

                        {/* Content */}
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Animated.View entering={FadeIn}>
                                        <ActivityIndicator size="large" color="#a855f7" />
                                        <Text style={styles.loadingText}>
                                            {language === 'en'
                                                ? 'Reading the stars...'
                                                : 'Leggo le stelle...'}
                                        </Text>
                                    </Animated.View>
                                </View>
                            ) : error ? (
                                <View style={styles.errorContainer}>
                                    <MaterialCommunityIcons name="alert-circle" size={48} color="#f87171" />
                                    <Text style={styles.errorText}>{error}</Text>
                                    <TouchableOpacity
                                        style={styles.retryButton}
                                        onPress={() => generateHoroscope(analysisTimestamp?.getTime() || 0)}
                                    >
                                        <Text style={styles.retryButtonText}>
                                            {language === 'en' ? 'Retry' : 'Riprova'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : horoscopeResult && (
                                <>
                                    <Animated.View
                                        entering={FadeInUp.delay(200).springify()}
                                        style={styles.emojiContainer}
                                    >
                                        <View style={styles.emojiCircle}>
                                            {(() => {
                                                const iconConfig = ROLE_ICONS[horoscopeResult.role];
                                                if (!iconConfig) return <Text style={styles.emoji}>✨</Text>;

                                                if (iconConfig.type === 'custom') {
                                                    return iconConfig.component;
                                                } else if (iconConfig.type === 'emoji') {
                                                    return <Text style={styles.emoji}>{iconConfig.value}</Text>;
                                                } else {
                                                    let IconLib: any = MaterialCommunityIcons;
                                                    if (iconConfig.library === 'Feather') IconLib = Feather;
                                                    if (iconConfig.library === 'Ionicons') IconLib = Ionicons;

                                                    // @ts-ignore
                                                    return <IconLib name={iconConfig.name} size={64} color="#d8b4fe" />;
                                                }
                                            })()}
                                        </View>
                                    </Animated.View>

                                    {/* Role Title */}
                                    <Animated.View
                                        entering={FadeInDown.delay(300)}
                                        style={styles.titleContainer}
                                    >
                                        <Text style={styles.roleTitle}>
                                            {language === 'en'
                                                ? horoscopeResult.metadata.titleEN
                                                : horoscopeResult.metadata.titleIT}
                                        </Text>
                                        <Text style={styles.roleSubtitle}>
                                            {language === 'en'
                                                ? horoscopeResult.metadata.subtitleEN
                                                : horoscopeResult.metadata.subtitleIT}
                                        </Text>
                                    </Animated.View>

                                    {/* AI Generated Text Card */}
                                    <Animated.View entering={FadeInDown.delay(400)} style={styles.cardContainer}>
                                        <View style={styles.cardOuter}>
                                            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                                            <View style={styles.cardContent}>
                                                <Text style={styles.horoscopeText}>{horoscopeResult.horoscopeText}</Text>
                                            </View>
                                        </View>
                                    </Animated.View>



                                    {/* Disclaimer */}
                                    <Animated.View
                                        entering={FadeIn.delay(500)}
                                        style={styles.disclaimerContainer}
                                    >
                                        <Text style={styles.disclaimerText}>
                                            {language === 'en'
                                                ? "This is not a diagnosis. It's a game of introspection."
                                                : "Questo non è una diagnosi. È un gioco di introspezione."}
                                        </Text>
                                    </Animated.View>
                                </>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </ImageBackground>
        </Modal>
    );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    safeArea: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 70,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 2,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Scroll
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        fontStyle: 'italic',
    },

    // Error
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingTop: 100,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#f87171',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: 'rgba(168, 85, 247, 0.3)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#a855f7',
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },

    // Emoji
    emojiContainer: {
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 15,
    },
    emojiCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderWidth: 2,
        borderColor: 'rgba(168, 85, 247, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
    },
    emoji: {
        fontSize: 64,
    },

    // Badge
    badgeContainer: {
        alignItems: 'center',
        marginBottom: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.4)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#d8b4fe',
        letterSpacing: 1.5,
    },

    // Title
    titleContainer: {
        alignItems: 'center',
        paddingHorizontal: 30,
        marginBottom: 28,
    },
    roleTitle: {
        fontSize: 33,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        fontFamily: Platform.select({ ios: 'Georgia', android: 'PlayfairDisplay_400Regular' }),
        marginBottom: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    roleSubtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        letterSpacing: 0.3,
        lineHeight: 22,
    },

    // Card
    cardOuter: {
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(10, 10, 22, 0.4)', // Higher transparency
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        position: 'relative',
    },
    cardContainer: {
        paddingHorizontal: 28,
        marginBottom: 24,
    },
    cardGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        opacity: 0.35,
    },
    cardContent: {
        paddingVertical: 15,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    horoscopeText: {
        fontSize: 18,
        fontWeight: '300',
        lineHeight: 35,
        color: 'rgba(255,255,255,0.95)',
        textAlign: 'center',
        letterSpacing: 0.35,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardFooterText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '500',
    },

    // Disclaimer
    disclaimerContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: 'auto',
        paddingTop: 20,
    },
    disclaimerText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

const iconStyles = StyleSheet.create({
    container: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    crossBar: {
        position: 'absolute',
        backgroundColor: 'rgba(168, 85, 247, 0.25)', // Lavender cross
        borderRadius: 2,
    },
    clapperboardWrapper: {
        position: 'relative',
        padding: 5,
    },
    tagOverlay: {
        position: 'absolute',
        bottom: 8,
        right: 0,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(216, 180, 254, 0.1)', // Very faint lavender
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#d8b4fe',
        transform: [{ rotate: '45deg' }],
    },
    tagIcon: {
        transform: [{ rotate: '-10deg' }],
    },
    // Metal Concert Icon Styles
    outerRing: {
        position: 'absolute',
        width: 105,
        height: 105,
        borderRadius: 55,
        borderWidth: 1,
        borderColor: 'rgba(216, 180, 254, 0.15)',
    },
});

export default EmotionalHoroscopeScreen;
