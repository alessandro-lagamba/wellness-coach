/**
 * First Analysis Celebration Component
 * Mostra un modal di congratulazioni quando l'utente completa la prima analisi
 * Design migliorato con animazioni più elaborate e aspetto premium
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

const { width, height } = Dimensions.get('window');

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
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Haptic feedback più intenso
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
      
      // Animazioni elaborate
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        // Animazione confetti
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation continua
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
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
    outputRange: ['0deg', '15deg'],
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
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.blur}>
          <Animated.View
            style={[
              styles.container,
              {
                backgroundColor: colors.surface,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideUpAnim },
                ],
              },
            ]}
          >
            {/* Header con gradiente migliorato */}
            <LinearGradient
              colors={[...config.gradient, `${config.gradient[1]}dd`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              {/* Decorazioni di sfondo */}
              <View style={styles.headerDecorations}>
                <View style={[styles.decorCircle, styles.decorCircle1]} />
                <View style={[styles.decorCircle, styles.decorCircle2]} />
                <View style={[styles.decorCircle, styles.decorCircle3]} />
              </View>

              {/* Icona con animazione pulse */}
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [
                      { rotate },
                      { scale: pulseAnim },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.iconGradient}
                >
                  <MaterialCommunityIcons
                    name={config.icon as any}
                    size={56}
                    color="#fff"
                  />
                </LinearGradient>
              </Animated.View>

              {/* Emoji celebrazione */}
              <Text style={styles.celebrationEmoji}>🎉</Text>

              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.subtitle}>{config.description}</Text>
            </LinearGradient>

            {/* Contenuto migliorato */}
            <View style={[styles.content, { backgroundColor: colors.surface }]}>
              {/* Badge achievement con sfondo colorato */}
              <View style={[styles.achievementBadge, { backgroundColor: `${config.gradient[0]}15` }]}>
                <View style={[styles.trophyCircle, { backgroundColor: `${config.gradient[0]}20` }]}>
                  <MaterialCommunityIcons name="trophy" size={28} color={config.gradient[0]} />
                </View>
                <Text style={[styles.achievementText, { color: colors.text }]}>
                  {t('firstAnalysis.achievement')}
                </Text>
              </View>

              {/* Sezione "Cosa puoi fare ora" */}
              <View style={[styles.nextStepCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
                <Text style={[styles.nextStepTitle, { color: colors.text }]}>
                  {t('firstAnalysis.whatsNext')}
                </Text>
                <Text style={[styles.nextStepText, { color: colors.textSecondary }]}>
                  {config.nextStep}
                </Text>
              </View>

              {/* Pulsante principale con gradiente */}
              <TouchableOpacity
                onPress={onClose}
                style={styles.primaryButton}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={config.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>
                    {t('firstAnalysis.continue')}
                  </Text>
                </LinearGradient>
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
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    padding: 28,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorCircle1: {
    width: 100,
    height: 100,
    top: -30,
    right: -20,
  },
  decorCircle2: {
    width: 60,
    height: 60,
    bottom: 20,
    left: -20,
  },
  decorCircle3: {
    width: 40,
    height: 40,
    top: 40,
    left: 30,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  celebrationEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 10,
  },
  trophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  nextStepCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  nextStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  nextStepText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
});

