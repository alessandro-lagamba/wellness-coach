import React, { useEffect } from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface AvatarProps {
  onMicPress?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({ onMicPress }) => {
  const floatY = useSharedValue(0);
  const scale = useSharedValue(1);
  const micScale = useSharedValue(1);
  const micOpacity = useSharedValue(1);
  const micRotation = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(withTiming(-6, { duration: 1600 }), -1, true);
  }, [floatY]);

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const avatarScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: micScale.value },
      { rotate: `${micRotation.value}deg` }
    ] as any,
    opacity: micOpacity.value,
  }));

  const handleMicPress = () => {
    console.log('Avatar mic button pressed');
    // Call the navigation immediately, before animation
    if (onMicPress) {
      console.log('Calling onMicPress callback');
      onMicPress();
    } else {
      console.log('No onMicPress callback provided');
    }
    
    // Smooth press animation with rotation and opacity
    micScale.value = withSpring(0.85, { damping: 12, stiffness: 200 });
    micRotation.value = withSpring(5, { damping: 15, stiffness: 150 });
    micOpacity.value = withTiming(0.8, { duration: 100 });
    
    // Reset animation
    setTimeout(() => {
      micScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      micRotation.value = withSpring(0, { damping: 15, stiffness: 150 });
      micOpacity.value = withTiming(1, { duration: 200 });
    }, 150);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.avatarContainer, floatingStyle]}>
        <LinearGradient
          colors={['#a855f7', '#8b5cf6']}
          style={styles.avatarBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View style={[styles.avatarImageContainer, avatarScaleStyle]}>
            <Image
              source={{ uri: 'https://img.heroui.chat/image/avatar?w=400&h=400&u=15' }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.micButtonContainer}>
        <Animated.View style={micScaleStyle as any}>
          <TouchableOpacity 
            style={styles.micButton} 
            onPress={handleMicPress} 
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <FontAwesome name="microphone" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBackground: {
    width: 160, // Reduced from 192
    height: 160, // Reduced from 192
    borderRadius: 80, // Reduced from 96
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarImageContainer: {
    width: 144, // Reduced from 176
    height: 144, // Reduced from 176
    borderRadius: 72, // Reduced from 88
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  micButtonContainer: {
    position: 'absolute',
    bottom: -20,
    alignSelf: 'center',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
