import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { ChartType } from '../services/chart-config.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChartSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (chartId: ChartType) => void;
  availableCharts: ChartType[];
}

export const ChartSelectionModal: React.FC<ChartSelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  availableCharts,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);
  
  const stopAnimations = useCallback(() => {
    animationRefs.current.forEach(anim => {
      if (anim) {
        anim.stop();
      }
    });
    animationRefs.current = [];
  }, []);

  useEffect(() => {
    stopAnimations();
    
    if (visible) {
      const anim = Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);
      
      animationRefs.current = [anim];
      anim.start();
    } else {
      const anim = Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]);
      
      animationRefs.current = [anim];
      anim.start();
    }
    
    return () => {
      stopAnimations();
    };
  }, [visible, slideAnim, fadeAnim, stopAnimations]);

  const getChartIcon = (chartId: ChartType): string => {
    const icons: { [key: string]: string } = {
      steps: 'walk',
      sleepHours: 'sleep',
      hrv: 'heart-pulse',
      heartRate: 'heart',
      hydration: 'cup-water',
      meditation: 'meditation',
    };
    return icons[chartId] || 'chart-line';
  };

  const getChartTitle = (chartId: ChartType): string => {
    const titles: { [key: string]: string } = {
      steps: t('widgets.steps'),
      sleepHours: t('widgets.sleep'),
      hrv: t('widgets.hrv'),
      heartRate: t('home.weeklyProgress.heartRate'),
      hydration: t('widgets.hydration'),
      meditation: t('widgets.meditation'),
    };
    return titles[chartId] || chartId;
  };

  const getChartColor = (chartId: ChartType): string => {
    const colors: { [key: string]: string } = {
      steps: '#10b981',
      sleepHours: '#6366f1',
      hrv: '#ef4444',
      heartRate: '#ef4444',
      hydration: '#3b82f6',
      meditation: '#8b5cf6',
    };
    return colors[chartId] || '#6366f1';
  };

  const handleSelect = (chartId: ChartType) => {
    onSelect(chartId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.overlayBackground,
            {
              opacity: fadeAnim,
            },
          ]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.background,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('chartSelection.title') || 'Aggiungi grafico'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('chartSelection.subtitle') || 'Seleziona un grafico da aggiungere'}
          </Text>
        </View>

        <View style={styles.content}>
          {availableCharts.length > 0 ? (
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              {availableCharts.map((chartId) => (
                <TouchableOpacity
                  key={chartId}
                  style={[styles.chartItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleSelect(chartId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.chartInfo}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.surfaceMuted }]}>
                      <MaterialCommunityIcons
                        name={getChartIcon(chartId) as any}
                        size={28}
                        color={getChartColor(chartId)}
                      />
                    </View>
                    <View style={styles.chartDetails}>
                      <Text style={[styles.chartTitle, { color: colors.text }]}>
                        {getChartTitle(chartId)}
                      </Text>
                      <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                        {t('chartSelection.tapToAdd') || 'Tocca per aggiungere'}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-circle" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                {t('chartSelection.allAdded') || 'Tutti i grafici sono già aggiunti'}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {t('chartSelection.disableToReAdd') || 'Disabilita un grafico per riaggiungerlo'}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  scrollView: {
    flex: 1,
  },
  chartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  chartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  chartDetails: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ChartSelectionModal;


