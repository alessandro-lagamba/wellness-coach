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
import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');

interface DailyCopilotPopupProps {
  visible: boolean;
  onClose: () => void;
}

export const DailyCopilotPopup: React.FC<DailyCopilotPopupProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();

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
                  <Text style={styles.title}>{t('home.dailyCopilot.title')}</Text>
                  <Text style={styles.subtitle}>{t('home.dailyCopilot.subtitle')}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Score Calculation Section */}
            <View style={styles.infoSection}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="calculator" size={24} color="#8b5cf6" />
                <Text style={styles.sectionTitle}>{t('home.dailyCopilot.info.scoreCalculation')}</Text>
              </View>
              <Text style={styles.sectionDescription}>
                {t('home.dailyCopilot.info.scoreDescription')}
              </Text>
            </View>

            {/* Recommendations Section */}
            <View style={styles.infoSection}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color="#a855f7" />
                <Text style={styles.sectionTitle}>{t('home.dailyCopilot.info.recommendationsTitle')}</Text>
              </View>
              <Text style={styles.sectionDescription}>
                {t('home.dailyCopilot.info.recommendationsDescription')}
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t('home.dailyCopilot.subtitle')}
              </Text>
            </View>
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
    width: width * 0.9,
    maxHeight: height * 0.7,
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
    fontSize: 28,
    marginRight: 12,
  },
  titleTextContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  content: {
    padding: 24,
  },
  infoSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    color: '#1e293b',
    marginLeft: 10,
  },
  sectionDescription: {
    fontSize: 15,
    fontFamily: 'Figtree_400Regular',
    color: '#475569',
    lineHeight: 22,
  },
  footer: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default DailyCopilotPopup;
