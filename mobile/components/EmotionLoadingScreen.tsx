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

interface EmotionLoadingScreenProps {
  onCancel?: () => void;
}

export const EmotionLoadingScreen: React.FC<EmotionLoadingScreenProps> = ({ onCancel }) => {
  // Add a small delay to ensure smooth transition
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
          colors={['#f0f9ff', '#e0f2fe', '#bae6fd']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detectingCard}
        >
          <View style={styles.loadingContainer}>
            <View style={styles.loadingOrb}>
              <FontAwesome name="heart" size={28} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f0f9ff', '#e0f2fe', '#bae6fd']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.detectingCard}
      >
        {/* Enhanced Loading Animation */}
        <View style={styles.loadingContainer}>
          {/* Outer rotating ring */}
          <Animated.View style={[styles.loadingRing, ringRotation]} />
          
          {/* Middle pulsing ring */}
          <Animated.View style={[styles.loadingRingMiddle, pulseAnimation]} />
          
          {/* Inner orb with emotion icon */}
          <Animated.View style={[styles.loadingOrb, pulseAnimation]}>
            <FontAwesome name="heart" size={28} color="#ffffff" />
          </Animated.View>
          
          {/* Floating particles */}
          <Animated.View style={[styles.particle1, particleAnimation1]} />
          <Animated.View style={[styles.particle2, particleAnimation2]} />
          <Animated.View style={[styles.particle3, particleAnimation3]} />
        </View>
        
        <Text style={styles.detectingTitle}>Analyzing Your Emotions</Text>
        <Text style={styles.detectingSubtitle}>AI is mapping micro-expressions and emotional patterns...</Text>
        
        {/* Enhanced Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: '70%', backgroundColor: '#6366f1' }]} />
          </View>
          <Text style={styles.progressText}>70% Complete</Text>
        </View>
        
        {/* Analysis Steps with better design */}
        <View style={styles.analysisSteps}>
          <View style={styles.analysisStep}>
            <View style={[styles.stepIcon, { backgroundColor: '#10b981' }]}>
              <FontAwesome name="check" size={12} color="#ffffff" />
            </View>
            <Text style={styles.analysisStepText}>Image captured</Text>
          </View>
          <View style={styles.analysisStep}>
            <Animated.View style={[styles.stepIcon, { backgroundColor: '#6366f1' }, pulseAnimation]}>
              <FontAwesome name="spinner" size={12} color="#ffffff" />
            </Animated.View>
            <Text style={styles.analysisStepText}>Expression analysis</Text>
          </View>
          <View style={styles.analysisStep}>
            <View style={[styles.stepIcon, { backgroundColor: '#64748b' }]}>
              <FontAwesome name="clock-o" size={12} color="#ffffff" />
            </View>
            <Text style={styles.analysisStepText}>Processing results</Text>
          </View>
        </View>
        
        {/* Additional info */}
        <View style={styles.loadingInfo}>
          <Text style={styles.loadingInfoText}>This may take a few moments...</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  detectingCard: {
    marginHorizontal: 20,
    marginTop: 60,
    borderRadius: 28,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 18,
    shadowColor: '#c7d2fe',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  detectingTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#1e293b' 
  },
  detectingSubtitle: { 
    fontSize: 14, 
    color: '#475569', 
    textAlign: 'center', 
    lineHeight: 20 
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#6366f1',
    borderTopColor: 'transparent',
    position: 'absolute',
  },
  loadingRingMiddle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderTopColor: 'transparent',
    position: 'absolute',
  },
  loadingOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  particle1: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    top: 20,
    left: 30,
  },
  particle2: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
    top: 40,
    right: 25,
  },
  particle3: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a78bfa',
    bottom: 30,
    left: 40,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loadingInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  loadingInfoText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: { 
    height: '100%', 
    borderRadius: 3 
  },
  progressText: {
    fontSize: 12,
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  analysisSteps: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  analysisStep: {
    alignItems: 'center',
    gap: 4,
  },
  analysisStepText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
});

export default EmotionLoadingScreen;
