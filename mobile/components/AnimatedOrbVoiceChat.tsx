import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  withDelay,
  interpolate,
  useSharedValue,
  withSpring,
  Easing
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width, height } = Dimensions.get('window');

interface AnimatedOrbVoiceChatProps {
  visible: boolean;
  onClose: () => void;
  onVoiceInput: (text: string) => void;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript?: string;
  avatarUri?: string;
}

export const AnimatedOrbVoiceChat: React.FC<AnimatedOrbVoiceChatProps> = ({
  visible,
  onClose,
  onVoiceInput,
  isListening,
  isSpeaking,
  isProcessing,
  transcript,
  avatarUri = 'https://img.heroui.chat/image/avatar?w=320&h=320&u=21'
}) => {
  const orbScale = useSharedValue(1);
  const orbOpacity = useSharedValue(0);
  const orbRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const audioBars = useRef(Array.from({ length: 32 }, () => useSharedValue(0.1)));
  const audioBarStyles = useRef(Array.from({ length: 32 }, (_, index) => 
    useAnimatedStyle(() => ({
      height: interpolate(audioBars.current[index].value, [0, 1], [4, 32]),
    }))
  ));

  useEffect(() => {
    if (visible) {
      // Entrance animation
      orbOpacity.value = withTiming(1, { duration: 500 });
      orbScale.value = withSpring(1, { damping: 15, stiffness: 100 });
    } else {
      orbOpacity.value = withTiming(0, { duration: 300 });
      orbScale.value = withTiming(0.8, { duration: 300 });
    }
  }, [visible]);

  useEffect(() => {
    if (isListening) {
      // Listening animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
      
      // Ripple effect
      rippleScale.value = withRepeat(
        withTiming(2, { duration: 1000 }),
        -1,
        false
      );
      rippleOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        false
      );

      // Audio visualization
      audioBars.current.forEach((bar, index) => {
        bar.value = withRepeat(
          withTiming(Math.random() * 0.8 + 0.2, { duration: 200 }),
          -1,
          true
        );
      });
    } else if (isSpeaking) {
      // Speaking animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else if (isProcessing) {
      // Processing animation
      pulseScale.value = withRepeat(
        withTiming(1.15, { duration: 400 }),
        -1,
        true
      );
    } else {
      // Idle state
      pulseScale.value = withTiming(1, { duration: 300 });
      rippleScale.value = withTiming(0, { duration: 300 });
      rippleOpacity.value = withTiming(0, { duration: 300 });
      
      audioBars.current.forEach(bar => {
        bar.value = withTiming(0.1, { duration: 300 });
      });
    }
  }, [isListening, isSpeaking, isProcessing]);

  const getOrbColors = () => {
    if (isSpeaking) {
      return {
        c1: '#10b981', // Green
        c2: '#059669',
        c3: '#047857',
      };
    }
    if (isListening) {
      return {
        c1: '#3b82f6', // Blue
        c2: '#2563eb',
        c3: '#1d4ed8',
      };
    }
    if (isProcessing) {
      return {
        c1: '#f59e0b', // Orange
        c2: '#d97706',
        c3: '#b45309',
      };
    }
    return {
      c1: '#6366f1', // Purple
      c2: '#4f46e5',
      c3: '#4338ca',
    };
  };

  const getStatusText = () => {
    if (isSpeaking) return 'AI is speaking...';
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    return 'Tap to speak';
  };

  const getStatusColor = () => {
    if (isSpeaking) return '#10b981';
    if (isListening) return '#3b82f6';
    if (isProcessing) return '#f59e0b';
    return '#6366f1';
  };

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [
      { scale: orbScale.value * pulseScale.value }
    ],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const colors = getOrbColors();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="times" size={20} color="#64748b" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Chat</Text>
          <Text style={styles.subtitle}>Speak naturally with your AI coach</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        </View>

        {/* Static Orb */}
        <View style={styles.orbContainer}>
          {/* Main orb */}
          <View style={[styles.orb, orbStyle]}>
            <View style={[styles.orbGradient, { backgroundColor: getStatusColor() }]}>
              {/* Mic icon */}
              <FontAwesome 
                name={isListening ? 'stop' : isSpeaking ? 'volume-up' : 'microphone'} 
                size={32} 
                color="#ffffff" 
              />
            </View>
          </View>
        </View>

        {/* Audio visualization */}
        <View style={styles.audioVisualizer}>
          {audioBarStyles.current.map((style, index) => (
            <Animated.View
              key={index}
              style={[
                styles.audioBar,
                style,
                { backgroundColor: getStatusColor() }
              ]}
            />
          ))}
        </View>

        {/* Status text */}
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>

        {/* Transcript */}
        {transcript && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {isListening ? 'Speak now...' : 'Tap the orb to start speaking'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  rippleGradient: {
    flex: 1,
    borderRadius: 100,
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  innerGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  audioVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 20,
    height: 40,
  },
  audioBar: {
    width: 3,
    backgroundColor: '#6366f1',
    borderRadius: 1.5,
    minHeight: 4,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  transcriptContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    maxWidth: width * 0.8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptText: {
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionsContainer: {
    marginTop: 20,
  },
  instructionsText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default AnimatedOrbVoiceChat;
