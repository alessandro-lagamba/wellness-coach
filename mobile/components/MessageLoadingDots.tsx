import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  withDelay,
  useSharedValue
} from 'react-native-reanimated';

interface MessageLoadingDotsProps {
  isVisible?: boolean;
}

export const MessageLoadingDots: React.FC<MessageLoadingDotsProps> = ({ 
  isVisible = true 
}) => {
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);

  useEffect(() => {
    if (isVisible) {
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

      animateDots();
      const interval = setInterval(animateDots, 1200);
      
      return () => clearInterval(interval);
    }
  }, [isVisible]);

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
    <View style={styles.container}>
      <Animated.View style={[styles.dot, dot1Style]} />
      <Animated.View style={[styles.dot, dot2Style]} />
      <Animated.View style={[styles.dot, dot3Style]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
});

export default MessageLoadingDots;
