import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getUserLocale } from '../utils/locale-formatters';

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
  const { t, language } = useTranslation();
  const [selectedTime, setSelectedTime] = useState<Date>(
    initialTime || new Date()
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const handleConfirm = () => {
    onConfirm(selectedTime);
    onClose();
  };

  const locale = getUserLocale(language);
  
  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat(locale, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: undefined, // Let system decide
    }).format(date);
  };

  // Detect 24-hour format preference
  const use24Hour = (): boolean => {
    try {
      const testDate = new Date();
      const testString = testDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      return !testString.match(/AM|PM/i);
    } catch {
      return false; // Default to 12-hour
    }
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
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {title || t('timePicker.title') || 'Seleziona orario'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                is24Hour={use24Hour()}
                display="spinner"
                onChange={(event, date) => {
                  if (date) setSelectedTime(date);
                }}
                style={styles.picker}
                textColor={colors.text}
              />
            ) : (
              <>
                {!showPicker && (
                  <TouchableOpacity
                    style={[styles.timeButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                    onPress={() => setShowPicker(true)}
                  >
                    <FontAwesome name="clock-o" size={20} color={colors.primary} />
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {formatTime(selectedTime)}
                    </Text>
                  </TouchableOpacity>
                )}
                {showPicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    is24Hour={use24Hour()}
                    display="default"
                    onChange={(event, date) => {
                      setShowPicker(false);
                      if (date) setSelectedTime(date);
                    }}
                    textColor={colors.text}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                {t('common.cancel') || 'Annulla'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>
                {t('common.confirm') || 'Conferma'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingRight: 4, // 🆕 Aggiungi padding per evitare che la X sia troppo a destra
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1, // 🆕 Permetti al titolo di occupare lo spazio disponibile
  },
  closeButton: {
    padding: 4,
    marginLeft: 12, // 🆕 Aggiungi margine sinistro per spostare la X più a sinistra
  },
  content: {
    marginVertical: 20,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 200,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

