import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useTranslation } from '../hooks/useTranslation'; // 🆕 i18n
import { useTheme } from '../contexts/ThemeContext';
import { hydrationUnitService, HydrationUnit } from '../services/hydration-unit.service';

type WidgetKey = 'steps' | 'hydration' | 'meditation' | 'sleep';

interface Props {
  visible: boolean;
  widgetId: WidgetKey;
  initialValue?: number;          // goal corrente (se presente, in unità preferita per hydration)
  onClose: () => void;
  onSave: (value: number) => void; // value sarà sempre in unità preferita per hydration
}

// 🆕 labels verranno costruiti dinamicamente con traduzioni

const WidgetGoalModal: React.FC<Props> = ({ visible, widgetId, initialValue, onClose, onSave }) => {
  const { t } = useTranslation(); // 🆕 i18n hook
  const { colors } = useTheme();
  const [selectedUnit, setSelectedUnit] = useState<HydrationUnit>('glass');
  const [unitLoaded, setUnitLoaded] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // 🆕 Carica unità preferita per hydration e converti initialValue
  useEffect(() => {
    if (widgetId === 'hydration') {
      hydrationUnitService.getPreferredUnit().then((unit) => {
        setSelectedUnit(unit);
        setUnitLoaded(true);

        // 🔥 FIX: Converti initialValue da bicchieri all'unità preferita
        if (initialValue != null) {
          const glasses = initialValue;
          const ml = glasses * 250; // Converti bicchieri a ml
          const valueInPreferredUnit = hydrationUnitService.mlToUnit(ml, unit);
          setValue(String(Math.round(valueInPreferredUnit * 10) / 10));
        }
      });
    } else {
      setUnitLoaded(true);
      if (initialValue != null) {
        setValue(String(initialValue));
      }
    }
  }, [widgetId, visible]); // 🔥 Rimuoviamo initialValue dalle dipendenze per evitare loop

  // 🆕 Costruisci labels dinamicamente con traduzioni
  const labels: Record<WidgetKey, { title: string; unit: string; hint: string; min: number; max: number; step: number }> = {
    steps: { title: t('modals.widgetGoal.steps.title'), unit: t('modals.widgetGoal.steps.unit'), hint: t('modals.widgetGoal.steps.hint'), min: 1000, max: 40000, step: 500 },
    hydration: {
      title: t('modals.widgetGoal.hydration.title'),
      unit: unitLoaded ? hydrationUnitService.getUnitConfig(selectedUnit).label : t('modals.widgetGoal.hydration.unit'),
      hint: t('modals.widgetGoal.hydration.hint'),
      min: 1,
      max: selectedUnit === 'liter' ? 5 : selectedUnit === 'bottle' ? 10 : 20,    // Max diverso per unità
      step: selectedUnit === 'liter' ? 0.5 : 1   // Step diverso per litri
    },
    meditation: { title: t('modals.widgetGoal.meditation.title'), unit: t('modals.widgetGoal.meditation.unit'), hint: t('modals.widgetGoal.meditation.hint'), min: 1, max: 180, step: 5 },
    sleep: { title: t('modals.widgetGoal.sleep.title'), unit: t('modals.widgetGoal.sleep.unit'), hint: t('modals.widgetGoal.sleep.hint'), min: 4, max: 12, step: 0.5 },
  };
  const meta = labels[widgetId];
  const [value, setValue] = useState<string>('');

  // 🔥 FIX: Il valore viene impostato nel primo useEffect quando l'unità è caricata

  const clamp = (n: number) => Math.min(meta.max, Math.max(meta.min, n));

  const handleSave = async () => {
    const n = Number(value);
    if (Number.isNaN(n)) return;

    // 🔥 Per hydration, salva l'unità preferita prima di salvare il goal
    if (widgetId === 'hydration') {
      await hydrationUnitService.setPreferredUnit(selectedUnit);
    }

    onSave(clamp(n));
  };

  const handleUnitChange = async (newUnit: HydrationUnit) => {
    // 🔥 Converti il valore corrente quando cambia unità
    if (value && !Number.isNaN(Number(value))) {
      const currentValue = Number(value);
      const currentMl = hydrationUnitService.unitToMl(currentValue, selectedUnit);
      const newValue = hydrationUnitService.mlToUnit(currentMl, newUnit);
      setValue(String(Math.round(newValue * 10) / 10));
    }
    setSelectedUnit(newUnit);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]} allowFontScaling={false} adjustsFontSizeToFit numberOfLines={1}>{meta.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling={false} adjustsFontSizeToFit numberOfLines={2}>{t('modals.widgetGoal.subtitle')}</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="numeric"
              placeholder={meta.hint}
              style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }]}
              returnKeyType="done"
            />
            {widgetId === 'hydration' ? (
              <TouchableOpacity
                style={[styles.unitPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={[styles.unitText, { color: colors.text }]} allowFontScaling={false} numberOfLines={1}>{meta.unit}</Text>
                <Text style={[styles.unitArrow, { color: colors.textSecondary }]} allowFontScaling={false}> ▼</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.unitPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.unitText, { color: colors.text }]}>{meta.unit}</Text>
              </View>
            )}
          </View>

          {widgetId === 'hydration' && (
            <Text style={[styles.unitInfo, { color: colors.textTertiary }]} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
              {t('modals.widgetGoal.hydration.unitInfo', {
                ml: hydrationUnitService.getUnitConfig(selectedUnit).mlPerUnit
              }) || `${hydrationUnitService.getUnitConfig(selectedUnit).mlPerUnit}ml per ${meta.unit}`}
            </Text>
          )}

          <Text style={[styles.rangeHint, { color: colors.textSecondary }]} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit>
            {t('modals.widgetGoal.rangeHint', {
              min: meta.min,
              max: meta.max,
              step: `${meta.step}${meta.unit === t('modals.widgetGoal.sleep.unit') ? 'h' : ''}`
            })}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, { backgroundColor: colors.surfaceMuted }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: colors.text }]} allowFontScaling={false}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={[styles.btnText, styles.btnPrimaryText]} allowFontScaling={false}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Custom Unit Picker Overlay */}
      {
        showUnitPicker && (
          <View style={styles.pickerOverlay}>
            <TouchableOpacity style={styles.pickerBackdrop} onPress={() => setShowUnitPicker(false)} activeOpacity={1} />
            <View style={[styles.pickerContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]} allowFontScaling={false}>
                {t('modals.widgetGoal.hydration.selectUnit') || 'Seleziona unità'}
              </Text>
              {hydrationUnitService.getAllUnits().map((u) => (
                <TouchableOpacity
                  key={u.unit}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    handleUnitChange(u.unit);
                    setShowUnitPicker(false);
                  }}
                >
                  {/* Fix translation key: 'glass' -> 'glasses' per matchare it.json */}
                  <Text style={[styles.pickerItemText, { color: colors.text }]} allowFontScaling={false} numberOfLines={1}>
                    {t(`modals.widgetGoal.hydration.units.${u.unit === 'glass' ? 'glasses' : u.unit}`) || u.label}
                  </Text>
                  {selectedUnit === u.unit && <Text style={{ color: colors.primary, fontFamily: 'Figtree_700Bold' }} allowFontScaling={false}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowUnitPicker(false)}>
                <Text style={[styles.pickerCancelText, { color: colors.error || '#ef4444' }]} allowFontScaling={false}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }
    </Modal >
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end'
  },
  sheet: {
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  title: { fontSize: 20, fontFamily: 'Figtree_800ExtraBold', color: '#0f172a' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280', marginBottom: 20, fontFamily: 'Figtree_500Medium' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    color: '#0f172a',
    backgroundColor: '#F8FAFC',
  },
  unitPill: {
    marginLeft: 12,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  unitText: { fontSize: 13, fontFamily: 'Figtree_700Bold', color: '#111827' },
  unitArrow: { fontSize: 10, marginLeft: 4, fontFamily: 'Figtree_500Medium' },
  unitInfo: { marginTop: 4, fontSize: 12, fontStyle: 'italic', fontFamily: 'Figtree_500Medium' },
  rangeHint: { marginTop: 12, fontSize: 13, color: '#9CA3AF', fontFamily: 'Figtree_500Medium' },
  buttons: { marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { height: 48, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#F3F4F6' },
  btnPrimary: { backgroundColor: '#3b82f6' },
  btnPrimaryText: { color: '#fff' },
  btnText: { fontSize: 16, fontFamily: 'Figtree_700Bold' },

  /* Picker Styles */
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 1000 },
  pickerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  pickerTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold', marginBottom: 15, textAlign: 'center' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerItemText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  pickerCancelBtn: { marginTop: 15, paddingVertical: 10, alignItems: 'center' },
  pickerCancelText: { fontSize: 16, fontFamily: 'Figtree_700Bold' },
});

export default WidgetGoalModal;
