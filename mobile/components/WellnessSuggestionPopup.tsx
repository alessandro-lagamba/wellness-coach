import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  useSharedValue,
  withSequence,
  withDelay,
  runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { WellnessSuggestion } from '../data/wellnessSuggestions';
import { PanGestureHandler as RNGHPanGestureHandler, State } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

interface WellnessSuggestionPopupProps {
  visible: boolean;
  suggestion: WellnessSuggestion | null;
  onAddToToday: (suggestion: WellnessSuggestion) => void;
  onDismiss: () => void;
  onStartExercise?: (suggestion: WellnessSuggestion) => void;
}

export const WellnessSuggestionPopup: React.FC<WellnessSuggestionPopupProps> = ({
  visible,
  suggestion,
  onAddToToday,
  onDismiss,
  onStartExercise
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-100); // Start from top (negative value)
  const panY = useSharedValue(0);

  useEffect(() => {
    if (visible && suggestion) {
      // Slide down from top animation (like a notification)
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      panY.value = 0; // Reset pan position
    } else {
      // Slide up animation (dismiss)
      translateY.value = withTiming(-100, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.95, { duration: 200 });
      panY.value = 0; // Reset pan position
    }
  }, [visible, suggestion]);

  // Handle swipe up gesture
  const handleGesture = (event: any) => {
    'worklet';
    const { translationY, velocityY, state } = event;
    
    if (state === State.ACTIVE) {
      // Only allow upward swipes (negative translationY)
      if (translationY < 0) {
        panY.value = translationY;
      }
    } else if (state === State.END) {
      // If swiped up enough or with enough velocity, dismiss
      if (translationY < -50 || velocityY < -500) {
        runOnJS(onDismiss)();
      } else {
        // Snap back to original position
        panY.value = withSpring(0);
      }
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value + panY.value }
    ],
    opacity: opacity.value,
  }));

  if (!visible || !suggestion) return null;

  // Gestione sicura dei colori e icona con fallback
  const colors = suggestion.category?.colors?.gradient || ['#10b981', '#059669'];
  const iconName = suggestion.icon || 'heart';

  return (
    <View style={styles.overlay}>
      <RNGHPanGestureHandler onGestureEvent={handleGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <FontAwesome name="times" size={16} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>

            {/* Swipe indicator */}
            <View style={styles.swipeIndicator}>
              <View style={styles.swipeBar} />
            </View>

            {/* Compact content layout */}
            <View style={styles.compactContent}>
              {/* Icon and title row */}
              <View style={styles.titleRow}>
                <View style={styles.iconContainer}>
                  <FontAwesome name={iconName as any} size={20} color="#ffffff" />
                </View>
                <View style={styles.titleContent}>
                  <Text style={styles.title}>{suggestion.title || 'Wellness Activity'}</Text>
                  {suggestion.duration && (
                    <Text style={styles.duration}>{suggestion.duration}</Text>
                  )}
                </View>
              </View>

            {/* Description */}
            <Text style={styles.description}>{suggestion.description || 'A helpful wellness activity for you.'}</Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              {/* Show "Start Exercise" button for breathing exercises */}
              {(suggestion.id === 'breathing-exercises' || suggestion.title?.toLowerCase().includes('breathing')) && onStartExercise ? (
                <TouchableOpacity 
                  style={styles.startButton}
                  onPress={() => onStartExercise(suggestion)}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="play" size={14} color="#ffffff" />
                  <Text style={styles.startButtonText}>
                    Inizia subito l'esercizio
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => onAddToToday(suggestion)}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="plus" size={14} color={colors[0]} />
                  <Text style={[styles.addButtonText, { color: colors[0] }]}>
                    Add to Today
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={onDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>Later</Text>
              </TouchableOpacity>
            </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </RNGHPanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 50, // Account for status bar
    zIndex: 2000,
  },
  container: {
    width: width * 0.9,
    maxWidth: 350,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  gradient: {
    padding: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  swipeIndicator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  swipeBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  compactContent: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  duration: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dismissButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});

export default WellnessSuggestionPopup;
