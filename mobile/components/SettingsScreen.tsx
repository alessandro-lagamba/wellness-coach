import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert, ActivityIndicator, useColorScheme, Modal, TextInput, Platform, BackHandler, Switch, FlatList, ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';
import { NotificationsSettingsScreen } from './settings/NotificationsSettingsScreen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthService } from '../services/auth.service';
import { UserProfile } from '../lib/supabase';
import { PersonalInformationScreen } from './settings/PersonalInformationScreen';
import { MenstrualCycleSettings } from './settings/MenstrualCycleSettings';
import { HealthPermissionsModal } from './HealthPermissionsModal';
import { WellnessPermissionsModal } from './WellnessPermissionsModal';
import { useHealthData } from '../hooks/useHealthData';
import { useTranslation } from '../hooks/useTranslation';
import { saveLanguage } from '../i18n';
import { DailyJournalDBService } from '../services/daily-journal-db-local.service';
import { useTheme } from '../contexts/ThemeContext'; // 🆕 Theme hook
import { EmptyStateCard } from './EmptyStateCard';
import WellnessSyncService from '../services/wellness-sync.service';
import { UserFeedbackService } from '../services/user-feedback.service';
import Constants from 'expo-constants';

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: string;
}

interface SettingsScreenProps {
  user: any;
  onLogout: () => void;
}

// 🆕 Items verranno costruiti dinamicamente con traduzioni nel componente

const UserProfileCard = ({
  userProfile,
  isLoading,
  t,
  colors
}: {
  userProfile: UserProfile | null;
  isLoading: boolean;
  t: (key: string) => string;
  colors: any; // 🆕 Theme colors
}) => {
  if (isLoading) {
    return (
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.profileLoadingText, { color: colors.textSecondary }]} allowFontScaling={false}>{t('settings.profile.loading')}</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.profileErrorText, { color: colors.error }]}>{t('settings.profile.error')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
          <FontAwesome name="user" size={24} color={colors.textInverse} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]} allowFontScaling={false}>{userProfile.full_name || 'User'}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]} allowFontScaling={false}>{userProfile.email}</Text>
        </View>
      </View>

      <View style={[styles.profileDetails, { borderTopColor: colors.divider }]}>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.age')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>{userProfile.age || t('settings.profile.notSpecified')}</Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.gender')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>
            {userProfile.gender === 'male' ? t('settings.profile.male') :
              userProfile.gender === 'female' ? t('settings.profile.female') :
                userProfile.gender === 'other' ? t('settings.profile.other') :
                  t('settings.profile.preferNotToSay')}
          </Text>
        </View>
        <View style={styles.profileDetailRow}>
          <Text style={[styles.profileDetailLabel, { color: colors.textSecondary }]}>{t('settings.profile.memberSince')}</Text>
          <Text style={[styles.profileDetailValue, { color: colors.text }]}>
            {new Date(userProfile.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const SettingsSection = ({
  title,
  items,
  onItemPress,
  colors,
  darkModeValue
}: {
  title: string;
  items: SettingsItem[];
  onItemPress: (itemId: string) => void;
  colors: any; // 🆕 Theme colors
  darkModeValue?: boolean; // 🆕 Value for dark mode toggle
}) => {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>{title}</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.85}
          onPress={() => onItemPress(item.id)}
        >
          <View style={[styles.rowIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
            <FontAwesome name={item.icon as any} size={16} color={colors.primary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]} allowFontScaling={false}>{item.label}</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} allowFontScaling={false}>{item.description}</Text>
          </View>
          {/* 🆕 Mostra Switch per dark-mode, altrimenti chevron */}
          {item.id === 'dark-mode' ? (
            <Switch
              value={darkModeValue || false}
              onValueChange={() => onItemPress(item.id)}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={darkModeValue ? colors.primary : colors.textSecondary}
            />
          ) : (
            <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ---------------- Custom Wheel Time Picker ----------------
const WheelTimePicker = ({
  visible,
  onClose,
  initialTime,
  onConfirm
}: {
  visible: boolean;
  onClose: () => void;
  initialTime: Date;
  onConfirm: (date: Date) => void;
}) => {
  const { colors } = useTheme();
  const [selectedHour, setSelectedHour] = useState(initialTime.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialTime.getMinutes());

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Constants for wheel styling
  const ITEM_HEIGHT = 44;
  const VISIBLE_ITEMS = 5;

  const renderItem = (item: number, isHour: boolean) => {
    const isSelected = isHour ? item === selectedHour : item === selectedMinute;
    return (
      <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{
          fontSize: isSelected ? 22 : 18,
          fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
          color: isSelected ? colors.primary : colors.textTertiary,
          opacity: isSelected ? 1 : 0.5
        }}>
          {item < 10 ? `0${item}` : item}
        </Text>
      </View>
    );
  };

  const handleConfirm = () => {
    const newDate = new Date();
    newDate.setHours(selectedHour);
    newDate.setMinutes(selectedMinute);
    onConfirm(newDate);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: 40,
          paddingTop: 20,
          borderWidth: 1,
          borderColor: colors.border
        }}>
          {/* Picker Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textSecondary, fontFamily: 'Figtree_500Medium', fontSize: 16 }}>Annulla</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontFamily: 'Figtree_700Bold', fontSize: 18 }}>Imposta Orario</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={{ color: colors.primary, fontFamily: 'Figtree_700Bold', fontSize: 16 }}>Applica</Text>
            </TouchableOpacity>
          </View>

          {/* Wheel area */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
            {/* Selection overlay */}
            <View style={{
              position: 'absolute',
              height: ITEM_HEIGHT,
              width: '80%',
              backgroundColor: colors.primaryMuted,
              borderRadius: 12,
              opacity: 0.1
            }} />

            {/* Hours */}
            <View style={{ width: 80 }}>
              <FlatList
                data={hours}
                keyExtractor={(item) => `hour-${item}`}
                renderItem={({ item }) => renderItem(item, true)}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                  setSelectedHour(hours[index]);
                }}
                initialScrollIndex={selectedHour}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
              />
            </View>

            <Text style={{ fontSize: 24, fontFamily: 'Figtree_700Bold', color: colors.text, marginHorizontal: 10, marginTop: -4 }}>:</Text>

            {/* Minutes */}
            <View style={{ width: 80 }}>
              <FlatList
                data={minutes}
                keyExtractor={(item) => `min-${item}`}
                renderItem={({ item }) => renderItem(item, false)}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                  setSelectedMinute(minutes[index]);
                }}
                initialScrollIndex={selectedMinute}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------------- Feedback Modal ----------------
