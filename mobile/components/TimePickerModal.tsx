import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (time: Date) => void;
  title?: string;
  initialTime?: Date;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  initialTime,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [selectedHour, setSelectedHour] = useState((initialTime || new Date()).getHours());
  const [selectedMinute, setSelectedMinute] = useState((initialTime || new Date()).getMinutes());

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const ITEM_HEIGHT = 50;
  const VISIBLE_ITEMS = 5;
  const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

  // Centra automaticamente quando il modal diventa visibile
  useEffect(() => {
    if (visible) {
      const h = initialTime ? initialTime.getHours() : new Date().getHours();
      const m = initialTime ? initialTime.getMinutes() : new Date().getMinutes();

      setSelectedHour(h);
      setSelectedMinute(m);

      // Scroll immediato alla posizione corretta
      setTimeout(() => {
        hourScrollRef.current?.scrollTo({
          y: h * ITEM_HEIGHT,
          animated: false,
        });
        minuteScrollRef.current?.scrollTo({
          y: m * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialTime]);

  const handleHourScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(23, index));
    if (clampedIndex !== selectedHour) {
      setSelectedHour(clampedIndex);
    }
  };

  const handleMinuteScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(59, index));
    if (clampedIndex !== selectedMinute) {
      setSelectedMinute(clampedIndex);
    }
  };

  const renderTimeItem = (value: number, isSelected: boolean) => {
    return (
      <View
        key={value}
        style={[
          styles.timeItem,
          { height: ITEM_HEIGHT },
        ]}
      >
        <Text
          style={[
            styles.timeText,
            {
              color: isSelected ? colors.primary : colors.textTertiary,
              fontSize: isSelected ? 28 : 20,
              fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
              opacity: isSelected ? 1 : 0.4,
            },
          ]}
        >
          {value.toString().padStart(2, '0')}
        </Text>
      </View>
    );
  };

  const handleConfirm = () => {
    const newDate = initialTime ? new Date(initialTime) : new Date();
    newDate.setHours(selectedHour);
    newDate.setMinutes(selectedMinute);
    onConfirm(newDate);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {title || t('timePicker.title') || 'Seleziona orario'}
            </Text>
          </View>

          {/* Wheel Area */}
          <View style={[styles.wheelContainer, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.wheelArea, { height: CONTAINER_HEIGHT }]}>
              {/* Selection Highlight */}
              <View
                style={[
                  styles.selectionOverlay,
                  {
                    height: ITEM_HEIGHT,
                    backgroundColor: colors.primary + '0A',
                    borderColor: colors.primary + '30',
                    borderWidth: 1.5,
                    top: ITEM_HEIGHT * 2,
                  },
                ]}
              />

              {/* Hour Picker */}
              <View style={styles.pickerColumn}>
                <ScrollView
                  ref={hourScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleHourScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * 2,
                  }}
                >
                  {hours.map((hour) => renderTimeItem(hour, hour === selectedHour))}
                </ScrollView>
              </View>

              {/* Separator */}
              <Text style={[styles.separator, { color: colors.primary }]}>:</Text>

              {/* Minute Picker */}
              <View style={styles.pickerColumn}>
                <ScrollView
                  ref={minuteScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleMinuteScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * 2,
                  }}
                >
                  {minutes.map((minute) => renderTimeItem(minute, minute === selectedMinute))}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1.5,
                },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                {t('common.cancel') || 'Annulla'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {t('common.apply') || 'Applica'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
    textAlign: 'center',
  },
  wheelContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  wheelArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectionOverlay: {
    position: 'absolute',
    width: '90%',
    borderRadius: 14,
    zIndex: 1,
    pointerEvents: 'none',
  },
  pickerColumn: {
    width: 90,
    overflow: 'hidden',
  },
  timeItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    textAlign: 'center',
  },
  separator: {
    fontSize: 32,
    fontFamily: 'Figtree_700Bold',
    marginHorizontal: 16,
    marginTop: -4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
});