// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface SkinLoadingScreenProps {
  onCancel?: () => void;
}

export const SkinLoadingScreen: React.FC<SkinLoadingScreenProps> = ({ onCancel }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Enhanced Loading Animations
  const ringRotation = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withRepeat(withTiming('360deg', { duration: 2000 }), -1, false),
      },
    ],
  }));

  const pulseAnimation = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(withSequence(withTiming(1.2, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, false),
      },
    ],
  }));

  // Particle animations
  const particleAnimation1 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-20, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(10, { duration: 1500 }), withTiming(-10, { duration: 1500 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.8, { duration: 1000 }), withTiming(0.3, { duration: 1000 })), -1, false),
  }));

  const particleAnimation2 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-15, { duration: 1800 }), withTiming(0, { duration: 1800 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(-15, { duration: 1200 }), withTiming(15, { duration: 1200 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.2, { duration: 800 })), -1, false),
  }));

  const particleAnimation3 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(withSequence(withTiming(-25, { duration: 2200 }), withTiming(0, { duration: 2200 })), -1, false),
      },
      {
        translateX: withRepeat(withSequence(withTiming(20, { duration: 1600 }), withTiming(-20, { duration: 1600 })), -1, false),
      },
    ],
    opacity: withRepeat(withSequence(withTiming(0.7, { duration: 1200 }), withTiming(0.1, { duration: 1200 })), -1, false),
  }));

  if (!isVisible) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.accent, colors.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.loadingOrb}>
            <FontAwesome name="leaf" size={40} color={colors.textInverse} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.accent, colors.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Outer expanding circles */}
        <Animated.View style={[styles.outerPulse, styles.outerPulse2]} />
        <Animated.View style={[styles.outerPulse, styles.outerPulse1]} />
        
        {/* Main loading elements */}
        <Animated.View style={[styles.loadingRing, ringRotation, { 
          borderTopColor: colors.accent,
          borderRightColor: colors.accentDark,
          borderBottomColor: colors.accent,
        }]} />
        <Animated.View style={[styles.loadingOrb, pulseAnimation, { 
          backgroundColor: colors.accent,
          shadowColor: colors.accent,
        }]}>
          <FontAwesome name="leaf" size={40} color={colors.textInverse} />
        </Animated.View>
        
        {/* Floating particles */}
        <Animated.View style={[styles.particle, styles.particle1, particleAnimation1, { backgroundColor: colors.accent }]} />
        <Animated.View style={[styles.particle, styles.particle2, particleAnimation2, { backgroundColor: colors.accent }]} />
        <Animated.View style={[styles.particle, styles.particle3, particleAnimation3, { backgroundColor: colors.accent }]} />
        
        {/* Text content */}
        <View style={styles.loadingTextContainer}>
          <Text style={[styles.loadingTitle, { color: colors.textInverse }]}>{t('analysis.skin.loading.title')}</Text>
          <Text style={[styles.loadingSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>
            {t('analysis.skin.loading.subtitle')}
          </Text>
          
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.loadingDot, styles.dot1, { backgroundColor: colors.accent }]} />
            <Animated.View style={[styles.loadingDot, styles.dot2, { backgroundColor: colors.accent }]} />
            <Animated.View style={[styles.loadingDot, styles.dot3, { backgroundColor: colors.accent }]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'transparent',
    top: '40%',
  },
  loadingOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    top: '41%',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  outerPulse1: {
    width: 140,
    height: 140,
  },
  outerPulse2: {
    width: 180,
    height: 180,
    borderRadius: 90,
    top: '39%',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  particle1: {
    top: '30%',
    left: '40%',
  },
  particle2: {
    top: '55%',
    left: '60%',
  },
  particle3: {
    top: '45%',
    left: '65%',
  },
  loadingTextContainer: {
    position: 'absolute',
    top: '60%',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dot1: {},
  dot2: {},
  dot3: {},
});

export default SkinLoadingScreen;
