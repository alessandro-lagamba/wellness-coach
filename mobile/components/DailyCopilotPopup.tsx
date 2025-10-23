import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import DailyCopilot from './DailyCopilot';

const { width, height } = Dimensions.get('window');

interface DailyCopilotPopupProps {
  visible: boolean;
  onClose: () => void;
}

export const DailyCopilotPopup: React.FC<DailyCopilotPopupProps> = ({
  visible,
  onClose,
}) => {
  // Animation styles
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    };
  });

  const popupStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
      transform: [
        { scale: withTiming(visible ? 1 : 0.9, { duration: 300 }) }
      ],
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View style={[styles.popupContainer, popupStyle]}>
          {/* Header */}
          <LinearGradient
            colors={['#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <Text style={styles.emoji}>🧠</Text>
                <View style={styles.titleTextContainer}>
                  <Text style={styles.title}>AI Daily Copilot</Text>
                  <Text style={styles.subtitle}>Analisi completa per oggi</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <DailyCopilot
              compact={false}
              onRecommendationPress={(recommendation) => {
                console.log('Full copilot recommendation pressed:', recommendation.action);
                // Qui potresti aprire un modal con dettagli specifici
              }}
            />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupContainer: {
    width: width * 0.95,
    height: height * 0.85,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});

export default DailyCopilotPopup;

