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
import { useTranslation } from '../../hooks/useTranslation';

type GenderOption = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

interface SocialLegalCompletionModalProps {
  visible: boolean;
  user: any;
  profile: any | null;
  onCompleted: (updatedUser: any) => Promise<void> | void;
  onForceSignOut: () => Promise<void> | void;
}

const MINIMUM_AGE = 16;
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

const formatBirthDate = (date: Date | null, locale: string): string => {
  if (!date) return '';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const resolveNameParts = (metadata: any, email?: string | null) => {
  const rawFullName =
    metadata?.full_name ||
    metadata?.name ||
    email?.split('@')[0] ||
    'User';

  const parts = String(rawFullName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const parsedFirstName = parts[0] || undefined;
  const parsedLastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  return {
    fullName: rawFullName,
    firstName: metadata?.first_name || parsedFirstName,
    lastName: metadata?.last_name || parsedLastName,
  };
};

export const SocialLegalCompletionModal: React.FC<SocialLegalCompletionModalProps> = ({
  visible,
  user,
  profile,
  onCompleted,
  onForceSignOut,
}) => {
  const { t, language } = useTranslation();
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
    { value: 'female', label: t('auth.gender.female') },
    { value: 'male', label: t('auth.gender.male') },
    { value: 'non_binary', label: t('auth.gender.nonBinary') },
    { value: 'prefer_not_to_say', label: t('auth.gender.preferNotToSay') },
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
    genderOptions.find((option) => option.value === gender)?.label ?? t('auth.gender.select');

  const canSubmit = useMemo(() => {
    return Boolean(gender && birthDate && termsConsentAccepted && healthConsentAccepted && !isSubmitting);
  }, [gender, birthDate, termsConsentAccepted, healthConsentAccepted, isSubmitting]);

  const openExternalDocument = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          t('auth.linkUnavailableTitle'),
          t('auth.linkUnavailableMessage', { label })
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('auth.linkOpenError', { label }));
    }
  };

  const handleUnderageBlock = async () => {
    Alert.alert(
      t('auth.underage.title'),
      t('auth.underage.message', { minAge: MINIMUM_AGE })
    );
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
      Alert.alert(t('auth.missingDataTitle'), t('auth.missingDataMessage'));
      return;
    }
    if (!termsConsentAccepted || !healthConsentAccepted) {
      Alert.alert(
        t('auth.consentRequiredTitle'),
        t('auth.consentRequiredMessage')
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
      const { firstName, lastName, fullName } = resolveNameParts(metadata, user?.email);

      const metadataUpdate: Record<string, any> = {
        ...metadata,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
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
          firstName,
          lastName,
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
        const profileUpdates: Record<string, any> = {
          ...(existingProfile?.first_name ? {} : { first_name: firstName }),
          ...(existingProfile?.last_name ? {} : { last_name: lastName }),
          ...(existingProfile?.full_name ? {} : { full_name: fullName }),
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
        };

        await AuthService.updateUserProfile(user.id, profileUpdates);
      }

      const refreshedUser = await AuthService.getCurrentUser();
      await onCompleted(refreshedUser || user);
    } catch (error: any) {
      console.error('Error completing legal data after social auth:', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('auth.legalCompletionError')
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
            <Text style={[styles.title, { color: colors.text }]}>{t('auth.legal.modalTitle')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.legal.modalSubtitle')}
            </Text>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{`${t('auth.gender.label').toUpperCase()} *`}</Text>
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

              <Text style={[styles.label, { color: colors.textSecondary }]}>{`${t('auth.birthDate.label').toUpperCase()} *`}</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setShowBirthDateCalendar(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={placeholderColor} style={{ marginRight: 10 }} />
                <Text style={[styles.valueText, { color: birthDate ? textColor : placeholderColor }]}>
                  {birthDate
                    ? formatBirthDate(birthDate, language.startsWith('en') ? 'en-US' : 'it-IT')
                    : t('auth.birthDate.select')}
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
                    {t('auth.legal.termsAndPrivacyConsent')}
                  </Text>
                  <View style={styles.linksRow}>
                    <TouchableOpacity onPress={() => openExternalDocument(TERMS_URL, t('auth.legal.termsLabel'))}>
                      <Text style={styles.consentLink}>[{t('auth.legal.termsLabel')}]</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openExternalDocument(PRIVACY_URL, t('auth.legal.privacyLabel'))}>
                      <Text style={styles.consentLink}>[{t('auth.legal.privacyLabel')}]</Text>
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
                    {t('auth.legal.healthConsentCheckbox')}
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
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>{t('auth.legal.exit')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t('auth.legal.acceptAndContinue')}</Text>
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
        language={language.startsWith('en') ? 'en' : 'it'}
        title={t('auth.birthDate.title')}
        subtitle={t('auth.birthDate.subtitle', { minAge: MINIMUM_AGE })}
        confirmText={t('auth.birthDate.confirm')}
        isDark={mode === 'dark'}
        showYearSelector={true}
        headerLabel={t('auth.birthDate.headerLabel')}
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
            <Text style={[styles.genderModalTitle, { color: textColor }]}>{t('auth.gender.selectTitle')}</Text>
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
              <Text style={[styles.genderModalCancelText, { color: placeholderColor }]}>{t('common.cancel')}</Text>
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
    fontFamily: 'Figtree_700Bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Figtree_400Regular',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
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
    fontFamily: 'Figtree_500Medium',
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
    fontFamily: 'Figtree_400Regular',
  },
  linksRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  consentLink: {
    color: '#8b5cf6',
    fontFamily: 'Figtree_600SemiBold',
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
    fontFamily: 'Figtree_700Bold',
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
    fontFamily: 'Figtree_700Bold',
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
    fontFamily: 'Figtree_700Bold',
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
    fontFamily: 'Figtree_600SemiBold',
  },
  genderModalCancel: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderModalCancelText: {
    fontFamily: 'Figtree_600SemiBold',
  },
});
