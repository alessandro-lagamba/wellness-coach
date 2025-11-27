/**
 * WelcomeOverlay Component
 * Mostra suggerimenti contestuali per nuovi utenti nella HomeScreen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useAnalysisStore } from '../stores/analysis.store';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WelcomeOverlayProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: 'emotion' | 'skin' | 'food' | 'widgets') => void;
}

const WELCOME_DISMISSED_KEY = 'welcome_overlay_dismissed';

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  visible,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  const latestEmotionSession = useAnalysisStore((state) => state.latestEmotionSession);
  const latestSkinCapture = useAnalysisStore((state) => state.latestSkinCapture);
  const latestFoodSession = useAnalysisStore((state) => state.latestFoodSession);

  const hasAnyAnalysis = !!(latestEmotionSession || latestSkinCapture || latestFoodSession);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = async () => {
    await AsyncStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    onClose();
  };

  const handleAction = (action: 'emotion' | 'skin' | 'food' | 'widgets') => {
    onAction(action);
    handleDismiss();
  };

  if (!visible) return null;

  const suggestions = [
    {
      id: 'emotion',
      icon: 'emoticon-happy',
      title: t('welcomeOverlay.suggestions.emotion.title'),
      description: t('welcomeOverlay.suggestions.emotion.description'),
      gradient: ['#667eea', '#764ba2'],
      action: () => {
        router.push('/(tabs)/analysis');
        handleAction('emotion');
      },
      visible: !latestEmotionSession,
    },
    {
      id: 'skin',
      icon: 'face-woman-shimmer',
      title: t('welcomeOverlay.suggestions.skin.title'),
      description: t('welcomeOverlay.suggestions.skin.description'),
      gradient: ['#f093fb', '#f5576c'],
      action: () => {
        router.push('/(tabs)/skin');
        handleAction('skin');
      },
      visible: !latestSkinCapture,
    },
    {
      id: 'food',
      icon: 'food',
      title: t('welcomeOverlay.suggestions.food.title'),
      description: t('welcomeOverlay.suggestions.food.description'),
      gradient: ['#ff9a56', '#ff6a88'],
      action: () => {
        router.push('/(tabs)/food');
        handleAction('food');
      },
      visible: !latestFoodSession,
    },
    {
      id: 'widgets',
      icon: 'view-dashboard',
      title: t('welcomeOverlay.suggestions.widgets.title'),
      description: t('welcomeOverlay.suggestions.widgets.description'),
      gradient: ['#43e97b', '#38f9d7'],
      action: () => {
        // Widget selection will be handled by parent
        handleAction('widgets');
      },
      visible: true, // Always show widget suggestion
    },
  ].filter(s => s.visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <BlurView intensity={20} tint="dark" style={styles.blur}>
          <Animated.View
            style={[
              styles.container,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2', '#f093fb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <MaterialCommunityIcons name="sparkles" size={32} color="#fff" />
                <Text style={styles.title}>{t('welcomeOverlay.title')}</Text>
                <Text style={styles.subtitle}>{t('welcomeOverlay.subtitle')}</Text>
              </View>
              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={[styles.content, { backgroundColor: colors.surface }]}>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {t('welcomeOverlay.description')}
              </Text>

              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    onPress={suggestion.action}
                    style={styles.suggestionCard}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={suggestion.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.suggestionGradient}
                    >
                      <MaterialCommunityIcons
                        name={suggestion.icon as any}
                        size={24}
                        color="#fff"
                      />
                      <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <Text style={styles.suggestionDescription}>
                          {suggestion.description}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color="#fff"
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleDismiss}
                style={[styles.dismissButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.dismissButtonText, { color: colors.textSecondary }]}>
                  {t('welcomeOverlay.dismiss')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    padding: 24,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
  },
  content: {
    padding: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  suggestionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  suggestionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  suggestionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

// Helper function to check if welcome overlay should be shown
export const shouldShowWelcomeOverlay = async (): Promise<boolean> => {
  try {
    const dismissed = await AsyncStorage.getItem(WELCOME_DISMISSED_KEY);
    if (dismissed === 'true') {
      return false;
    }

    // Check if user has completed onboarding and tutorial
    const { OnboardingService } = await import('../services/onboarding.service');
    const [onboardingCompleted, tutorialCompleted] = await Promise.all([
      OnboardingService.isOnboardingCompleted(),
      OnboardingService.isTutorialCompleted(),
    ]);

    // Only show if onboarding and tutorial are completed
    return onboardingCompleted && tutorialCompleted;
  } catch (error) {
    console.error('Error checking welcome overlay status:', error);
    return false;
  }
};

