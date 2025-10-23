import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = 'Analyzing expressions',
  subtitle = 'Processing facial micro-expressions and emotional patterns...',
}) => {
  // Main rotating ring
  const ringRotation = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withRepeat(withTiming('360deg', { duration: 3000 }), -1, false),
      },
    ],
  }));

  // Inner pulsing orb
  const pulseAnimation = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(0.9, { duration: 1200 }),
            withTiming(1.1, { duration: 1200 }),
            withTiming(0.9, { duration: 1200 })
          ),
          -1,
          false
        ),
      },
    ],
    opacity: withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
        withTiming(0.6, { duration: 1200 })
      ),
      -1,
      false
    ),
  }));

  // Outer expanding circles
  const outerPulse1 = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1, { duration: 2000 }),
            withTiming(1.5, { duration: 2000 }),
            withTiming(1, { duration: 2000 })
          ),
          -1,
          false
        ),
      },
    ],
    opacity: withRepeat(
      withSequence(
        withTiming(0.4, { duration: 2000 }),
        withTiming(0.1, { duration: 2000 }),
        withTiming(0.4, { duration: 2000 })
      ),
      -1,
      false
    ),
  }));

  const outerPulse2 = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.2, { duration: 2500 }),
            withTiming(1.8, { duration: 2500 }),
            withTiming(1.2, { duration: 2500 })
          ),
          -1,
          false
        ),
      },
    ],
    opacity: withRepeat(
      withSequence(
        withTiming(0.3, { duration: 2500 }),
        withTiming(0.05, { duration: 2500 }),
        withTiming(0.3, { duration: 2500 })
      ),
      -1,
      false
    ),
  }));

  // Floating particles
  const particle1 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(
            withTiming(0, { duration: 1000 }),
            withTiming(-20, { duration: 1000 }),
            withTiming(0, { duration: 1000 })
          ),
          -1,
          false
        ),
      },
      {
        rotate: withRepeat(withTiming('360deg', { duration: 4000 }), -1, false),
      },
    ],
  }));

  const particle2 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(
            withTiming(0, { duration: 1200 }),
            withTiming(-30, { duration: 1200 }),
            withTiming(0, { duration: 1200 })
          ),
          -1,
          false
        ),
      },
      {
        rotate: withRepeat(withTiming('-360deg', { duration: 3500 }), -1, false),
      },
    ],
  }));

  const particle3 = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(
            withTiming(0, { duration: 900 }),
            withTiming(-25, { duration: 900 }),
            withTiming(0, { duration: 900 })
          ),
          -1,
          false
        ),
      },
      {
        rotate: withRepeat(withTiming('360deg', { duration: 4500 }), -1, false),
      },
    ],
  }));

  // Animated dots with timing offset
  const dotsAnimation = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800 }),
        withTiming(1, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(0.8, { duration: 800 }),
            withTiming(1.2, { duration: 800 }),
            withTiming(0.8, { duration: 800 })
          ),
          -1,
          false
        ),
      },
    ],
  }));

  return (
    <View style={styles.loadingContainer}>
      {/* Outer expanding circles */}
      <Animated.View style={[styles.outerPulse, outerPulse2]} />
      <Animated.View style={[styles.outerPulse, outerPulse1]} />
      
      {/* Main loading elements */}
      <Animated.View style={[styles.loadingRing, ringRotation]} />
      <Animated.View style={[styles.loadingOrb, pulseAnimation]} />
      
      {/* Floating particles */}
      <Animated.View style={[styles.particle, styles.particle1, particle1]} />
      <Animated.View style={[styles.particle, styles.particle2, particle2]} />
      <Animated.View style={[styles.particle, styles.particle3, particle3]} />
      
      {/* Text content */}
      <View style={styles.loadingTextContainer}>
        <Text style={styles.detectingTitle}>{title}</Text>
        <Text style={styles.detectingSubtitle}>
          {subtitle}
        </Text>
        
        <View style={styles.loadingDots}>
          <Animated.View style={[styles.loadingDot, styles.dot1, dotsAnimation]} />
          <Animated.View style={[styles.loadingDot, styles.dot2, dotsAnimation]} />
          <Animated.View style={[styles.loadingDot, styles.dot3, dotsAnimation]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: '#8b5cf6',
    borderRightColor: '#a855f7',
    borderBottomColor: '#c084fc',
    top: 140,
  },
  loadingOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#8b5cf6',
    top: 170,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  outerPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    top: 155,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
  },
  particle1: {
    top: 100,
    left: width / 2 - 50,
  },
  particle2: {
    top: 250,
    left: width / 2 + 30,
  },
  particle3: {
    top: 180,
    left: width / 2 + 45,
  },
  loadingTextContainer: {
    position: 'absolute',
    top: 320,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  detectingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  detectingSubtitle: {
    fontSize: 16,
    color: '#64748b',
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
    backgroundColor: '#8b5cf6',
  },
  dot1: {},
  dot2: {},
  dot3: {},
});
