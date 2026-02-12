import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AuthService } from '../../services/auth.service';
import { TimeMachineCalendar } from '../TimeMachineCalendar';

type GenderOption = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

interface SocialLegalCompletionModalProps {
  visible: boolean;
  user: any;
  profile: any | null;
  onCompleted: (updatedUser: any) => Promise<void> | void;
  onForceSignOut: () => Promise<void> | void;
}

const MINIMUM_AGE = 16;
const GDPR_BLOCK_MESSAGE =
  "In conformità alla normativa vigente in materia di protezione dei dati personali, l’utilizzo dell’app è consentito esclusivamente a utenti di età pari o superiore a 16 anni. Non è possibile dunque procedere con la registrazione";
const TERMS_URL = 'https://www.yachai.net/terms';
const PRIVACY_URL = 'https://www.yachai.net/privacy';
const CONSENT_VERSION = '2026-02-11-v1';
const SOCIAL_PROVIDERS = new Set(['google', 'apple']);

const normalizeGender = (value: string | null | undefined): GenderOption | null => {
  if (!value) return null;
  if (value === 'non-binary') return 'non_binary';
  if (value === 'female' || value === 'male' || value === 'non_binary' || value === 'prefer_not_to_say') {
    return value;
  }
  return null;
};

const parseBirthDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toISODate = (date: Date): string => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .split('T')[0];
};

const calculateAge = (date: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();
  const hasHadBirthday = monthDelta > 0 || (monthDelta === 0 && today.getDate() >= date.getDate());
  if (!hasHadBirthday) {
    age -= 1;
  }
  return age;
};

