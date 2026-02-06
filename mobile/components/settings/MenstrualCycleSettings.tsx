import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { menstrualCycleService } from '../../services/menstrual-cycle.service';
import DateTimePicker from '@react-native-community/datetimepicker';

interface MenstrualCycleSettingsProps {
  user: User;
  onBack: () => void;
}

export const MenstrualCycleSettings: React.FC<MenstrualCycleSettingsProps> = ({
  user,
  onBack,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastPeriodDate, setLastPeriodDate] = useState<Date | null>(null);
  const [cycleLength, setCycleLength] = useState<string>('28');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadCycleData();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      onBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBack]);

  const loadCycleData = async () => {
    setIsLoading(true);
    try {
      const lastPeriod = await menstrualCycleService.getLastPeriodDate();
      const length = await menstrualCycleService.getCycleLength();
      const configured = await menstrualCycleService.isConfigured();

      if (lastPeriod) {
        setLastPeriodDate(new Date(lastPeriod));
      }
      setCycleLength(length.toString());
      setIsConfigured(configured);
    } catch (error) {
      console.error('Error loading cycle data:', error);
      Alert.alert(t('common.error'), t('settings.menstrualCycleSettings.loadError') || 'Errore nel caricamento dei dati del ciclo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lastPeriodDate) {
      Alert.alert(t('common.error'), t('settings.menstrualCycleSettings.lastPeriodRequired') || 'Inserisci la data dell\'ultimo periodo.');
      return;
    }

    const length = parseInt(cycleLength, 10);
    if (isNaN(length) || length < 21 || length > 35) {
      Alert.alert(t('common.error'), t('settings.menstrualCycleSettings.invalidLength') || 'La lunghezza del ciclo deve essere tra 21 e 35 giorni.');
      return;
    }

    setIsSaving(true);
    try {
      // Salva la data dell'ultimo periodo
      const dateString = lastPeriodDate.toISOString().split('T')[0];
      await menstrualCycleService.setLastPeriodDate(dateString);

      // Salva la lunghezza del ciclo
      await menstrualCycleService.setCycleLength(length);

      Alert.alert(
        t('common.success'),
        t('settings.menstrualCycleSettings.saveSuccess') || 'Dati del ciclo mestruale salvati con successo!',
        [{ text: t('common.ok'), onPress: onBack }]
      );
    } catch (error) {
      console.error('Error saving cycle data:', error);
      Alert.alert(t('common.error'), t('settings.menstrualCycleSettings.saveError') || 'Errore nel salvataggio dei dati del ciclo.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('settings.menstrualCycleSettings.loading') || 'Caricamento...'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <FontAwesome name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('settings.menstrualCycleSettings.title') || 'Ciclo Mestruale'}</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('settings.menstrualCycleSettings.info') || 'Configura il tuo ciclo mestruale per monitorare le fasi e ricevere promemoria personalizzati.'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Data Ultimo Periodo */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('settings.menstrualCycleSettings.lastPeriodDate') || 'Data Ultimo Periodo'}
              </Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} style={styles.inputIcon} />
                <Text style={[styles.inputText, { color: lastPeriodDate ? colors.text : colors.textTertiary }]}>
                  {lastPeriodDate ? formatDate(lastPeriodDate) : t('settings.menstrualCycleSettings.selectDate') || 'Seleziona data'}
                </Text>
                <FontAwesome name="chevron-down" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
              <Text style={[styles.helpText, { color: colors.textTertiary }]}>
                {t('settings.menstrualCycleSettings.lastPeriodHelp') || 'Seleziona la data di inizio dell\'ultimo ciclo mestruale.'}
              </Text>
            </View>

            {/* Lunghezza Ciclo */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('settings.menstrualCycleSettings.cycleLength') || 'Lunghezza Ciclo (giorni)'}
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="calendar-range" size={16} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={cycleLength}
                  onChangeText={(text) => {
                    // Permetti solo numeri
                    const numericValue = text.replace(/[^0-9]/g, '');
                    if (numericValue === '' || (parseInt(numericValue, 10) >= 21 && parseInt(numericValue, 10) <= 35)) {
                      setCycleLength(numericValue);
                    }
                  }}
                  placeholder="28"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={[styles.unitText, { color: colors.textSecondary }]}>giorni</Text>
              </View>
              <Text style={[styles.helpText, { color: colors.textTertiary }]}>
                {t('settings.menstrualCycleSettings.cycleLengthHelp') || 'La lunghezza media del tuo ciclo (solitamente tra 21 e 35 giorni).'}
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && { backgroundColor: colors.primaryMuted }]}
            onPress={handleSave}
            disabled={isSaving || !lastPeriodDate}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <FontAwesome name="save" size={16} color={colors.textInverse} style={styles.buttonIcon} />
                <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
                  {t('common.save') || 'Salva'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={lastPeriodDate || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
              setLastPeriodDate(selectedDate);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Figtree_500Medium',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
  },
  placeholder: {
    width: 36,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Figtree_500Medium',
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Figtree_500Medium',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Figtree_500Medium',
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
    fontFamily: 'Figtree_500Medium',
  },
  unitText: {
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Figtree_500Medium',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
});

