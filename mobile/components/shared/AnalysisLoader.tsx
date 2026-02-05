import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    useSharedValue,
    withSpring,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';

interface AnalysisLoaderProps {
    messages?: string[];
    message?: string; // Backwards compatibility
}

const { width } = Dimensions.get('window');

export const AnalysisLoader: React.FC<AnalysisLoaderProps> = ({ messages = [], message }) => {
    const { colors, mode } = useTheme();
    const { t } = useTranslation();
    const isDark = mode === 'dark';
    const [currentIndex, setCurrentIndex] = useState(0);

    // Combine props, prioritizing messages array
    const displayMessages = messages.length > 0 ? messages : [message || t('ui.analyzing')];

    // Animation values
    const progress = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        // Reset state when messages change
        setCurrentIndex(0);
        progress.value = 0;

        // Start progress animation
        progress.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);

        // Pulse animation
        scale.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );

        // Message cycling
        if (displayMessages.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % displayMessages.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [displayMessages.length]);

    const animatedProgressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.wrapper, animatedContainerStyle]}>
                <BlurView
                    intensity={isDark ? 80 : 90} // Increased intensity for glass effect
                    tint={isDark ? 'dark' : 'light'}
                    style={[
                        styles.loaderCard,
                        {
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', // Subtle border
                            backgroundColor: isDark ? 'rgba(20,20,30,0.6)' : 'rgba(255,255,255,0.7)'
                        }
                    ]}
                >
                    <View style={styles.contentRow}>
                        <ActivityIndicator size="large" color={colors.primary} />

                        <View style={styles.textContainer}>
                            {/* Eyebrow Title */}
                            <Text style={[styles.eyebrow, { color: colors.primary }]}>{t('ui.analysisInProgress')}</Text>

                            <Animated.Text
                                key={currentIndex}
                                entering={FadeIn.duration(400)}
                                exiting={FadeOut.duration(400)}
                                style={[styles.message, { color: colors.text }]}
                            >
                                {displayMessages[currentIndex]}
                            </Animated.Text>
                        </View>
                    </View>

                    {/* Gradient Progress Bar */}
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                        <Animated.View style={[styles.progressBarContainer, animatedProgressStyle]}>
                            <LinearGradient
                                colors={['#6366f1', '#a855f7', '#ec4899']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.progressBar}
                            />
                        </Animated.View>
                    </View>
                </BlurView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // Ensure high zIndex
    },
    wrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    loaderCard: {
        paddingVertical: 24, // Increased padding
        paddingHorizontal: 24,
        borderRadius: 24, // More rounded
        borderWidth: 1,
        width: width - 48, // Slightly wider
        maxWidth: 360,
    },
    contentRow: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 16, // Increased gap
    },
    textContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8, // Gap between eyebrow and message
    },
    eyebrow: {
        fontSize: 11,
        fontFamily: 'Figtree_700Bold',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        opacity: 0.9,
    },
    message: {
        fontSize: 16, // Slightly larger
        fontFamily: 'Figtree_700Bold',
        letterSpacing: 0.3,
        textAlign: 'center',
        flexWrap: 'wrap',
        lineHeight: 22, // Better line height
    },
    progressTrack: {
        height: 6, // Slightly thicker
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
        marginTop: 4,
    },
    progressBarContainer: {
        height: '100%',
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        flex: 1,
        width: '100%',
    },
});