const formatBirthDate = (date: Date | null): string => {
  if (!date) return 'Seleziona data';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const SocialLegalCompletionModal: React.FC<SocialLegalCompletionModalProps> = ({
  visible,
  user,
  profile,
  onCompleted,
  onForceSignOut,
}) => {
  const { colors, mode } = useTheme();
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [termsConsentAccepted, setTermsConsentAccepted] = useState(false);
  const [healthConsentAccepted, setHealthConsentAccepted] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showBirthDateCalendar, setShowBirthDateCalendar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const birthYearStart = currentYear - 100;
  const birthYearEnd = currentYear;
  const birthCalendarYearRange: any = {
    yearStart: birthYearStart,
    yearEnd: birthYearEnd,
  };

  const inputBg = mode === 'dark' ? '#1E293B' : '#FFFFFF';
  const inputBorder = mode === 'dark' ? '#334155' : '#E2E8F0';
  const placeholderColor = mode === 'dark' ? '#94A3B8' : '#94A3B8';
  const textColor = mode === 'dark' ? '#F8FAFC' : '#0F172A';

  const genderOptions: Array<{ value: GenderOption; label: string }> = [
    { value: 'female', label: 'Donna' },
    { value: 'male', label: 'Uomo' },
    { value: 'non_binary', label: 'Non binario' },
    { value: 'prefer_not_to_say', label: 'Preferisco non dirlo' },
  ];

  useEffect(() => {
    if (!visible) {
      return;
    }

    const metadata = user?.user_metadata || {};
    setGender(normalizeGender(profile?.gender || metadata.gender));
    setBirthDate(parseBirthDate(profile?.birth_date || metadata.birth_date));
    setTermsConsentAccepted(Boolean(profile?.terms_accepted || metadata.terms_consent_accepted));
    setHealthConsentAccepted(Boolean(profile?.health_consent_accepted || metadata.health_consent_accepted));
  }, [visible, profile, user]);

  const selectedGenderLabel =
    genderOptions.find((option) => option.value === gender)?.label ?? 'Seleziona';

  const canSubmit = useMemo(() => {
    return Boolean(gender && birthDate && termsConsentAccepted && healthConsentAccepted && !isSubmitting);
  }, [gender, birthDate, termsConsentAccepted, healthConsentAccepted, isSubmitting]);

  const openExternalDocument = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link non disponibile', `Impossibile aprire ${label} in questo momento.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Errore', `Impossibile aprire ${label}. Riprova più tardi.`);
    }
  };

  const handleUnderageBlock = async () => {
    Alert.alert('Registrazione non consentita', GDPR_BLOCK_MESSAGE);
    const provider = String(user?.app_metadata?.provider || '').toLowerCase();
    const isSocialProvider = SOCIAL_PROVIDERS.has(provider);
    try {
      if (isSocialProvider) {
        await AuthService.deleteCurrentUserCompletely();
      }
    } catch {
      // fallback to sign out
    } finally {
      await onForceSignOut();
    }
  };

  const handleSubmit = async () => {
    if (!gender || !birthDate) {
      Alert.alert('Dati mancanti', 'Completa sesso e data di nascita per continuare.');
      return;
    }
    if (!termsConsentAccepted || !healthConsentAccepted) {
      Alert.alert(
        'Consenso richiesto',
        "Per continuare devi accettare sia i Termini e Condizioni/Privacy sia il consenso al trattamento dei dati salute."
      );
      return;
    }

    const age = calculateAge(birthDate);
    if (age < MINIMUM_AGE) {
      await handleUnderageBlock();
      return;
    }

    setIsSubmitting(true);
    try {
      const consentAcceptedAt = new Date().toISOString();
      const consentIp = await AuthService.getPublicIpAddress();
      const birthDateISO = toISODate(birthDate);
      const metadata = user?.user_metadata || {};
      const firstName = metadata.first_name || null;
      const lastName = metadata.last_name || null;
      const fullName =
        metadata.full_name ||
        metadata.name ||
        [firstName, lastName].filter(Boolean).join(' ') ||
        user?.email?.split('@')[0] ||
        'User';

      const metadataUpdate: Record<string, any> = {
        ...metadata,
        gender,
        birth_date: birthDateISO,
        age,
        terms_consent_accepted: true,
        terms_consent_accepted_at: consentAcceptedAt,
        terms_consent_ip: consentIp,
        health_consent_accepted: true,
        health_consent_accepted_at: consentAcceptedAt,
        health_consent_ip: consentIp,
        consent_version: CONSENT_VERSION,
      };

      const { error: metadataError } = await AuthService.updateCurrentUserMetadata(metadataUpdate);
      if (metadataError) {
        throw metadataError;
      }

      const existingProfile = await AuthService.getUserProfile(user.id);
      if (!existingProfile) {
        await AuthService.createUserProfile(
          user.id,
          user.email || '',
          fullName,
          firstName || undefined,
          lastName || undefined,
          age,
          gender,
          {
            birthDate: birthDateISO,
            termsAccepted: true,
            termsAcceptedAt: consentAcceptedAt,
            termsConsentIp: consentIp,
            healthConsentAccepted: true,
            healthConsentAcceptedAt: consentAcceptedAt,
            healthConsentIp: consentIp,
            consentVersion: CONSENT_VERSION,
          }
        );
      } else {
        await AuthService.updateUserProfile(user.id, {
          gender,
          birth_date: birthDateISO,
          age,
          terms_accepted: true,
          terms_accepted_at: consentAcceptedAt,
          terms_consent_ip: consentIp || undefined,
          health_consent_accepted: true,
          health_consent_accepted_at: consentAcceptedAt,
          health_consent_ip: consentIp || undefined,
          consent_version: CONSENT_VERSION,
        });
      }

      const refreshedUser = await AuthService.getCurrentUser();
      await onCompleted(refreshedUser || user);
    } catch (error: any) {
      console.error('Error completing legal data after social auth:', error);
      Alert.alert(
        'Errore',
        error?.message || 'Impossibile completare la registrazione legale. Riprova.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Completa la registrazione</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Prima di continuare, completa i requisiti legali richiesti.
            </Text>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>SESSO *</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setShowGenderModal(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="account-outline" size={20} color={placeholderColor} style={{ marginRight: 10 }} />
                <Text style={[styles.valueText, { color: gender ? textColor : placeholderColor }]}>
                  {selectedGenderLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={placeholderColor} />
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>DATA DI NASCITA *</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setShowBirthDateCalendar(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={placeholderColor} style={{ marginRight: 10 }} />
                <Text style={[styles.valueText, { color: birthDate ? textColor : placeholderColor }]}>
                  {formatBirthDate(birthDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.85}
                onPress={() => setTermsConsentAccepted((prev) => !prev)}
              >
                <View style={[styles.checkbox, { borderColor: inputBorder }, termsConsentAccepted && styles.checkboxChecked]}>
                  {termsConsentAccepted ? <MaterialCommunityIcons name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={styles.consentTextWrap}>
                  <Text style={[styles.consentText, { color: textColor }]}>
                    Accetto i Termini e Condizioni d'uso e dichiaro di aver letto l'Informativa Privacy.
                  </Text>
                  <View style={styles.linksRow}>
                    <TouchableOpacity onPress={() => openExternalDocument(TERMS_URL, 'Termini e Condizioni')}>
                      <Text style={styles.consentLink}>[Termini]</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openExternalDocument(PRIVACY_URL, 'Informativa Privacy')}>
                      <Text style={styles.consentLink}>[Privacy Policy]</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.85}
                onPress={() => setHealthConsentAccepted((prev) => !prev)}
              >
                <View style={[styles.checkbox, { borderColor: inputBorder }, healthConsentAccepted && styles.checkboxChecked]}>
                  {healthConsentAccepted ? <MaterialCommunityIcons name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={styles.consentTextWrap}>
                  <Text style={[styles.consentText, { color: textColor }]}>
                    Acconsento al trattamento dei miei dati relativi alla salute per ricevere raccomandazioni personalizzate e profilazione automatizzata, come descritto nell'Informativa Privacy.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={onForceSignOut}
                disabled={isSubmitting}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Esci</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Accetta e continua</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TimeMachineCalendar
        visible={showBirthDateCalendar}
        onClose={() => setShowBirthDateCalendar(false)}
        onSelectDate={(date) => setBirthDate(date)}
        language="it"
        title="Seleziona la data di nascita"
        subtitle={`L'accesso è consentito solo agli utenti con almeno ${MINIMUM_AGE} anni`}
        confirmText="CONFERMA DATA"
        isDark={mode === 'dark'}
        showYearSelector={true}
        headerLabel="DATA DI NASCITA"
        headerIcon="calendar-month-outline"
        {...birthCalendarYearRange}
      />

      <Modal
        visible={showGenderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View style={styles.genderModalOverlay}>
          <View style={[styles.genderModalCard, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Text style={[styles.genderModalTitle, { color: textColor }]}>Seleziona il sesso</Text>
            {genderOptions.map((option) => {
              const selected = gender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.genderModalOption,
                    { borderColor: inputBorder },
                    selected && styles.genderModalOptionSelected,
                  ]}
                  onPress={() => {
                    setGender(option.value);
                    setShowGenderModal(false);
                  }}
                >
                  <Text style={[styles.genderModalOptionText, { color: selected ? '#ffffff' : textColor }]}>
                    {option.label}
                  </Text>
                  {selected ? <MaterialCommunityIcons name="check" size={18} color="#ffffff" /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.genderModalCancel, { borderColor: inputBorder }]}
              onPress={() => setShowGenderModal(false)}
            >
              <Text style={[styles.genderModalCancelText, { color: placeholderColor }]}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  valueText: {
    fontSize: 16,
    flex: 1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 19,
  },
  linksRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  consentLink: {
    color: '#8b5cf6',
    fontWeight: '600',
    marginRight: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  genderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  genderModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  genderModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  genderModalOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genderModalOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  genderModalOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  genderModalCancel: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderModalCancelText: {
    fontWeight: '600',
  },
});
