import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface TutorialTooltipProps {
    isFirstStep: boolean;
    isLastStep: boolean;
    handleNext: () => void;
    handlePrev: () => void;
    handleStop: () => void;
    currentStep: any;
    labels: {
        skip: string;
        previous: string;
        next: string;
        finish: string;
    };
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
    isFirstStep,
    isLastStep,
    handleNext,
    handlePrev,
    handleStop,
    currentStep,
    labels,
}) => {
    const { colors, mode } = useTheme();
    if (!currentStep) return null;

    return (
        <View style={styles.container}>
            <BlurView intensity={Platform.OS === 'ios' ? 30 : 100} tint={mode === 'dark' ? 'dark' : 'light'} style={styles.blurContainer}>
                <View style={[styles.content, { backgroundColor: mode === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)' }]}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>{currentStep.icon || '✨'}</Text>
                        </View>
                        <TouchableOpacity onPress={handleStop} style={styles.closeButton}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{currentStep.text}</Text>
                    {currentStep.description && (
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            {currentStep.description}
                        </Text>
                    )}

                    <View style={styles.footer}>
                        <View style={styles.progressContainer}>
                            <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                                {currentStep.order} / {currentStep.totalSteps}
                            </Text>
                        </View>

                        <View style={styles.actions}>
                            {!isFirstStep && (
                                <TouchableOpacity onPress={handlePrev} style={[styles.button, styles.prevButton, { borderColor: colors.border }]}>
                                    <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={handleNext} style={styles.nextButtonContainer}>
                                <LinearGradient
                                    colors={['#6366f1', '#4f46e5']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.nextButton}
                                >
                                    <Text style={styles.nextButtonText}>
                                        {isLastStep ? labels.finish : labels.next}
                                    </Text>
                                    <MaterialCommunityIcons
                                        name={isLastStep ? "check" : "arrow-right"}
                                        size={16}
                                        color="#fff"
                                    />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width * 0.85,
        maxWidth: 350,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    blurContainer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    content: {
        padding: 20,
        borderRadius: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 20,
    },
    closeButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontFamily: 'Figtree_700Bold', // Was bold
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
        fontFamily: 'Figtree_500Medium',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressText: {
        fontSize: 12,
        fontFamily: 'Figtree_700Bold', // Was 600
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    prevButton: {
        backgroundColor: 'transparent',
    },
    nextButtonContainer: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    nextButton: {
        height: 36,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Figtree_700Bold', // Was 600
    },
});
