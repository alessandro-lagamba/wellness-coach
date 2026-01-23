import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface MeditationActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (minutes: number) => void;
  onRemove: (minutes: number) => void;
  currentMinutes?: number;
  goalMinutes?: number;
}

export const MeditationActionModal: React.FC<MeditationActionModalProps> = ({
  visible,
  onClose,
  onAdd,
  onRemove,
  currentMinutes = 0,
  goalMinutes = 30,
}) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const isDark = mode === 'dark';
  const slideAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [minutes, setMinutes] = useState(5);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isAdding, setIsAdding] = useState(true);

  useEffect(() => {
    if (visible) {
      setMinutes(5);
      setCustomMinutes('');
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

  const handleQuickSelect = (mins: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinutes(mins);
    setCustomMinutes('');
  };

  const handleCustomChange = (text: string) => {
    setCustomMinutes(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0) {
      setMinutes(num);
    }
  };

  const handleConfirm = () => {
    if (minutes <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isAdding) {
      onAdd(minutes);
    } else {
      onRemove(minutes);
    }
    onClose();
  };

  const quickOptions = [5, 10, 15, 20, 30];
  const progressPercent = Math.min((currentMinutes / goalMinutes) * 100, 100);

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
              colors={['#a855f7', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <MaterialCommunityIcons name="meditation" size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('home.meditationActions.menuTitle') || 'Meditazione'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {currentMinutes} / {goalMinutes} {t('home.minutes') || 'min'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={['#a855f7', '#8b5cf6']}
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
                { borderColor: isAdding ? '#8b5cf6' : colors.border },
                isAdding && { backgroundColor: '#8b5cf6' },
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
                {t('home.meditationActions.add') || 'Aggiungi'}
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
                {t('home.meditationActions.remove') || 'Rimuovi'}
              </Text>
            </Pressable>
          </View>

          {/* Quick Select */}
          <View style={styles.quickSelectSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('home.meditationActions.quickSelect') || 'Selezione rapida'}
            </Text>
            <View style={styles.quickSelectRow}>
              {quickOptions.map((mins) => (
                <Pressable
                  key={mins}
                  style={({ pressed }) => [
                    styles.quickBtn,
                    {
                      backgroundColor: minutes === mins && !customMinutes ? '#8b5cf6' : colors.background,
                      borderColor: minutes === mins && !customMinutes ? '#8b5cf6' : colors.border,
                    },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                  onPress={() => handleQuickSelect(mins)}
                >
                  <Text style={[
                    styles.quickBtnNumber,
                    { color: minutes === mins && !customMinutes ? '#fff' : colors.text }
                  ]}>
                    {mins}
                  </Text>
                  <Text style={[
                    styles.quickBtnUnit,
                    { color: minutes === mins && !customMinutes ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                  ]}>
                    min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Custom Input */}
          <View style={styles.customSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('home.meditationActions.customMinutes') || 'Personalizzato'}
            </Text>
            <View style={[styles.customInputRow, { borderColor: customMinutes ? '#8b5cf6' : colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.customInput, { color: colors.text }]}
                value={customMinutes}
                onChangeText={handleCustomChange}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                maxLength={3}
              />
              <Text style={[styles.customUnit, { color: colors.textSecondary }]}>
                {t('home.minutes') || 'min'}
              </Text>
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
                colors={isAdding ? ['#a855f7', '#8b5cf6'] : ['#ef4444', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmGradient}
              >
                <MaterialCommunityIcons
                  name="meditation"
                  size={22}
                  color="#fff"
                />
                <Text style={styles.confirmText}>
                  {isAdding
                    ? `${t('home.meditationActions.add') || 'Aggiungi'} ${minutes} ${t('home.minutes') || 'min'}`
                    : `${t('home.meditationActions.remove') || 'Rimuovi'} ${minutes} ${t('home.minutes') || 'min'}`
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
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    marginBottom: 10,
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  quickBtnNumber: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
  },
  quickBtnUnit: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
    marginTop: 1,
  },
  customSection: {
    marginBottom: 20,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Figtree_600SemiBold',
    paddingVertical: 10,
  },
  customUnit: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
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
