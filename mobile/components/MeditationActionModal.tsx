import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface MeditationActionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (minutes: number) => void;
  onRemove: (minutes: number) => void;
  currentMinutes?: number;
}

export const MeditationActionModal: React.FC<MeditationActionModalProps> = ({
  visible,
  onClose,
  onAdd,
  onRemove,
  currentMinutes = 0,
}) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const isDark = mode === 'dark';
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const [minutes, setMinutes] = useState<string>('5');
  const [isAdding, setIsAdding] = useState<boolean>(true);

  React.useEffect(() => {
    if (visible) {
      setMinutes('5'); // Reset to default when modal opens
      setIsAdding(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }],
  };

  const handleConfirm = () => {
    const minutesNum = parseInt(minutes, 10);
    if (isNaN(minutesNum) || minutesNum <= 0) {
      return;
    }
    if (isAdding) {
      onAdd(minutesNum);
    } else {
      onRemove(minutesNum);
    }
    onClose();
  };

  const quickMinutes = [5, 10, 15, 20, 30];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView
        intensity={isDark ? 30 : 20}
        tint={isDark ? 'dark' : 'light'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View style={[styles.container, animatedStyle]}>
          <LinearGradient
            colors={['#8b5cf6', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="meditation"
                size={48}
                color="#ffffff"
              />
            </View>
            <Text style={styles.title}>
              {t('home.meditationActions.menuTitle') || 'Gestisci Meditazione'}
            </Text>
            <Text style={styles.subtitle}>
              {t('home.meditationActions.menuMessage') || 'Quanti minuti vuoi aggiungere o rimuovere?'}
            </Text>
            {currentMinutes > 0 && (
              <Text style={styles.currentMinutes}>
                {t('home.meditationActions.currentMinutes', { minutes: currentMinutes }) || `Attuali: ${currentMinutes} min`}
              </Text>
            )}
          </LinearGradient>

          <View style={[styles.content, { backgroundColor: colors.surface }]}>
            {/* Toggle Add/Remove */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  isAdding && styles.toggleButtonActive,
                  isAdding && { backgroundColor: '#8b5cf6' },
                ]}
                onPress={() => setIsAdding(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={20}
                  color={isAdding ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.toggleButtonText,
                    isAdding && styles.toggleButtonTextActive,
                    { color: isAdding ? '#ffffff' : colors.textSecondary },
                  ]}
                >
                  {t('home.meditationActions.add') || 'Aggiungi'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !isAdding && styles.toggleButtonActive,
                  !isAdding && { backgroundColor: colors.error },
                ]}
                onPress={() => setIsAdding(false)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="minus-circle"
                  size={20}
                  color={!isAdding ? '#ffffff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.toggleButtonText,
                    !isAdding && styles.toggleButtonTextActive,
                    { color: !isAdding ? '#ffffff' : colors.textSecondary },
                  ]}
                >
                  {t('home.meditationActions.remove') || 'Rimuovi'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Minutes Buttons */}
            <View style={styles.quickMinutesContainer}>
              <Text style={[styles.quickMinutesLabel, { color: colors.textSecondary }]}>
                {t('home.meditationActions.quickSelect') || 'Selezione rapida:'}
              </Text>
              <View style={styles.quickMinutesRow}>
                {quickMinutes.map((min) => (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.quickMinuteButton,
                      { borderColor: colors.border },
                      minutes === min.toString() && {
                        backgroundColor: '#8b5cf6',
                        borderColor: '#8b5cf6',
                      },
                    ]}
                    onPress={() => setMinutes(min.toString())}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.quickMinuteText,
                        { color: minutes === min.toString() ? '#ffffff' : colors.text },
                      ]}
                    >
                      {min}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                {t('home.meditationActions.customMinutes') || 'Minuti personalizzati:'}
              </Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={3}
                />
                <Text style={[styles.inputUnit, { color: colors.textSecondary }]}>
                  {t('home.minutes') || 'min'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isAdding ? ['#8b5cf6', '#7c3aed'] : [colors.error, colors.error + 'dd']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmButtonGradient}
                >
                  <MaterialCommunityIcons
                    name={isAdding ? 'plus-circle' : 'minus-circle'}
                    size={24}
                    color="#ffffff"
                  />
                  <Text style={styles.confirmButtonText}>
                    {isAdding
                      ? t('home.meditationActions.confirmAdd') || 'Aggiungi'
                      : t('home.meditationActions.confirmRemove') || 'Rimuovi'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('common.cancel') || 'Annulla'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  header: {
    padding: 32,
    paddingBottom: 28,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontWeight: '500',
  },
  currentMinutes: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingTop: 28,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  toggleButtonActive: {
    borderColor: 'transparent',
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    fontWeight: '700',
  },
  quickMinutesContainer: {
    marginBottom: 24,
  },
  quickMinutesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickMinutesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickMinuteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 50,
    alignItems: 'center',
  },
  quickMinuteText: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 12,
  },
  inputUnit: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    minHeight: 56,
  },
  confirmButton: {
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

