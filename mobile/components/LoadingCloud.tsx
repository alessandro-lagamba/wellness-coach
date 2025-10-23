import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  withDelay,
  interpolate,
  useSharedValue
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface LoadingCloudProps {
  message?: string;
  isVisible?: boolean;
}

export const LoadingCloud: React.FC<LoadingCloudProps> = ({ 
  message = "AI is thinking...", 
  isVisible = true 
}) => {
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);
  const cloudScale = useSharedValue(0.8);
  const cloudOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Cloud entrance animation
      cloudOpacity.value = withTiming(1, { duration: 300 });
      cloudScale.value = withTiming(1, { duration: 300 });

      // Dots animation
      const animateDots = () => {
        dot1Opacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0.3, { duration: 200 })
        );
        dot2Opacity.value = withDelay(200, withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0.3, { duration: 200 })
        ));
        dot3Opacity.value = withDelay(400, withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0.3, { duration: 200 })
        ));
      };

      // Start the animation loop
      animateDots();
      const interval = setInterval(animateDots, 1200);
      
      return () => {
        clearInterval(interval);
        cloudOpacity.value = withTiming(0, { duration: 200 });
        cloudScale.value = withTiming(0.8, { duration: 200 });
      };
    }
  }, [isVisible]);

  const cloudStyle = useAnimatedStyle(() => ({
    opacity: cloudOpacity.value,
    transform: [{ scale: cloudScale.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({
    opacity: dot1Opacity.value,
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: dot2Opacity.value,
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: dot3Opacity.value,
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, cloudStyle]}>
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cloud}
      >
        {/* Cloud shape */}
        <View style={styles.cloudShape}>
          {/* Main cloud body */}
          <View style={styles.cloudBody} />
          
          {/* Cloud bumps */}
          <View style={styles.cloudBump1} />
          <View style={styles.cloudBump2} />
          <View style={styles.cloudBump3} />
          <View style={styles.cloudBump4} />
        </View>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>

        {/* Message text */}
        <Text style={styles.messageText}>{message}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  cloud: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  cloudShape: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    height: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cloudBody: {
    width: 60,
    height: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cloudBump1: {
    position: 'absolute',
    left: -4,
    bottom: 2,
    width: 16,
    height: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cloudBump2: {
    position: 'absolute',
    left: 8,
    bottom: 4,
    width: 12,
    height: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cloudBump3: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    width: 12,
    height: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cloudBump4: {
    position: 'absolute',
    right: -4,
    bottom: 2,
    width: 16,
    height: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
  },
  messageText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LoadingCloud;
