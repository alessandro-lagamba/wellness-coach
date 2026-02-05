import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface HydrationActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (quantity: number) => void;
  onRemove: (quantity: number) => void;
  currentGlasses?: number;
  goalGlasses?: number;
  unitLabel?: string;
  unitLabelPlural?: string;
}

export const HydrationActionModal: React.FC<HydrationActionModalProps> = ({
  visible,
  onClose,
  onAdd,
  onRemove,
  currentGlasses = 0,
  goalGlasses = 8,
  unitLabel,
  unitLabelPlural,
}) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const isDark = mode === 'dark';
  const slideAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(true);

  useEffect(() => {
    if (visible) {
      setQuantity(1);
      setIsAdding(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isAdding) {
      onAdd(quantity);
    } else {
      onRemove(quantity);
    }
    onClose();
  };

  const progressPercent = Math.min((currentGlasses / goalGlasses) * 100, 100);

  // Fallback labels if not provided
  const labelOne = unitLabel || t('home.hydrationActions.glass') || 'bicchiere';
  const labelMany = unitLabelPlural || t('home.hydrationActions.glasses') || 'bicchieri';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim }
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Compact Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#0ea5e9', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <MaterialCommunityIcons name="water" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('home.hydrationActions.menuTitle') || 'Idratazione'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {currentGlasses} / {goalGlasses} {labelMany}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={['#0ea5e9', '#06b6d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
          </View>

          {/* Toggle Add/Remove - Compact */}
          <View style={styles.toggleRow}>
            <Pressable
              style={({ pressed }) => [
                styles.toggleBtn,
                { borderColor: isAdding ? '#0ea5e9' : colors.border },
                isAdding && { backgroundColor: '#0ea5e9' },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => { setIsAdding(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={isAdding ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.toggleText, { color: isAdding ? '#fff' : colors.textSecondary }]}>
                {t('home.hydrationActions.add') || 'Aggiungi'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.toggleBtn,
                { borderColor: !isAdding ? '#ef4444' : colors.border },
                !isAdding && { backgroundColor: '#ef4444' },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => { setIsAdding(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <MaterialCommunityIcons
                name="minus"
                size={18}
                color={!isAdding ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.toggleText, { color: !isAdding ? '#fff' : colors.textSecondary }]}>
                {t('home.hydrationActions.remove') || 'Rimuovi'}
              </Text>
            </Pressable>
          </View>

          {/* Quick Select Buttons */}
          <View style={styles.quickSelectSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('home.hydrationActions.quantity') || 'Quantità'}
            </Text>
            <View style={styles.quickSelectRow}>
              {[1, 2, 3, 4, 5].map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [
                    styles.quickBtn,
                    {
                      backgroundColor: quantity === num ? '#0ea5e9' : colors.background,
                      borderColor: quantity === num ? '#0ea5e9' : colors.border,
                    },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                  onPress={() => { setQuantity(num); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <MaterialCommunityIcons
                    name="cup-water"
                    size={20}
                    color={quantity === num ? '#fff' : '#0ea5e9'}
                  />
                  <Text style={[
                    styles.quickBtnText,
                    { color: quantity === num ? '#fff' : colors.text }
                  ]}>
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Action Button */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
              ]}
              onPress={handleConfirm}
            >
              <LinearGradient
                colors={isAdding ? ['#0ea5e9', '#06b6d4'] : ['#ef4444', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmGradient}
              >
                <MaterialCommunityIcons
                  name={isAdding ? 'water-plus' : 'water-minus'}
                  size={22}
                  color="#fff"
                />
                <Text style={styles.confirmText}>
                  {isAdding
                    ? `${t('home.hydrationActions.add') || 'Aggiungi'} ${quantity} ${quantity === 1 ? labelOne : labelMany}`
                    : `${t('home.hydrationActions.remove') || 'Rimuovi'} ${quantity} ${quantity === 1 ? labelOne : labelMany}`
                  }
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                {t('common.cancel') || 'Annulla'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1.5,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  quickSelectSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    marginBottom: 10,
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  quickBtnText: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
  },
  actions: {
    gap: 10,
  },
  confirmBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  confirmText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },
});
