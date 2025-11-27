/**
 * First Analysis Celebration Component
 * Mostra un modal di congratulazioni quando l'utente completa la prima analisi
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface FirstAnalysisCelebrationProps {
  visible: boolean;
  type: 'emotion' | 'skin' | 'food';
  onClose: () => void;
  onNextAction?: () => void;
}

export const FirstAnalysisCelebration: React.FC<FirstAnalysisCelebrationProps> = ({
  visible,
  type,
  onClose,
  onNextAction,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getConfig = () => {
    switch (type) {
      case 'emotion':
        return {
          icon: 'emoticon-happy',
          gradient: ['#667eea', '#764ba2'],
          title: t('firstAnalysis.emotion.title'),
          description: t('firstAnalysis.emotion.description'),
          nextStep: t('firstAnalysis.emotion.nextStep'),
          nextAction: () => router.push('/(tabs)/skin'),
          nextActionLabel: t('firstAnalysis.emotion.nextAction'),
        };
      case 'skin':
        return {
          icon: 'face-woman-shimmer',
          gradient: ['#f093fb', '#f5576c'],
          title: t('firstAnalysis.skin.title'),
          description: t('firstAnalysis.skin.description'),
          nextStep: t('firstAnalysis.skin.nextStep'),
          nextAction: () => router.push('/(tabs)/food'),
          nextActionLabel: t('firstAnalysis.skin.nextAction'),
        };
      case 'food':
        return {
          icon: 'food',
          gradient: ['#ff9a56', '#ff6a88'],
          title: t('firstAnalysis.food.title'),
          description: t('firstAnalysis.food.description'),
          nextStep: t('firstAnalysis.food.nextStep'),
          nextAction: () => router.push('/coach/chat'),
          nextActionLabel: t('firstAnalysis.food.nextAction'),
        };
    }
  };

  const config = getConfig();
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
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
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={config.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ rotate }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={config.icon as any}
                  size={64}
                  color="#fff"
                />
              </Animated.View>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.subtitle}>{config.description}</Text>
            </LinearGradient>

            <View style={[styles.content, { backgroundColor: colors.surface }]}>
              <View style={styles.achievementBadge}>
                <MaterialCommunityIcons name="trophy" size={32} color={config.gradient[0]} />
                <Text style={[styles.achievementText, { color: colors.text }]}>
                  {t('firstAnalysis.achievement')}
                </Text>
              </View>

              <Text style={[styles.nextStepTitle, { color: colors.text }]}>
                {t('firstAnalysis.whatsNext')}
              </Text>
              <Text style={[styles.nextStepText, { color: colors.textSecondary }]}>
                {config.nextStep}
              </Text>

              <View style={styles.actions}>
                {onNextAction && (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        config.nextAction();
                        onNextAction?.();
                      }, 300);
                    }}
                    style={styles.nextButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={config.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.nextButtonGradient}
                    >
                      <Text style={styles.nextButtonText}>{config.nextActionLabel}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeButton, { borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
                    {t('firstAnalysis.continue')}
                  </Text>
                </TouchableOpacity>
              </View>
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
    padding: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 24,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  achievementText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nextStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  nextStepText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    gap: 12,
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

