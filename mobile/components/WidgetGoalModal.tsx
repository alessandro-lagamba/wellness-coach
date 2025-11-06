import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';

type WidgetKey = 'steps' | 'hydration' | 'meditation' | 'sleep';

interface Props {
  visible: boolean;
  widgetId: WidgetKey;
  initialValue?: number;          // goal corrente (se presente)
  onClose: () => void;
  onSave: (value: number) => void;
}

// 🆕 labels verranno costruiti dinamicamente con traduzioni

const WidgetGoalModal: React.FC<Props> = ({ visible, widgetId, initialValue, onClose, onSave }) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors } = useTheme();
  // 🆕 Costruisci labels dinamicamente con traduzioni
  const labels: Record<WidgetKey, { title: string; unit: string; hint: string; min: number; max: number; step: number }> = {
    steps:      { title: t('modals.widgetGoal.steps.title'),     unit: t('modals.widgetGoal.steps.unit'),   hint: t('modals.widgetGoal.steps.hint'), min: 1000,  max: 40000, step: 500 },
    hydration:  { title: t('modals.widgetGoal.hydration.title'), unit: t('modals.widgetGoal.hydration.unit'), hint: t('modals.widgetGoal.hydration.hint'), min: 1,     max: 20,    step: 1   },
    meditation: { title: t('modals.widgetGoal.meditation.title'), unit: t('modals.widgetGoal.meditation.unit'), hint: t('modals.widgetGoal.meditation.hint'), min: 1,     max: 180,   step: 5   },
    sleep:      { title: t('modals.widgetGoal.sleep.title'),     unit: t('modals.widgetGoal.sleep.unit'),   hint: t('modals.widgetGoal.sleep.hint'), min: 4,     max: 12,    step: 0.5 },
  };
  const meta = labels[widgetId];
  const [value, setValue] = useState<string>(initialValue ? String(initialValue) : '');

  useEffect(() => {
    setValue(initialValue != null ? String(initialValue) : '');
  }, [initialValue, visible]);

  const clamp = (n: number) => Math.min(meta.max, Math.max(meta.min, n));

  const handleSave = () => {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    onSave(clamp(n));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{meta.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('modals.widgetGoal.subtitle')}</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder={meta.hint}
              style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }]}
              returnKeyType="done"
            />
            <View style={[styles.unitPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
              <Text style={[styles.unitText, { color: colors.text }]}>{meta.unit}</Text>
            </View>
          </View>

          <Text style={[styles.rangeHint, { color: colors.textSecondary }]}>
            {t('modals.widgetGoal.rangeHint', { 
              min: meta.min, 
              max: meta.max, 
              step: `${meta.step}${meta.unit === t('modals.widgetGoal.sleep.unit') ? 'h' : ''}`
            })}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, { backgroundColor: colors.surfaceMuted }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    padding: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#6b7280', marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#F8FAFC',
  },
  unitPill: {
    marginLeft: 8,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  rangeHint: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  buttons: { marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { height: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#F3F4F6' },
  btnGhostText: { color: '#0f172a' },
  btnPrimary: { backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: '#fff' },
  btnText: { fontSize: 15, fontWeight: '700' },
});

export default WidgetGoalModal;
