import React, { useEffect, useRef, useCallback } from 'react';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WidgetSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (widgetId: string) => void;
  availableWidgets: string[];
  position: number;
}

export const WidgetSelectionModal: React.FC<WidgetSelectionModalProps> = ({
  visible,
  onClose,
  onSelect,
  availableWidgets,
  position,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // 🔥 FIX: Memory leak - aggiungiamo ref per tracciare le animazioni attive
  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);
  
  // 🔥 FIX: Memory leak - ferma tutte le animazioni attive
  const stopAnimations = useCallback(() => {
    animationRefs.current.forEach(anim => {
      if (anim) {
        anim.stop();
      }
    });
    animationRefs.current = [];
  }, []);

  useEffect(() => {
    // 🔥 FIX: Memory leak - ferma le animazioni precedenti prima di avviarne di nuove
    stopAnimations();
    
    if (visible) {
      // Anima il modal dal basso
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
      
      // 🔥 FIX: Memory leak - salva il riferimento all'animazione per cleanup
      animationRefs.current = [anim];
      anim.start();
    } else {
      // Nascondi il modal
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
      
      // 🔥 FIX: Memory leak - salva il riferimento all'animazione per cleanup
      animationRefs.current = [anim];
      anim.start();
    }
    
    // 🔥 FIX: Memory leak - cleanup: ferma tutte le animazioni quando il componente viene smontato
    return () => {
      stopAnimations();
    };
  }, [visible, slideAnim, fadeAnim, stopAnimations]);

  const getWidgetIcon = (widgetId: string): string => {
    const icons: { [key: string]: string } = {
      steps: 'walk',
      meditation: 'meditation',
      hydration: 'cup-water',
      sleep: 'sleep',
      hrv: 'heart-pulse',
      analyses: 'chart-line',
    };
    return icons[widgetId] || 'widget';
  };

  const getWidgetTitle = (widgetId: string): string => {
    const titles: { [key: string]: string } = {
      steps: t('widgets.steps'),
      meditation: t('widgets.meditation'),
      hydration: t('widgets.hydration'),
      sleep: t('widgets.sleep'),
      hrv: t('widgets.hrv'),
      analyses: t('widgets.analyses'),
    };
    return titles[widgetId] || widgetId;
  };

  const handleSelect = (widgetId: string) => {
    onSelect(widgetId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Overlay scuro */}
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

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: colors.background,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('widgetSelection.title')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('widgetSelection.subtitle', { position: position + 1 })}
          </Text>
        </View>

        <View style={styles.content}>
          {availableWidgets.length > 0 ? (
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              {availableWidgets.map((widgetId) => (
                <TouchableOpacity
                  key={widgetId}
                  style={[styles.widgetItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleSelect(widgetId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetInfo}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.surfaceMuted }]}>
                      <MaterialCommunityIcons
                        name={getWidgetIcon(widgetId) as any}
                        size={28}
                        color="#10b981"
                      />
                    </View>
                    <View style={styles.widgetDetails}>
                      <Text style={[styles.widgetTitle, { color: colors.text }]}>
                        {getWidgetTitle(widgetId)}
                      </Text>
                      <Text style={[styles.widgetSubtitle, { color: colors.textSecondary }]}>
                        {t('widgetSelection.tapToAdd')}
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
                {t('widgetSelection.allAdded')}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {t('widgetSelection.disableToReAdd')}
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
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  widgetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  widgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  widgetDetails: {
    flex: 1,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  widgetSubtitle: {
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default WidgetSelectionModal;

