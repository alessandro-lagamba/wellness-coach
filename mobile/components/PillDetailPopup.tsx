import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  withSpring,
  runOnJS 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MomentumData } from '../services/momentum.service';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n

const { width, height } = Dimensions.get('window');

interface PillDetailPopupProps {
  visible: boolean;
  onClose: () => void;
  type: 'streak' | 'momentum' | 'next-session';
  data?: any;
  momentumData?: MomentumData;
}

const PillDetailPopup: React.FC<PillDetailPopupProps> = ({
  visible,
  onClose,
  type,
  data,
  momentumData
}) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.95, { duration: 200 });
      translateY.value = withTiming(20, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const getContent = () => {
    switch (type) {
      case 'streak':
        return {
          title: `🔥 ${t('popups.pillDetail.streak.title')}`,
          subtitle: t('popups.pillDetail.streak.subtitle'),
          icon: 'fire',
          color: '#f97316',
          gradient: ['#f97316', '#dc2626'], // Orange to Red
          details: [
            {
              title: t('popups.pillDetail.streak.currentStreak'),
              value: '12 days',
              description: t('popups.pillDetail.streak.currentStreakDesc', { days: 12 })
            },
            {
              title: t('popups.pillDetail.streak.bestStreak'),
              value: '28 days',
              description: t('popups.pillDetail.streak.bestStreakDesc', { days: 28 })
            },
            {
              title: t('popups.pillDetail.streak.goal'),
              value: '30 days',
              description: t('popups.pillDetail.streak.goalDesc', { percent: 60 })
            },
            {
              title: t('popups.pillDetail.streak.tips'),
              value: t('popups.pillDetail.streak.keepItUp'),
              description: t('popups.pillDetail.streak.tipsDesc')
            }
          ]
        };

      case 'momentum':
        return {
          title: `📈 ${t('popups.pillDetail.momentum.title')}`,
          subtitle: t('popups.pillDetail.momentum.subtitle'),
          icon: 'line-chart',
          color: momentumData ? getMomentumColor(momentumData.trend) : '#6366f1',
          gradient: momentumData ? getMomentumGradient(momentumData.trend) : ['#10b981', '#059669'], // Green gradient
          details: [
            {
              title: t('popups.pillDetail.momentum.current'),
              value: momentumData ? `${momentumData.percentage}%` : t('common.loading'),
              description: t('popups.pillDetail.momentum.currentDesc', { 
                completed: momentumData?.completedTasks || 0, 
                total: momentumData?.totalTasks || 0 
              })
            },
            {
              title: t('popups.pillDetail.momentum.trend'),
              value: momentumData ? getTrendText(momentumData.trend) : t('popups.pillDetail.momentum.stable'),
              description: momentumData ? t(`popups.pillDetail.momentum.trendDesc.${momentumData.trend}`, { 
                percent: momentumData.trendPercentage 
              }) : t('popups.pillDetail.momentum.noTrend')
            },
            {
              title: t('popups.pillDetail.momentum.completionRate'),
              value: momentumData ? `${momentumData.percentage}%` : 'N/A',
              description: t('popups.pillDetail.momentum.completionRateDesc')
            },
            {
              title: t('popups.pillDetail.momentum.tips'),
              value: t('popups.pillDetail.momentum.keepBuilding'),
              description: t('popups.pillDetail.momentum.tipsDesc')
            }
          ]
        };

      case 'next-session':
        return {
          title: `📅 ${t('popups.pillDetail.nextSession.title')}`,
          subtitle: t('popups.pillDetail.nextSession.subtitle'),
          icon: 'calendar',
          color: '#8b5cf6',
          gradient: ['#3b82f6', '#1d4ed8'], // Blue gradient
          details: [
            {
              title: t('popups.pillDetail.nextSession.scheduledTime'),
              value: `${t('home.analyses.today')} • 6:00 PM`,
              description: t('popups.pillDetail.nextSession.scheduledTimeDesc')
            },
            {
              title: t('popups.pillDetail.nextSession.sessionType'),
              value: t('analysis.emotion.title'),
              description: t('popups.pillDetail.nextSession.sessionTypeDesc')
            },
            {
              title: t('popups.pillDetail.nextSession.preparation'),
              value: t('popups.pillDetail.nextSession.getReady'),
              description: t('popups.pillDetail.nextSession.preparationDesc')
            },
            {
              title: t('popups.pillDetail.nextSession.benefits'),
              value: t('popups.pillDetail.nextSession.stayConsistent'),
              description: t('popups.pillDetail.nextSession.benefitsDesc')
            }
          ]
        };

      default:
        return null;
    }
  };

  const getMomentumColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '#10b981';
      case 'down': return '#ef4444';
      case 'stable': return '#6b7280';
      default: return '#6366f1';
    }
  };

  const getMomentumGradient = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return ['#10b981', '#059669']; // Green gradient
      case 'down': return ['#ef4444', '#dc2626']; // Red gradient
      case 'stable': return ['#6b7280', '#4b5563']; // Gray gradient
      default: return ['#10b981', '#059669']; // Default green
    }
  };

  const getTrendText = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return t('popups.pillDetail.momentum.trendUp');
      case 'down': return t('popups.pillDetail.momentum.trendDown');
      case 'stable': return t('popups.pillDetail.momentum.stable');
      default: return t('popups.pillDetail.momentum.unknown');
    }
  };

  const content = getContent();

  if (!content) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View style={[styles.popupContainer, animatedStyle]}>
          <LinearGradient colors={content.gradient} style={styles.popupHeader}>
            <View style={styles.popupHeaderContent}>
              <View style={styles.popupTitleRow}>
                <FontAwesome name={content.icon as any} size={24} color="#ffffff" />
                <View style={styles.popupTitleContainer}>
                  <Text style={styles.popupTitle}>{content.title}</Text>
                  <Text style={styles.popupSubtitle}>{content.subtitle}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <FontAwesome name="times" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.popupContent} showsVerticalScrollIndicator={false}>
            {content.details.map((detail, index) => (
              <View key={index} style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{detail.title}</Text>
                  <Text style={styles.detailValue}>{detail.value}</Text>
                </View>
                <Text style={styles.detailDescription}>{detail.description}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popupContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  popupHeader: {
    padding: 20,
  },
  popupHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  popupTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  popupSubtitle: {
    fontSize: 14,
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
  },
  popupContent: {
    padding: 20,
  },
  detailCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
  },
  detailDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
});

export default PillDetailPopup;