const FeedbackModal = ({
  visible,
  onClose,
  userProfile
}: {
  visible: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !userProfile?.id) return;

    setIsSending(true);
    try {
      const metadata = {
        platform: Platform.OS,
        version: Constants.expoConfig?.version || '1.0.0',
        device: Platform.select({ ios: 'iPhone/iPad', android: 'Android Device', default: 'Web' }),
        timestamp: new Date().toISOString()
      };

      const result = await UserFeedbackService.sendFeedback(userProfile.id, message, metadata);

      if (result.success) {
        Alert.alert(t('common.success'), t('settings.feedbackSuccess'));
        setMessage('');
        onClose();
      } else {
        Alert.alert(t('common.error'), t('settings.feedbackError'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.feedbackError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.feedbackModalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.feedbackModalHeader}>
            <Text style={[styles.feedbackModalTitle, { color: colors.text }]}>{t('settings.feedback')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome name="times" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.feedbackModalSubtitle, { color: colors.textSecondary }]}>
            {t('settings.feedbackDescription')}
          </Text>

          <TextInput
            style={[
              styles.feedbackInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }
            ]}
            placeholder={t('settings.feedbackPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.feedbackSubmitBtn,
              {
                backgroundColor: colors.primary,
                opacity: (!message.trim() || isSending) ? 0.6 : 1
              }
            ]}
            onPress={handleSend}
            disabled={!message.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.feedbackSubmitText}>{t('settings.feedbackSubmit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onLogout }) => {
  const { t, language, changeLanguage } = useTranslation(); // 🆕 Hook traduzioni
  const { mode, colors, toggleTheme } = useTheme(); // 🆕 Theme hook
  const systemColorScheme = useColorScheme();
  // 🔥 FIX: Fallback color basato su useColorScheme per evitare flash bianco
  const fallbackBackground = systemColorScheme === 'dark' ? '#1a1625' : '#f8fafc';
  const safeAreaBackground = colors?.background || fallbackBackground;
  const [resolvedUser, setResolvedUser] = useState(user ?? null);
  const [userResolutionError, setUserResolutionError] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'main' | 'personal-info' | 'notifications' | 'menstrual-cycle'>('main');
  const [healthPermissionsModal, setHealthPermissionsModal] = useState<boolean>(false);
  const [showWellnessPermissionsModal, setShowWellnessPermissionsModal] = useState<boolean>(false);
  const [requestingWellnessPermissions, setRequestingWellnessPermissions] = useState<boolean>(false);
  const [wellnessPermissions, setWellnessPermissions] = useState({ calendar: false, notifications: false });
  const [syncService] = useState(() => WellnessSyncService.getInstance());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const emailVerified = Boolean(resolvedUser?.email_confirmed_at);


  // Health data hook
  const { permissions: healthPermissions, hasData: hasHealthData, isInitialized } = useHealthData();

  // 🆕 Costruisci items con traduzioni
  const accountItems: SettingsItem[] = [
    { id: 'profile', label: t('settings.personalInfo'), description: t('settings.personalInfoDescription'), icon: 'user-circle' },
    { id: 'preferences', label: t('settings.preferences'), description: t('settings.preferencesDescription'), icon: 'sliders' },
  ];

  // 🆕 Costruisci appItems dinamicamente, aggiungendo ciclo mestruale solo se l'utente è di genere femminile
  const appItems: SettingsItem[] = [
    { id: 'health-permissions', label: t('settings.healthPermissions'), description: t('settings.healthPermissionsDescription'), icon: 'heart' },
    { id: 'language', label: t('settings.language'), description: t('settings.languageDescription'), icon: 'globe' },
    { id: 'dark-mode', label: t('settings.darkMode'), description: t('settings.darkModeDescription'), icon: 'moon-o' }, // 🆕 Dark mode toggle
    ...(userProfile?.gender === 'female' ? [{ id: 'menstrual-cycle', label: t('settings.menstrualCycle'), description: t('settings.menstrualCycleDescription'), icon: 'venus' as any }] : []), // 🆕 Ciclo mestruale solo per utenti femminili
    { id: 'app-config', label: t('settings.appConfig'), description: t('settings.appConfigDescription'), icon: 'wrench' },
    { id: 'notifications', label: t('settings.notificationsTitle'), description: t('settings.notificationsDescription'), icon: 'bell' },
    { id: 'subscription', label: t('settings.subscription'), description: t('settings.subscriptionDescription'), icon: 'credit-card' },
    { id: 'about', label: t('settings.about'), description: t('settings.aboutDescription'), icon: 'info-circle' },
    { id: 'feedback', label: t('settings.feedback'), description: t('settings.feedbackDescription'), icon: 'commenting-o' },
  ];

  useEffect(() => {
    if (user) {
      setResolvedUser(user);
      setUserResolutionError(false);
      return;
    }

    let isMounted = true;
    const hydrateUser = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (!isMounted) return;
        setResolvedUser(currentUser);
        setUserResolutionError(!currentUser);
      } catch (error) {
        console.error('Error resolving current user:', error);
        if (isMounted) {
          setResolvedUser(null);
          setUserResolutionError(true);
        }
      }
    };

    hydrateUser();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const checkWellnessPermissions = async () => {
      try {
        const status = await syncService.getPermissionsStatus();
        if (isMounted) {
          setWellnessPermissions(status);
        }
      } catch (error) {
        console.error('Error checking wellness permissions in Settings:', error);
      }
    };
    checkWellnessPermissions();
    return () => { isMounted = false; };
  }, [syncService]);

  useEffect(() => {
    if (!resolvedUser) {
      setUserProfile(null);
      setIsLoading(false);
      return;
    }
    loadUserProfile(resolvedUser);
  }, [resolvedUser?.id]);

  const loadUserProfile = async (targetUser: any, retryCount = 0) => {
    if (!targetUser?.id) {
      setUserProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await AuthService.getUserProfile(targetUser.id);

      if (profile) {
        setUserProfile(profile);
      } else {
        // 🔥 FIX: Se il profilo non esiste ancora, usa i metadata dell'utente
        // Questo può succedere subito dopo la conferma email
        console.log('📝 Profile not found, using user metadata...');

        const firstName = targetUser.user_metadata?.first_name;
        const lastName = targetUser.user_metadata?.last_name;
        const ageValue = targetUser.user_metadata?.age;
        const age = typeof ageValue === 'number' ? ageValue : (ageValue ? parseInt(String(ageValue), 10) : null);
        const gender = targetUser.user_metadata?.gender || 'prefer_not_to_say';
        const fullName = targetUser.user_metadata?.full_name ||
          (firstName && lastName ? `${firstName} ${lastName}` : null) ||
          targetUser.email?.split('@')[0] ||
          'User';

        setUserProfile({
          id: targetUser.id,
          email: targetUser.email,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          age: age,
          gender: gender as any,
          created_at: targetUser.created_at || new Date().toISOString(),
          updated_at: targetUser.updated_at || new Date().toISOString(),
        } as UserProfile);

        // 🔥 FIX: Se il profilo non esiste, prova a crearlo
        if (retryCount < 2) {
          console.log('📝 Attempting to create profile...');
          try {
            await AuthService.createUserProfile(
              targetUser.id,
              targetUser.email || '',
              fullName,
              firstName,
              lastName,
              age || undefined,
              gender
            );
            console.log('✅ Profile created, reloading...');
            // Ricarica il profilo dopo la creazione
            setTimeout(() => loadUserProfile(targetUser, retryCount + 1), 500);
          } catch (createError) {
            console.log('⚠️ Profile creation failed (may already exist):', createError);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // In caso di errore, mostra i dati di base dell'utente
      const firstName = targetUser.user_metadata?.first_name;
      const lastName = targetUser.user_metadata?.last_name;
      const ageValue = targetUser.user_metadata?.age;
      const age = typeof ageValue === 'number' ? ageValue : (ageValue ? parseInt(String(ageValue), 10) : null);
      const gender = targetUser.user_metadata?.gender || 'prefer_not_to_say';
      const fullName = targetUser.user_metadata?.full_name ||
        (firstName && lastName ? `${firstName} ${lastName}` : null) ||
        targetUser.email?.split('@')[0] ||
        'User';

      setUserProfile({
        id: targetUser.id,
        email: targetUser.email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        age: age,
        gender: gender as any,
        created_at: targetUser.created_at || new Date().toISOString(),
        updated_at: targetUser.updated_at || new Date().toISOString(),
      } as UserProfile);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableWellnessPermissions = async () => {
    try {
      setRequestingWellnessPermissions(true);
      const result = await syncService.requestPermissions();
      setWellnessPermissions(result);

      if (result.notifications) {
        const { NotificationService } = await import('../services/notifications.service');
        await NotificationService.scheduleDefaults();
      }

      setShowWellnessPermissionsModal(false);

      if (result.calendar || result.notifications) {
        Alert.alert(t('common.success'), t('home.permissions.success'));
      } else {
        Alert.alert(t('home.permissions.required'), t('home.permissions.requiredMessage'), [{ text: t('common.ok') }]);
      }
    } catch (error) {
      console.error('Error requesting wellness permissions in Settings:', error);
      Alert.alert(t('common.error'), t('home.permissions.error'));
    } finally {
      setRequestingWellnessPermissions(false);
    }
  };

  const handleRetryLoad = async () => {
    try {
      setIsLoading(true);
      if (resolvedUser) {
        setUserResolutionError(false);
        await loadUserProfile(resolvedUser);
        return;
      }
      const currentUser = await AuthService.getCurrentUser();
      setResolvedUser(currentUser);
      setUserResolutionError(!currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to reload profile data:', error);
      setUserResolutionError(true);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('settings.logoutCancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: onLogout }
      ]
    );
  };

  // 🆕 Handler per reset app
  const handleResetApp = () => {
    Alert.alert(
      t('settings.resetApp'),
      t('settings.resetAppConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.resetApp'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { ResetAppService } = await import('../services/reset-app.service');
              const result = await ResetAppService.resetApp();

              if (result.success) {
                Alert.alert(
                  t('common.success'),
                  t('settings.resetAppSuccess'),
                  [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        // Logout dopo reset
                        onLogout();
                      }
                    }
                  ]
                );
              } else {
                Alert.alert(
                  t('common.error'),
                  t('settings.resetAppError', { error: result.error || 'Unknown error' })
                );
              }
            } catch (error) {
              console.error('Error resetting app:', error);
              Alert.alert(
                t('common.error'),
                t('settings.resetAppError', { error: error instanceof Error ? error.message : 'Unknown error' })
              );
            }
          }
        }
      ]
    );
  };

  // 🆕 Handler per cambio lingua
  const handleLanguageChange = async (newLang: 'it' | 'en') => {
    await saveLanguage(newLang);
    await changeLanguage(newLang);
    Alert.alert(
      t('common.success'),
      t('settings.languageChanged', { lang: newLang === 'it' ? 'Italiano' : 'English' })
    );
  };

  // 🆕 Handler per rigenerare embeddings diario
  const handleReEmbedDiary = async () => {
    if (!resolvedUser?.id) {
      Alert.alert(t('common.error'), 'Utente non autenticato');
      return;
    }
    Alert.alert(
      'Rigenera Embeddings Diario',
      'Questa operazione rigenera gli embeddings per la ricerca semantica nel diario. Continua?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Rigenera',
          onPress: async () => {
            try {
              setIsLoading(true);
              const result = await DailyJournalDBService.reEmbedAllEntries(resolvedUser.id);
              Alert.alert(
                t('common.success'),
                `Rigenerati: ${result.success}, Falliti: ${result.failed}`
              );
            } catch (error) {
              Alert.alert(t('common.error'), String(error));
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // 🆕 Handler per backup dati locali
  const handleBackupData = async () => {
    Alert.alert(
      t('settings.backupTitle') || 'Backup Dati',
      t('settings.backupConfirm') || 'Esporta tutti i tuoi dati personali (diario, chat, analisi) in un file di backup. Potrai usare questo file per ripristinare i dati su un nuovo dispositivo.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.backupAction') || 'Esporta',
          onPress: async () => {
            try {
              setIsLoading(true);
              const { BackupService } = await import('../services/local-storage/backup.service');
              const success = await BackupService.shareBackup();
              if (success) {
                Alert.alert(
                  t('common.success'),
                  t('settings.backupSuccess') || 'Backup creato con successo. Salvalo in un luogo sicuro.'
                );
              }
            } catch (error) {
              Alert.alert(t('common.error'), String(error));
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // 🆕 Handler per ripristino dati
  const handleRestoreData = async () => {
    Alert.alert(
      t('settings.restoreTitle') || 'Ripristina Dati',
      t('settings.restoreConfirm') || 'Importa i dati da un file di backup precedente. I dati esistenti verranno mantenuti e quelli nel backup verranno aggiunti.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.restoreAction') || 'Importa',
          onPress: async () => {
            try {
              setIsLoading(true);
              const { BackupService } = await import('../services/local-storage/backup.service');
              const result = await BackupService.importBackup();
              if (result.success && result.stats) {
                const total = (Object.values(result.stats) as number[]).reduce((a, b) => a + b, 0);
                Alert.alert(
                  t('common.success'),
                  t('settings.restoreSuccess', { count: total }) || `Ripristinati ${total} elementi con successo.`
                );
              } else if (!result.success) {
                Alert.alert(t('common.error'), result.error || 'Errore durante il ripristino');
              }
            } catch (error) {
              Alert.alert(t('common.error'), String(error));
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleItemPress = (itemId: string) => {
    switch (itemId) {
      case 'profile':
        if (!resolvedUser) {
          Alert.alert(
            t('common.error'),
            t('settings.profileUnavailableSubtitle') || 'Profilo non disponibile al momento. Riprova più tardi.'
          );
          return;
        }
        setCurrentScreen('personal-info');
        break;
      case 'health-permissions':
        setHealthPermissionsModal(true);
        break;
      case 'language':
        // 🆕 Mostra dialog per selezione lingua
        Alert.alert(
          t('settings.language'),
          t('settings.chooseLanguage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: 'English',
              onPress: () => handleLanguageChange('en'),
              style: language === 'en' ? 'default' : 'default'
            },
            {
              text: 'Italiano',
              onPress: () => handleLanguageChange('it'),
              style: language === 'it' ? 'default' : 'default'
            },
          ]
        );
        break;
      case 'dark-mode':
        // 🆕 Toggle dark mode
        toggleTheme();
        break;
      case 'preferences':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'app-config':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'notifications':
        setCurrentScreen('notifications');
        break;
      case 'menstrual-cycle':
        if (!resolvedUser || userProfile?.gender !== 'female') {
          Alert.alert(
            t('common.error'),
            t('settings.menstrualCycleNotAvailable') || 'Questa funzione è disponibile solo per utenti di genere femminile.'
          );
          return;
        }
        setCurrentScreen('menstrual-cycle');
        break;
      case 'subscription':
        Alert.alert(t('settings.comingSoon'), t('settings.comingSoonMessage'));
        break;
      case 'about':
        Alert.alert(t('settings.aboutTitle'), t('settings.aboutMessage'));
        break;
      case 'feedback':
        setShowFeedbackModal(true);
        break;
      default:
        break;
    }
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
    // Reload profile data when returning from personal info screen
    if (resolvedUser) {
      loadUserProfile(resolvedUser);
    }
  };

  // Show sub-screens
  if (currentScreen === 'personal-info') {
    return <PersonalInformationScreen user={resolvedUser || user} onBack={handleBackToMain} />;
  }
  if (currentScreen === 'notifications') {
    return <NotificationsSettingsScreen onBack={handleBackToMain} />;
  }
  if (currentScreen === 'menstrual-cycle') {
    return <MenstrualCycleSettings user={resolvedUser || user} onBack={handleBackToMain} />;
  }

  return (
    <SafeAreaWrapper style={[styles.container, { backgroundColor: safeAreaBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} allowFontScaling={false}>{t('settings.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} allowFontScaling={false}>
          {t('settings.subtitle')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* ✅ FIX: Mostra sempre la card di verifica email se l'email non è verificata */}
          {!emailVerified && resolvedUser && (
            <View style={[styles.verificationCard, { borderColor: 'rgba(139,92,246,0.4)', backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <View style={[styles.verificationIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                <MaterialCommunityIcons name="email-check" size={24} color="#8b5cf6" />
              </View>
              <View style={styles.verificationCopy}>
                <Text style={[styles.verificationTitle, { color: colors.text }]} allowFontScaling={false}>
                  {t('settings.verifyEmailTitle') || 'Conferma la tua email'}
                </Text>
                <Text style={[styles.verificationMessage, { color: colors.textSecondary }]} allowFontScaling={false}>
                  {t('settings.verifyEmailDescriptionNew') || `Abbiamo inviato un'email di verifica a ${resolvedUser.email}. Apri la tua casella email e clicca sul link di conferma per attivare il tuo account e accedere a tutte le funzionalità dell'app.`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.verificationButton, { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)' }]}
                onPress={() => resolvedUser && loadUserProfile(resolvedUser)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="refresh" size={16} color="#8b5cf6" style={{ marginRight: 6 }} />
                <Text style={[styles.verificationButtonText, { color: '#8b5cf6' }]} allowFontScaling={false}>
                  {t('settings.verifyEmailAction') || 'Verifica stato'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* User Profile Card / Placeholder */}
          {resolvedUser ? (
            <>
              <UserProfileCard userProfile={userProfile} isLoading={isLoading} t={t} colors={colors} />

              {(!wellnessPermissions.calendar || !wellnessPermissions.notifications) && (
                <TouchableOpacity
                  style={[
                    styles.permissionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }
                  ]}
                  activeOpacity={0.9}
                  onPress={() => setShowWellnessPermissionsModal(true)}
                >
                  <View style={styles.permissionCardCopy}>
                    <Text style={[styles.permissionCardTitle, { color: colors.text }]} allowFontScaling={false}>
                      {t('home.permissions.cardTitle')}
                    </Text>
                    <Text style={[styles.permissionCardSubtitle, { color: colors.textSecondary }]} allowFontScaling={false}>
                      {t('home.permissions.cardSubtitle')}
                    </Text>
                  </View>
                  <View style={[styles.permissionCardAction, { borderColor: colors.primary }]}>
                    <Text style={[styles.permissionCardActionText, { color: colors.primary }]} allowFontScaling={false}>
                      {t('home.permissions.cardCta')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <EmptyStateCard
              type="general"
              customTitle={t('settings.profileUnavailableTitle')}
              customSubtitle={
                userResolutionError
                  ? t('settings.profileUnavailableSubtitle')
                  : t('settings.profileLoadingSubtitle')
              }
              customActionText={t('common.retry')}
              onAction={handleRetryLoad}
              showLearnMore={false}
            />
          )}

          {/* ✅ FIX: Mostra sempre le sezioni principali, anche se l'email non è verificata o resolvedUser è null */}
          <SettingsSection
            title={t('settings.account')}
            items={accountItems}
            onItemPress={handleItemPress}
            colors={colors}
          />
          <SettingsSection
            title={t('settings.appSettings')}
            items={appItems}
            onItemPress={handleItemPress}
            colors={colors}
            darkModeValue={mode === 'dark'} // 🆕 Pass dark mode value
          />
          {/* 🆕 Data Backup/Restore Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]} allowFontScaling={false}>{t('settings.dataManagement') || 'Gestione Dati'}</Text>

            {/* Backup Button */}
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleBackupData}
              activeOpacity={0.85}
            >
              <View style={[styles.rowIconWrapper, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <FontAwesome name="cloud-upload" size={16} color="#22c55e" />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]} allowFontScaling={false}>{t('settings.backupTitle') || 'Esporta Backup'}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} allowFontScaling={false}>{t('settings.backupDescription') || 'Salva i tuoi dati in un file'}</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* Restore Button */}
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleRestoreData}
              activeOpacity={0.85}
            >
              <View style={[styles.rowIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <FontAwesome name="cloud-download" size={16} color="#3b82f6" />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]} allowFontScaling={false}>{t('settings.restoreTitle') || 'Ripristina Backup'}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} allowFontScaling={false}>{t('settings.restoreDescription') || 'Importa dati da un file'}</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Reset App Button */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: '#f59e0b40' }]}
            onPress={handleResetApp}
          >
            <MaterialCommunityIcons name="refresh" size={16} color="#f59e0b" />
            <Text style={[styles.logoutText, { color: '#f59e0b' }]} allowFontScaling={false}>{t('settings.resetApp')}</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: String(colors.error) + '40' }]}
            onPress={handleLogout}
          >
            <FontAwesome name="sign-out" size={16} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]} allowFontScaling={false}>{t('settings.logout')}</Text>
          </TouchableOpacity>

          {/* Account Deletion Button - Solid Red with Extra Spacing */}
          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor: '#ef4444',
                borderColor: '#ef4444',
                marginTop: 24,
              }
            ]}
            onPress={() => {
              Alert.alert(
                t('settings.deleteAccount'),
                t('settings.deleteAccountConfirm'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('settings.deleteAccountAction'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setIsLoading(true);
                        const { supabase } = await import('../lib/supabase');
                        if (resolvedUser?.id) {
                          await supabase.from('emotion_analyses').delete().eq('user_id', resolvedUser.id);
                          await supabase.from('skin_analyses').delete().eq('user_id', resolvedUser.id);
                          await supabase.from('daily_journal_entries').delete().eq('user_id', resolvedUser.id);
                          await supabase.from('user_profiles').delete().eq('id', resolvedUser.id);
                          await AuthService.signOut();
                          Alert.alert(t('common.success'), t('settings.deleteAccountSuccess'), [{ text: t('common.ok'), onPress: onLogout }]);
                        }
                      } catch (error) {
                        console.error('Error deleting account:', error);
                        Alert.alert(t('common.error'), t('settings.deleteAccountError'));
                      } finally {
                        setIsLoading(false);
                      }
                    }
                  }
                ]
              );
            }}
            disabled={isLoading}
          >
            <MaterialCommunityIcons name="account-remove" size={16} color="#fff" />
            <Text style={[styles.logoutText, { color: '#fff' }]} allowFontScaling={false}>{t('settings.deleteAccount')}</Text>
          </TouchableOpacity>

          <View style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.versionLabel, { color: colors.textSecondary }]} allowFontScaling={false}>{t('settings.version')}</Text>
            <Text style={[styles.versionValue, { color: colors.primary }]} allowFontScaling={false}>{t('settings.versionValue')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Health Permissions Modal */}
      <HealthPermissionsModal
        visible={healthPermissionsModal}
        onClose={() => setHealthPermissionsModal(false)}
        onSuccess={async () => {
          // 🔥 FIX: Forza sincronizzazione dati dopo concessione permessi
          try {
            const { HealthDataService } = await import('../services/health-data.service');
            const healthService = HealthDataService.getInstance();

            // 🔥 CRITICO: PRIMA aggiorna i permessi nel servizio
            await healthService.refreshPermissions();

            // 🔥 Aspetta un momento per assicurarci che i permessi siano effettivamente disponibili
            await new Promise(resolve => setTimeout(resolve, 500));

            // 🔥 Forza sincronizzazione immediata
            await healthService.syncHealthData(true);
          } catch (error) {
            console.error('Error syncing health data after permissions:', error);
          }

          Alert.alert(
            t('settings.healthPermissionsUpdated'),
            t('settings.healthPermissionsUpdatedMessage'),
            [{ text: t('common.ok') }]
          );
        }}
      />

      <WellnessPermissionsModal
        visible={showWellnessPermissionsModal}
        onEnable={handleEnableWellnessPermissions}
        onSkip={() => setShowWellnessPermissionsModal(false)}
        loading={requestingWellnessPermissions}
        missingCalendar={!wellnessPermissions.calendar}
        missingNotifications={!wellnessPermissions.notifications}
      />

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        userProfile={userProfile}
      />
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderBottomWidth: 1,
    // 🔥 FIX: borderBottomColor rimosso - viene applicato dinamicamente
  },
  title: {
    fontSize: 24,
    fontFamily: 'Figtree_700Bold', // Was 700
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    fontFamily: 'Figtree_500Medium',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100, // Increased padding to account for bottom navigation bar
  },
  verificationCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  verificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  verificationCopy: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold', // Was 700
    marginBottom: 4,
  },
  verificationMessage: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Figtree_500Medium',
  },
  verificationButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  section: {
    marginBottom: 32,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    // 🔥 FIX: borderColor rimosso - viene applicato dinamicamente
  },
  rowIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#0f172a',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontFamily: 'Figtree_500Medium',
  },
  versionCard: {
    marginTop: 20,
    borderRadius: 16,
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    padding: 20,
    borderWidth: 1,
    // 🔥 FIX: borderColor rimosso - viene applicato dinamicamente
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  versionLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
    fontFamily: 'Figtree_500Medium',
  },
  versionValue: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#6366f1',
  },
  // Profile Card Styles
  profileCard: {
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    // 🔥 FIX: borderColor rimosso - viene applicato dinamicamente
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    // backgroundColor sarà sovrascritto dinamicamente con colors.primary
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold', // Was 700
    color: '#0f172a',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Figtree_500Medium',
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  profileDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileDetailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Figtree_500Medium', // Was 500
  },
  profileDetailValue: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'Figtree_700Bold', // Was 600
  },
  profileLoadingText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Figtree_500Medium',
  },
  profileErrorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    fontFamily: 'Figtree_500Medium',
  },
  // Logout Button Styles
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 🔥 FIX: backgroundColor rimosso - viene applicato dinamicamente
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1,
    // 🔥 FIX: borderColor rimosso - viene applicato dinamicamente (con logica speciale per error color)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold', // Was 600
    color: '#ef4444',
    marginLeft: 8,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationButtonText: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
  },
  permissionCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionCardCopy: {
    flex: 1,
    marginRight: 12,
  },
  permissionCardTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  permissionCardSubtitle: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    lineHeight: 18,
  },
  permissionCardAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  permissionCardActionText: {
    fontSize: 13,
    fontFamily: 'Figtree_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  feedbackModalContent: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackModalTitle: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
  },
  closeBtn: {
    padding: 4,
  },
  feedbackModalSubtitle: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    lineHeight: 20,
    marginBottom: 20,
  },
  feedbackInput: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    fontFamily: 'Figtree_500Medium',
    marginBottom: 24,
  },
  feedbackSubmitBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  feedbackSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
  },
});

export default SettingsScreen;
